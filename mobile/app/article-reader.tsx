/**
 * article-reader.tsx — Kindle-style article + PDF reader
 *
 * PDF rendering strategy
 * ─────────────────────
 * Native (iOS/Android):
 *   - React Native fetch() downloads PDF bytes with Bearer auth header (no CORS)
 *   - Bytes converted to base64 and embedded in an inline WebView HTML page
 *   - PDF.js (cdnjs CDN) renders pages as canvas elements — works on both platforms
 *   - No native PDF modules required; pinch-to-zoom supported via WebView
 *   - Error states: download failure → in-app error + "Open in Browser" fallback
 *
 * Web (Expo web):
 *   1. direct  — raw pdf_url in <iframe>
 *   2. google  — Google Docs Viewer fallback (20s timer advances on silent block)
 *   3. failed  — error screen with "Open in Browser"
 *
 * Analytics
 * ─────────
 * - 'open' event fires on confirmed PDF load success / HTML article mount
 * - read-session fires on screen blur / app background with active + total seconds,
 *   max scroll %, completion flag — safe to re-send (server upserts by session_id)
 */
import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  createElement,
} from 'react';
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
  Share,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useArticle,
  useSubmitArticleAnalytics,
  useSubmitAnalyticsEvent,
} from '@/hooks/useReader';
import { getToken } from '@/lib/apiClient';
import { colors, spacing, radius } from '@/constants/theme';
import type { Article } from '@/lib/api/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const READER_BG = '#0A0A16';
const FONT_SIZES = [14, 16, 17, 19, 21] as const;
type FontSizeIndex = 0 | 1 | 2 | 3 | 4;
const DEFAULT_FONT_IDX: FontSizeIndex = 2;

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
    else if (tag === 'h2' || tag === 'h3' || tag === 'h4')
      blocks.push({ type: 'h2', text });
    else if (tag === 'h5' || tag === 'h6') blocks.push({ type: 'h3', text });
    else if (tag === 'li') blocks.push({ type: 'li', text });
    else {
      const cleaned = text.trim();
      if (cleaned) blocks.push({ type: 'p', text: cleaned });
    }
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
// Reading progress bar
// ─────────────────────────────────────────────────────────────────────────────

function ReadingProgressBar({
  percent,
  accent,
}: {
  percent: number;
  accent: string;
}) {
  return (
    <View style={styles.progressBar}>
      <View
        style={[
          styles.progressFill,
          { width: `${percent}%` as `${number}%`, backgroundColor: accent },
        ]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Article header (HTML reader)
// ─────────────────────────────────────────────────────────────────────────────

function ArticleHeader({ article }: { article: Article }) {
  const accent = article.categoryColor || colors.primary;
  return (
    <View style={styles.articleHeader}>
      {article.categoryName ? (
        <View style={[styles.categoryPill, { backgroundColor: accent + '22' }]}>
          <Text style={[styles.categoryPillText, { color: accent }]}>
            {article.categoryName.toUpperCase()}
          </Text>
        </View>
      ) : null}

      <Text style={styles.articleTitle}>{article.title}</Text>

      {article.excerpt ? (
        <Text style={styles.articleExcerpt}>{article.excerpt}</Text>
      ) : null}

      <View style={styles.articleMetaRow}>
        {article.authorName ? (
          <View style={styles.metaChip}>
            <Ionicons name="person-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaChipText}>{article.authorName}</Text>
          </View>
        ) : null}
        <View style={styles.metaChip}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaChipText}>
            {article.estimatedReadMinutes} min read
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: accent + '30' }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML content renderer
// ─────────────────────────────────────────────────────────────────────────────

function HtmlContent({
  html,
  fontSize,
}: {
  html: string;
  fontSize: number;
}) {
  const blocks = parseHtmlContent(html);
  const lineH = Math.round(fontSize * 1.75);
  if (blocks.length === 0) {
    return <Text style={styles.noContent}>No content available.</Text>;
  }
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'h1')
          return (
            <Text key={i} style={[styles.h1, { fontSize: fontSize + 6 }]}>
              {block.text}
            </Text>
          );
        if (block.type === 'h2')
          return (
            <Text key={i} style={[styles.h2, { fontSize: fontSize + 2 }]}>
              {block.text}
            </Text>
          );
        if (block.type === 'h3')
          return (
            <Text key={i} style={[styles.h3, { fontSize: fontSize - 1 }]}>
              {block.text}
            </Text>
          );
        if (block.type === 'li') {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={[styles.liBullet, { fontSize, lineHeight: lineH }]}>
                •
              </Text>
              <Text
                style={[
                  styles.liText,
                  { fontSize, lineHeight: lineH },
                ]}
              >
                {block.text}
              </Text>
            </View>
          );
        }
        return (
          <Text
            key={i}
            style={[styles.paragraph, { fontSize, lineHeight: lineH }]}
          >
            {block.text}
          </Text>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Font size controls
// ─────────────────────────────────────────────────────────────────────────────

function FontSizeControls({
  index,
  onChange,
}: {
  index: FontSizeIndex;
  onChange: (next: FontSizeIndex) => void;
}) {
  return (
    <View style={styles.fontControls}>
      <TouchableOpacity
        style={[styles.fontBtn, index === 0 && styles.fontBtnDisabled]}
        onPress={() => {
          if (index > 0) onChange((index - 1) as FontSizeIndex);
        }}
        disabled={index === 0}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.fontBtnText, { fontSize: 12 }]}>A</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.fontBtn,
          index === FONT_SIZES.length - 1 && styles.fontBtnDisabled,
        ]}
        onPress={() => {
          if (index < FONT_SIZES.length - 1)
            onChange((index + 1) as FontSizeIndex);
        }}
        disabled={index === FONT_SIZES.length - 1}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.fontBtnText, { fontSize: 18 }]}>A</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface PdfViewerProps {
  fileUrl: string;
  accent: string;
  authToken: string | null;
  onLoadSuccess: () => void;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunks: string[] = [];
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    chunks.push(String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as any)));
  }
  return btoa(chunks.join(''));
}

function buildPdfHtml(base64Data: string, accent: string): string {
  const safeAccent = accent.replace(/[^#a-zA-Z0-9]/g, '');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=5.0,user-scalable=yes">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#0a0a16;overflow-x:hidden}
#loader{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a0a16;color:#fff;gap:16px;z-index:99}
.spinner{width:52px;height:52px;border:3px solid rgba(124,58,237,.25);border-top-color:${safeAccent};border-radius:50%;animation:spin .9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.lt{font-family:-apple-system,sans-serif;font-size:15px;color:rgba(255,255,255,.75)}
.ls{font-family:-apple-system,sans-serif;font-size:12px;color:rgba(255,255,255,.4);margin-top:4px}
#err{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:#0a0a16;color:#fff;text-align:center;padding:40px;gap:14px}
.ei{font-size:48px}
.et{font-family:-apple-system,sans-serif;font-size:18px;font-weight:700}
.em{font-family:-apple-system,sans-serif;font-size:13px;color:rgba(255,255,255,.5);max-width:280px;line-height:1.5}
.rb{margin-top:8px;padding:13px 32px;background:${safeAccent};color:#fff;border:none;border-radius:28px;font-family:-apple-system,sans-serif;font-size:14px;font-weight:700;cursor:pointer}
#pages{display:none;flex-direction:column;align-items:center;padding:16px;gap:10px;min-height:100%}
.pg{display:block;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.6);max-width:100%}
.pn{font-family:-apple-system,sans-serif;font-size:11px;color:rgba(255,255,255,.3);text-align:center;padding-bottom:6px}
</style>
</head>
<body>
<div id="loader"><div class="spinner"></div><div class="lt">Rendering document…</div><div id="ls" class="ls"></div></div>
<div id="err"><div class="ei">📄</div><div class="et">Couldn't display document</div><div class="em" id="em"></div><button class="rb" onclick="render()">Try Again</button></div>
<div id="pages"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
var B64='${base64Data}';
function post(t,d){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:t},d)))}catch(e){}}
function showErr(m){document.getElementById('loader').style.display='none';var e=document.getElementById('err');e.style.display='flex';document.getElementById('em').textContent=m||'Could not render this document.';post('error',{message:m})}
async function render(){
  document.getElementById('err').style.display='none';
  var pg=document.getElementById('pages');pg.style.display='none';pg.innerHTML='';
  document.getElementById('loader').style.display='flex';
  document.getElementById('ls').textContent='';
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  try{
    document.getElementById('ls').textContent='Loading…';
    var raw=atob(B64);
    var buf=new ArrayBuffer(raw.length);
    var view=new Uint8Array(buf);
    for(var i=0;i<raw.length;i++)view[i]=raw.charCodeAt(i);
    document.getElementById('ls').textContent='Rendering…';
    var pdf=await pdfjsLib.getDocument({data:buf}).promise;
    pg.style.display='flex';
    document.getElementById('loader').style.display='none';
    var dpr=Math.min(window.devicePixelRatio||1,2);
    for(var n=1;n<=pdf.numPages;n++){
      var page=await pdf.getPage(n);
      var vp0=page.getViewport({scale:1});
      var dispW=Math.min(window.innerWidth-32,768);
      var sc=(dispW/vp0.width)*dpr;
      var vp=page.getViewport({scale:sc});
      var canvas=document.createElement('canvas');
      canvas.className='pg';
      canvas.width=vp.width;canvas.height=vp.height;
      canvas.style.width=(vp.width/dpr)+'px';canvas.style.height=(vp.height/dpr)+'px';
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
      pg.appendChild(canvas);
      if(pdf.numPages>1){var lbl=document.createElement('div');lbl.className='pn';lbl.textContent=n+' of '+pdf.numPages;pg.appendChild(lbl)}
    }
    post('loaded',{pages:pdf.numPages});
  }catch(e){showErr(e.message||'Render failed')}
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',render):render();
</script>
</body>
</html>`;
}

function PdfLoadingOverlay({ accent, message }: { accent: string; message: string }) {
  return (
    <View style={styles.pdfLoaderWrap}>
      <View style={[styles.pdfLoaderRing, { borderTopColor: accent }]}>
        <ActivityIndicator size="large" color={accent} />
      </View>
      <Text style={styles.pdfLoaderText}>{message}</Text>
    </View>
  );
}

function PdfErrorScreen({
  fileUrl,
  accent,
  message,
  onRetry,
}: {
  fileUrl: string;
  accent: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.pdfErrorWrap}>
      <LinearGradient
        colors={[accent + '20', 'transparent']}
        style={styles.pdfErrorIconWrap}
      >
        <Ionicons name="document-text-outline" size={40} color={accent} />
      </LinearGradient>
      <Text style={styles.pdfErrorTitle}>Couldn't display document</Text>
      <Text style={styles.pdfErrorSub}>
        {message || "The document couldn't be rendered inside the app."}
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
// Web PDF viewer — native <iframe> with Google Docs fallback
// ─────────────────────────────────────────────────────────────────────────────

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
    setStage((s) => {
      if (s === 'direct') { setLoading(true); return 'google'; }
      setLoading(false); return 'failed';
    });
  }, []);

  useEffect(() => {
    loadedRef.current = false;
    timerRef.current = setTimeout(advance, 20_000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [stage, advance]);

  const handleLoad = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(false);
    if (!loadedRef.current) { loadedRef.current = true; onLoadSuccess(); }
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

  const iframeEl = createElement('iframe', {
    key: src,
    src,
    title: 'PDF Document',
    allow: 'fullscreen',
    style: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100%', height: '100%',
      border: 'none',
      opacity: loading ? 0 : 1,
      background: '#fff',
    },
    onLoad: handleLoad,
    onError: handleError,
  });

  return (
    <View style={styles.pdfFullWrap}>
      {loading && <PdfLoadingOverlay accent={accent} message={stage === 'direct' ? 'Loading document…' : 'Preparing document…'} />}
      {iframeEl}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Native PDF viewer — PDF.js canvas renderer
// Fetches PDF bytes in RN context (no CORS), converts to base64, renders via
// an inline WebView HTML page using PDF.js from CDN.
// Works on both iOS and Android — no native PDF modules required.
// ─────────────────────────────────────────────────────────────────────────────

type FetchState = 'idle' | 'fetching' | 'done' | 'error';

function PdfViewerNative({ fileUrl, accent, authToken, onLoadSuccess }: PdfViewerProps) {
  const [fetchState, setFetchState] = useState<FetchState>('fetching');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [base64, setBase64] = useState<string>('');

  const doFetch = useCallback(() => {
    let cancelled = false;
    setFetchState('fetching');
    setErrorMsg('');
    setBase64('');

    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    fetch(fileUrl, { headers })
      .then(async (resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        return arrayBufferToBase64(buf);
      })
      .then((b64) => {
        if (cancelled) return;
        setBase64(b64);
        setFetchState('done');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err.message || 'Download failed');
        setFetchState('error');
      });

    return () => { cancelled = true; };
  }, [fileUrl, authToken]);

  useEffect(() => {
    const cleanup = doFetch();
    return cleanup;
  }, [doFetch]);

  if (fetchState === 'fetching') {
    return <PdfLoadingOverlay accent={accent} message="Loading document…" />;
  }

  if (fetchState === 'error' || !base64) {
    return (
      <PdfErrorScreen
        fileUrl={fileUrl}
        accent={accent}
        message={errorMsg}
        onRetry={doFetch}
      />
    );
  }

  const html = buildPdfHtml(base64, accent);

  return (
    <WebView
      source={{ html }}
      style={styles.pdfWebView}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      allowUniversalAccessFromFileURLs
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      scalesPageToFit={false}
      onMessage={(e) => {
        try {
          const data = JSON.parse(e.nativeEvent.data);
          if (data.type === 'loaded') onLoadSuccess();
        } catch {}
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified PdfViewer
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
  const [fontSizeIdx, setFontSizeIdx] = useState<FontSizeIndex>(DEFAULT_FONT_IDX);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const hasPdf = !!article?.fileUrl;
  const accent = article?.categoryColor || colors.primary;
  const fontSize = FONT_SIZES[fontSizeIdx];

  const minutesRemaining = article
    ? Math.max(1, Math.round(article.estimatedReadMinutes * (1 - scrollPercent / 100)))
    : null;

  useEffect(() => {
    getToken().then(setAuthToken).catch(() => undefined);
  }, []);

  if (__DEV__ && article) {
    console.log(
      `[ArticleReader] "${article.title}" hasPdf=${hasPdf} fileUrl=${article.fileUrl ?? 'null'}`,
    );
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
      Math.round(
        ((contentOffset.y + layoutMeasurement.height) / contentSize.height) * 100,
      ),
    );
    maxScrollPercentRef.current = Math.max(maxScrollPercentRef.current, pct);
    setScrollPercent(pct);
  }, []);

  const handleShare = useCallback(() => {
    if (!article) return;
    Share.share({ message: article.title, title: article.title }).catch(() => undefined);
  }, [article]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
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

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError || !article) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Article</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}>
          <Ionicons
            name="document-outline"
            size={48}
            color={colors.textMuted}
            style={{ marginBottom: spacing.lg }}
          />
          <Text style={styles.errorTitle}>Article not found</Text>
          <TouchableOpacity style={styles.backBtnLarge} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navIconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.navTitle} numberOfLines={1}>
          {article.categoryName || 'Article'}
        </Text>

        <View style={styles.navRight}>
          {/* Font size controls (HTML only) */}
          {!hasPdf && (
            <FontSizeControls index={fontSizeIdx} onChange={setFontSizeIdx} />
          )}
          <TouchableOpacity
            style={styles.navIconBtn}
            onPress={handleShare}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {hasPdf ? (
        /* ── PDF full-screen mode ─────────────────────────────────────────── */
        <>
          <PdfViewer
            fileUrl={article.fileUrl!}
            accent={accent}
            authToken={authToken}
            onLoadSuccess={handlePdfLoadSuccess}
          />
        </>
      ) : (
        /* ── HTML reading mode ────────────────────────────────────────────── */
        <>
          <ReadingProgressBar percent={scrollPercent} accent={accent} />

          {/* Reading time remaining — appears once user starts scrolling */}
          {scrollPercent > 2 && minutesRemaining !== null && (
            <View style={styles.timeRemainingBar}>
              <Ionicons name="book-outline" size={12} color={accent} />
              <Text style={[styles.timeRemainingText, { color: accent }]}>
                {minutesRemaining === 1
                  ? 'Less than 1 min remaining'
                  : `~${minutesRemaining} min remaining`}
              </Text>
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + 80 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={100}
          >
            <ArticleHeader article={article} />
            <HtmlContent html={article.content} fontSize={fontSize} />

            {/* End-of-article marker */}
            {scrollPercent >= 90 && (
              <View style={styles.finishedBanner}>
                <Ionicons name="checkmark-circle" size={20} color={accent} />
                <Text style={[styles.finishedText, { color: accent }]}>
                  Article complete
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: READER_BG },

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: spacing.sm,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Font size controls
  fontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  fontBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontBtnDisabled: { opacity: 0.35 },
  fontBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
    lineHeight: 20,
  },

  // Progress + time remaining
  progressBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  progressFill: { height: 2, borderRadius: 1 },
  timeRemainingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.xl,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  timeRemainingText: { fontSize: 11, fontWeight: '600' },

  // HTML scroll
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: spacing.xl },

  // Finished banner
  finishedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  finishedText: { fontSize: 14, fontWeight: '700' },

  // Article header
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
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },
  articleExcerpt: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 16,
    lineHeight: 25,
    fontStyle: 'italic',
    marginBottom: spacing.lg,
  },
  articleMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaChipText: { color: colors.textMuted, fontSize: 12 },
  divider: { height: 1, marginVertical: spacing.md },

  // HTML blocks
  h1: {
    color: '#FFFFFF',
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.2,
    marginTop: 28,
    marginBottom: spacing.md,
  },
  h2: {
    color: '#FFFFFFCC',
    fontWeight: '700',
    lineHeight: 28,
    marginTop: 24,
    marginBottom: spacing.sm,
  },
  h3: {
    color: '#FFFFFF99',
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 20,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  paragraph: {
    color: 'rgba(255,255,255,0.82)',
    marginBottom: 18,
    letterSpacing: 0.15,
  },
  liRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 10, paddingLeft: spacing.sm },
  liBullet: { color: colors.primary, fontWeight: '700' },
  liText: { flex: 1, color: 'rgba(255,255,255,0.82)', letterSpacing: 0.15 },
  noContent: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.xxl,
  },

  // PDF full-screen viewer
  pdfFullWrap: { flex: 1, backgroundColor: READER_BG, position: 'relative' },
  pdfWebView: { flex: 1, backgroundColor: READER_BG },

  // PDF loading overlay (shown while RN is downloading bytes)
  pdfLoaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: READER_BG,
    gap: spacing.md,
  },
  pdfLoaderRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pdfLoaderText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },

  // PDF error state
  pdfErrorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    backgroundColor: READER_BG,
    gap: spacing.sm,
  },
  pdfErrorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pdfErrorTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pdfErrorSub: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
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
  pdfRetryLinkText: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  loadingText: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.xl,
  },
  backBtnLarge: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  backBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
