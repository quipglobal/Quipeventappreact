/**
 * article-reader.tsx
 *
 * PDF rendering strategy
 * ─────────────────────
 * react-native-webview has no web build (no WebView.web.js). On Expo web it
 * resolves to a no-op and renders nothing. We therefore split on Platform.OS:
 *
 *   web    → PdfViewerWeb   — React.createElement('iframe') directly in the
 *                             browser DOM. Tries the direct PDF URL first
 *                             (best for PDFs stored on the Laravel backend),
 *                             then falls back to Google Docs Viewer, then
 *                             shows an "Open in browser" error screen.
 *
 *   native → PdfViewerNative — WebView with Google Docs Viewer first (handles
 *                             most external PDFs and bypasses X-Frame-Options),
 *                             then direct URL, then error screen.
 *
 * In both cases the `onLoadSuccess` callback is called only on a confirmed
 * successful load so the analytics "open" event is never counted for failed
 * attempts.
 */
import React, { useRef, useEffect, useCallback, useState, createElement } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useArticle, useSubmitArticleAnalytics, useSubmitAnalyticsEvent } from '@/hooks/useReader';
import { colors, spacing, radius } from '@/constants/theme';
import type { Article } from '@/lib/api/types';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function stripInlineTags(html: string): string {
  return html
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '$1')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '$1')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '$1')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '$1')
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '$1')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'li'; text: string };

function parseHtmlContent(html: string): Block[] {
  if (!html?.trim()) return [];
  const blocks: Block[] = [];
  const blockRe =
    /<(h1|h2|h3|h4|h5|h6|p|li|blockquote|pre|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  let hasMatches = false;
  while ((match = blockRe.exec(html)) !== null) {
    hasMatches = true;
    const tag = match[1].toLowerCase();
    const inner = match[2];
    const text = stripInlineTags(inner).trim();
    if (!text) continue;
    if (tag === 'h1') blocks.push({ type: 'h1', text });
    else if (tag === 'h2' || tag === 'h3' || tag === 'h4') blocks.push({ type: 'h2', text });
    else if (tag === 'h5' || tag === 'h6') blocks.push({ type: 'h3', text });
    else if (tag === 'li') blocks.push({ type: 'li', text });
    else { const cleaned = text.trim(); if (cleaned) blocks.push({ type: 'p', text: cleaned }); }
  }
  if (!hasMatches) {
    stripInlineTags(html)
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => blocks.push({ type: 'p', text: t }));
  }
  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML article renderer
// ─────────────────────────────────────────────────────────────────────────────

function HtmlContent({ html }: { html: string }) {
  const blocks = parseHtmlContent(html);
  if (blocks.length === 0) {
    return <Text style={styles.noContent}>No content available.</Text>;
  }
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'h1') return <Text key={i} style={styles.h1}>{block.text}</Text>;
        if (block.type === 'h2') return <Text key={i} style={styles.h2}>{block.text}</Text>;
        if (block.type === 'h3') return <Text key={i} style={styles.h3}>{block.text}</Text>;
        if (block.type === 'li') {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={styles.liBullet}>•</Text>
              <Text style={styles.liText}>{block.text}</Text>
            </View>
          );
        }
        return <Text key={i} style={styles.paragraph}>{block.text}</Text>;
      })}
    </>
  );
}

function ReadingProgressBar({ percent }: { percent: number }) {
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${percent}%` as `${number}%` }]} />
    </View>
  );
}

function ArticleHeader({ article }: { article: Article }) {
  const accent = article.categoryColor || colors.primary;
  return (
    <View style={styles.articleHeader}>
      {article.categoryName ? (
        <View style={[styles.categoryPill, { backgroundColor: accent + '20' }]}>
          <Text style={[styles.categoryPillText, { color: accent }]}>
            {article.categoryName.toUpperCase()}
          </Text>
        </View>
      ) : null}
      <Text style={styles.articleTitle}>{article.title}</Text>
      {article.excerpt ? <Text style={styles.articleExcerpt}>{article.excerpt}</Text> : null}
      <View style={styles.articleMetaRow}>
        {article.authorName ? (
          <View style={styles.metaChip}>
            <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaChipText}>{article.authorName}</Text>
          </View>
        ) : null}
        <View style={styles.metaChip}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaChipText}>{article.estimatedReadMinutes} min read</Text>
        </View>
      </View>
      <View style={styles.divider} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared PDF viewer sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface PdfViewerProps {
  fileUrl: string;
  accent: string;
  onLoadSuccess: () => void;
}

function PdfLoadingOverlay({ accent, message }: { accent: string; message: string }) {
  return (
    <View style={styles.webviewLoader}>
      <ActivityIndicator size="large" color={accent} />
      <Text style={styles.webviewLoaderText}>{message}</Text>
    </View>
  );
}

function PdfErrorScreen({
  fileUrl,
  accent,
  onRetry,
}: {
  fileUrl: string;
  accent: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.pdfErrorWrap}>
      <Ionicons
        name="document-text-outline"
        size={52}
        color={colors.textMuted}
        style={{ marginBottom: spacing.lg }}
      />
      <Text style={styles.pdfErrorTitle}>Couldn't display document</Text>
      <Text style={styles.pdfErrorSub}>
        The document couldn't be rendered inside the app.
        {'\n'}You can still open it in your browser.
      </Text>
      <TouchableOpacity
        style={[styles.pdfOpenBtn, { backgroundColor: accent }]}
        onPress={() => {
          if (Platform.OS === 'web') {
            (window as any).open(fileUrl, '_blank');
          } else {
            Linking.openURL(fileUrl).catch(() => undefined);
          }
        }}
      >
        <Ionicons name="open-outline" size={16} color="#fff" />
        <Text style={styles.pdfOpenBtnText}>Open in Browser</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.pdfRetryLink} onPress={onRetry}>
        <Text style={styles.pdfRetryLinkText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Web PDF viewer — native <iframe> element, no WebView dependency
// ─────────────────────────────────────────────────────────────────────────────

/**
 * On web we bypass react-native-webview entirely (it has no web build) and
 * create a native browser <iframe> via React.createElement.
 *
 * Stage order for web:
 *   1. direct — the raw pdf_url from the backend (publicly accessible storage)
 *   2. google — Google Docs Viewer fallback for externally-hosted PDFs
 *   3. failed — error screen with "Open in Browser" button
 *
 * A 20-second safety timer advances to the next stage when the browser
 * silently blocks an iframe without firing onError (e.g. X-Frame-Options).
 */
type WebStage = 'direct' | 'google' | 'failed';

function PdfViewerWeb({ fileUrl, accent, onLoadSuccess }: PdfViewerProps) {
  const [stage, setStage] = useState<WebStage>('direct');
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const src =
    stage === 'direct'
      ? fileUrl
      : stage === 'google'
      ? `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`
      : null;

  const advance = useCallback(() => {
    if (stage === 'direct') {
      setStage('google');
      setLoading(true);
    } else {
      setStage('failed');
      setLoading(false);
    }
  }, [stage]);

  useEffect(() => {
    loadedRef.current = false;
    timerRef.current = setTimeout(advance, 20_000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [stage, advance]);

  const handleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(false);
    if (!loadedRef.current) {
      loadedRef.current = true;
      onLoadSuccess();
    }
  }, [onLoadSuccess]);

  const handleError = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    advance();
  }, [advance]);

  if (stage === 'failed' || !src) {
    return (
      <PdfErrorScreen
        fileUrl={fileUrl}
        accent={accent}
        onRetry={() => { loadedRef.current = false; setStage('direct'); setLoading(true); }}
      />
    );
  }

  // createElement('iframe') produces a real browser <iframe>.
  // Style uses CSS properties (not RN StyleSheet numbers).
  const iframeEl = createElement('iframe', {
    key: src,
    src,
    title: 'PDF Document',
    allow: 'fullscreen',
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      border: 'none',
      opacity: loading ? 0 : 1,
    },
    onLoad: handleLoad,
    onError: handleError,
  });

  return (
    <View style={styles.webviewWrap}>
      {loading && (
        <PdfLoadingOverlay
          accent={accent}
          message={stage === 'direct' ? 'Loading document…' : 'Preparing document…'}
        />
      )}
      {iframeEl}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Native PDF viewer — WebView with Google Docs → Direct URL cascade
// ─────────────────────────────────────────────────────────────────────────────

type NativeStage = 'google' | 'direct' | 'failed';

function PdfViewerNative({ fileUrl, accent, onLoadSuccess }: PdfViewerProps) {
  const [stage, setStage] = useState<NativeStage>('google');
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const src =
    stage === 'google'
      ? `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`
      : stage === 'direct'
      ? fileUrl
      : null;

  const advance = useCallback(() => {
    if (stage === 'google') { setStage('direct'); setLoading(true); }
    else { setStage('failed'); setLoading(false); }
  }, [stage]);

  const handleLoad = useCallback(() => {
    setLoading(false);
    if (!loadedRef.current) {
      loadedRef.current = true;
      onLoadSuccess();
    }
  }, [onLoadSuccess]);

  const handleError = useCallback(() => {
    setLoading(false);
    advance();
  }, [advance]);

  const handleHttpError = useCallback(
    (e: { nativeEvent: { statusCode: number } }) => {
      if (e.nativeEvent.statusCode >= 400) {
        setLoading(false);
        advance();
      }
    },
    [advance],
  );

  if (stage === 'failed' || !src) {
    return (
      <PdfErrorScreen
        fileUrl={fileUrl}
        accent={accent}
        onRetry={() => { loadedRef.current = false; setStage('google'); setLoading(true); }}
      />
    );
  }

  return (
    <View style={styles.webviewWrap}>
      {loading && (
        <PdfLoadingOverlay
          accent={accent}
          message={stage === 'google' ? 'Preparing document…' : 'Loading document…'}
        />
      )}
      <WebView
        key={src}
        source={{ uri: src }}
        style={[styles.webview, loading && styles.webviewHidden]}
        onLoad={handleLoad}
        onError={handleError}
        onHttpError={handleHttpError}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        startInLoadingState={false}
        originWhitelist={['*']}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified PdfViewer — selects implementation by platform
// ─────────────────────────────────────────────────────────────────────────────

function PdfViewer(props: PdfViewerProps) {
  if (Platform.OS === 'web') return <PdfViewerWeb {...props} />;
  return <PdfViewerNative {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function ArticleReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: article, isLoading, isError } = useArticle(id ?? null);
  const { mutate: submitAnalytics } = useSubmitArticleAnalytics();
  const { mutate: submitEvent } = useSubmitAnalyticsEvent();

  const sessionIdRef = useRef(generateSessionId());
  const startedAtRef = useRef(new Date().toISOString());
  const activeSecondsRef = useRef(0);
  const totalSecondsRef = useRef(0);
  const maxScrollPercentRef = useRef(0);
  const isActiveRef = useRef(true);
  const submittedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scrollPercent, setScrollPercent] = useState(0);

  const hasPdf = !!article?.fileUrl;
  const accent = article?.categoryColor || colors.primary;

  if (__DEV__ && article) {
    console.log(`[ArticleReader] "${article.title}" hasPdf=${hasPdf} fileUrl=${article.fileUrl ?? 'null'}`);
  }

  const sendAnalytics = useCallback(() => {
    if (submittedRef.current || !id) return;
    submittedRef.current = true;
    submitAnalytics({
      documentId: id,
      analytics: {
        session_id: sessionIdRef.current,
        article_id: id,
        click_count: 1,
        active_read_seconds: activeSecondsRef.current,
        total_elapsed_seconds: totalSecondsRef.current,
        max_scroll_percent: maxScrollPercentRef.current,
        started_at: startedAtRef.current,
        ended_at: new Date().toISOString(),
        completed: maxScrollPercentRef.current >= 90,
      },
    });
  }, [id, submitAnalytics]);

  // PDF articles: fire 'open' only on confirmed WebView/iframe load success.
  // HTML articles: fire 'open' as soon as article data arrives.
  const handlePdfLoadSuccess = useCallback(() => {
    if (!id) return;
    submitEvent({ eventType: 'open', articleId: id });
  }, [id, submitEvent]);

  useEffect(() => {
    if (!article || !id || hasPdf) return;
    submitEvent({ eventType: 'open', articleId: id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      totalSecondsRef.current += 1;
      if (isActiveRef.current) activeSecondsRef.current += 1;
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      isActiveRef.current = nextState === 'active';
      if (nextState !== 'active') sendAnalytics();
    });
    return () => sub.remove();
  }, [sendAnalytics]);

  useFocusEffect(
    useCallback(() => {
      isActiveRef.current = true;
      submittedRef.current = false;
      return () => {
        isActiveRef.current = false;
        sendAnalytics();
      };
    }, [sendAnalytics]),
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentSize.height <= 0) return;
    const pct = Math.min(
      100,
      Math.round(((contentOffset.y + layoutMeasurement.height) / contentSize.height) * 100),
    );
    maxScrollPercentRef.current = Math.max(maxScrollPercentRef.current, pct);
    setScrollPercent(pct);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Article</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading article…</Text>
        </View>
      </View>
    );
  }

  if (isError || !article) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Article</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="document-outline" size={48} color={colors.textMuted} style={{ marginBottom: spacing.lg }} />
          <Text style={styles.errorTitle}>Article not found</Text>
          <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {article.categoryName || 'Article'}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {hasPdf ? (
        <>
          <View style={styles.pdfMeta}>
            <Text style={styles.pdfMetaTitle} numberOfLines={2}>{article.title}</Text>
            {article.authorName ? (
              <Text style={styles.pdfMetaAuthor}>{article.authorName}</Text>
            ) : null}
          </View>
          <PdfViewer
            fileUrl={article.fileUrl!}
            accent={accent}
            onLoadSuccess={handlePdfLoadSuccess}
          />
        </>
      ) : (
        <>
          <ReadingProgressBar percent={scrollPercent} />
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={200}
          >
            <ArticleHeader article={article} />
            <HtmlContent html={article.content} />
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const READER_BG = '#0A0A16';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: READER_BG },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginHorizontal: spacing.sm,
  },

  progressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: 2, backgroundColor: colors.primary, borderRadius: 1 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: spacing.xl },

  pdfMeta: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 2,
  },
  pdfMetaTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  pdfMetaAuthor: { color: colors.textMuted, fontSize: 12 },

  webviewWrap: { flex: 1, backgroundColor: '#fff', position: 'relative' },
  webview: { flex: 1 },
  webviewHidden: { opacity: 0 },
  webviewLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: READER_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: spacing.md,
  },
  webviewLoaderText: { color: colors.textMuted, fontSize: 13 },

  pdfErrorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    backgroundColor: READER_BG,
    gap: spacing.sm,
  },
  pdfErrorTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pdfErrorSub: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  pdfOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    marginTop: spacing.md,
  },
  pdfOpenBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pdfRetryLink: { marginTop: spacing.md, padding: spacing.sm },
  pdfRetryLinkText: { color: colors.textMuted, fontSize: 13, textDecorationLine: 'underline' },

  articleHeader: { marginBottom: spacing.xl },
  categoryPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  categoryPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  articleTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  articleExcerpt: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  articleMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaChipText: { color: colors.textMuted, fontSize: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: spacing.md },

  h1: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.2,
    marginTop: 28,
    marginBottom: spacing.md,
  },
  h2: {
    color: '#FFFFFFCC',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    marginTop: 24,
    marginBottom: spacing.sm,
  },
  h3: {
    color: '#FFFFFF99',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 20,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paragraph: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 27,
    marginBottom: 16,
    letterSpacing: 0.15,
  },
  liRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 10, paddingLeft: spacing.sm },
  liBullet: { color: colors.primary, fontSize: 16, lineHeight: 27, fontWeight: '700' },
  liText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 27,
    letterSpacing: 0.15,
  },
  noContent: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.xxl,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  loadingText: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  backBtnLarge: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
