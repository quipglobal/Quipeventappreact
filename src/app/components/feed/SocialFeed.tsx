import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FeedVideoPost } from './FeedVideoPost';
import { FeedPoll } from './FeedPoll';
import { FeedVideoPost as FeedVideoPostType, FeedPoll as FeedPollType, FeedItem } from '@/app/data/mockFeed';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';
import { getFeedApi } from '@/app/api/feedClient';
import { Loader2, Video, AlertTriangle, RefreshCw } from 'lucide-react';

// ─── Responsive page size ─────────────────────────────────────────────────────

/**
 * Returns the appropriate initial page size based on the current viewport width:
 *   < 768px  → 4  (mobile)
 *   768–1023 → 6  (tablet)
 *   ≥ 1024px → 10 (desktop)
 *
 * Respects navigator.connection?.saveData for data-saving mode (always 4).
 */
function getPageSize(): number {
  if (typeof window === 'undefined') return 10;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') return 4;
  const w = window.innerWidth;
  if (w < 768) return 4;
  if (w < 1024) return 6;
  return 10;
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonVideoCard() {
  return (
    <div
      className="mb-4 rounded-3xl overflow-hidden animate-pulse"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      aria-hidden="true"
    >
      <div className="p-4 pb-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded w-32" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="h-2.5 rounded w-24" style={{ background: 'rgba(255,255,255,0.07)' }} />
        </div>
      </div>
      <div className="h-3 mx-4 mb-3 rounded" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <div className="mx-4 mb-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.08)', height: 200 }} />
      <div className="h-1 mx-4 mb-4 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SocialFeedProps {
  onNavigate?: (page: string) => void;
}

export const SocialFeed: React.FC<SocialFeedProps> = () => {
  const { t } = useTheme();
  const { eventConfig } = useApp();

  // Compute page size once on mount (stable — viewport doesn't change mid-session)
  const [pageSize] = useState<number>(getPageSize);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs — don't trigger re-renders, used for synchronous guards
  const abortRef = useRef<AbortController | null>(null);
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const isLoadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Track current page in a ref too so the IntersectionObserver callback
  // always reads the latest value without needing it as a dependency.
  const pageRef = useRef(1);

  // ─── Core fetch ────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (
    pageNum: number,
    append: boolean,
    signal?: AbortSignal,
  ): Promise<boolean> => {
    try {
      const res = await getFeedApi(eventConfig.eventId, pageNum, pageSize, signal);

      if (signal?.aborted) return false;

      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Failed to load video feeds');
      }

      // Deduplicate by video ID across pages
      const deduped = res.data.items.filter(item => {
        if (loadedIdsRef.current.has(item.id)) return false;
        loadedIdsRef.current.add(item.id);
        return true;
      });

      setItems(prev => append ? [...prev, ...deduped] : deduped);
      setHasMore(res.data.hasMore);
      setError(null);
      return res.data.hasMore;
    } catch (err) {
      if (signal?.aborted) return false;
      const msg = err instanceof Error ? err.message : 'Failed to load video feeds';
      setError(msg);
      return false;
    }
  }, [eventConfig.eventId, pageSize]);

  // ─── Initial load / event change ───────────────────────────────────────────

  useEffect(() => {
    // Cancel any in-flight request from a previous event
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setItems([]);
    setPage(1);
    pageRef.current = 1;
    setHasMore(false);
    setError(null);
    loadedIdsRef.current = new Set();
    isLoadingMoreRef.current = false;

    fetchPage(1, false, ctrl.signal).finally(() => {
      if (!ctrl.signal.aborted) setLoading(false);
    });

    return () => {
      ctrl.abort();
    };
  }, [fetchPage]);

  // ─── IntersectionObserver — infinite scroll ─────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    // If no more pages exist, nothing to observe
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        if (isLoadingMoreRef.current) return;
        // Re-check hasMore here through the closure; the outer effect will
        // re-run and re-create this observer whenever hasMore changes.
        if (!hasMore) return;

        isLoadingMoreRef.current = true;
        setLoadingMore(true);

        const next = pageRef.current + 1;
        fetchPage(next, true).then(() => {
          pageRef.current = next;
          setPage(next);
          isLoadingMoreRef.current = false;
          setLoadingMore(false);
        });
      },
      { rootMargin: '300px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, fetchPage]);

  // ─── Manual load more (fallback for no IntersectionObserver) ───────────────

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore) return;
    isLoadingMoreRef.current = true;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    await fetchPage(next, true);
    pageRef.current = next;
    setPage(next);
    isLoadingMoreRef.current = false;
    setLoadingMore(false);
  }, [hasMore, fetchPage]);

  // ─── Retry ─────────────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setPage(1);
    pageRef.current = 1;
    loadedIdsRef.current = new Set();
    isLoadingMoreRef.current = false;

    fetchPage(1, false, ctrl.signal).finally(() => {
      if (!ctrl.signal.aborted) setLoading(false);
    });
  }, [fetchPage]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  const feedItems = useMemo(
    () => items.filter(item => item.type === 'video' || item.type === 'poll'),
    [items],
  );

  // ─── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="pb-28 pt-3 px-4" aria-live="polite" aria-label="Loading video feed">
        {Array.from({ length: pageSize }).map((_, i) => (
          <SkeletonVideoCard key={i} />
        ))}
        <span className="sr-only">Loading video feed…</span>
      </div>
    );
  }

  if (error && feedItems.length === 0) {
    return (
      <div className="pb-28 pt-3 px-4 flex flex-col items-center justify-center py-16 gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertTriangle size={28} color="#ef4444" />
        </div>
        <div className="text-center">
          <p className="font-bold text-sm mb-1" style={{ color: t.text }}>Couldn't load videos</p>
          <p className="text-xs leading-relaxed max-w-xs" style={{ color: t.textMuted }}>{error}</p>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl text-xs font-semibold active:scale-[0.97] transition-transform"
          style={{ background: t.accentBg, color: t.accentSoft }}
          aria-label="Retry loading video feed"
        >
          <RefreshCw size={13} />
          Retry
        </button>
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="pb-28 pt-3 px-4 flex flex-col items-center justify-center py-16 gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}
        >
          <Video size={28} color="#7c3aed" />
        </div>
        <div className="text-center">
          <p className="font-bold text-sm mb-1" style={{ color: t.text }}>No videos yet</p>
          <p className="text-xs leading-relaxed max-w-xs" style={{ color: t.textMuted }}>
            Video sessions for this event will appear here once they are published by the organiser.
          </p>
        </div>
        <button
          onClick={handleRetry}
          className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold"
          style={{ background: t.accentBg, color: t.accentSoft }}
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-3">
      <div className="px-4 space-y-4">
        {feedItems.map(item => {
          if (item.type === 'video') {
            return <FeedVideoPost key={item.id} post={item as FeedVideoPostType} />;
          }
          if (item.type === 'poll') {
            return <FeedPoll key={item.id} poll={item as FeedPollType} />;
          }
          return null;
        })}
      </div>

      {/* Sentinel — IntersectionObserver attaches here, 300px rootMargin
          fires the next-page fetch before the user reaches the absolute bottom */}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />

      {/* Loading-more spinner (non-blocking) */}
      {loadingMore && (
        <div
          className="py-4 flex justify-center"
          aria-live="polite"
          aria-label="Loading more videos"
        >
          <Loader2
            style={{ width: 20, height: 20 }}
            className="animate-spin"
            color={t.accentSoft ?? '#7c3aed'}
          />
          <span className="sr-only">Loading more videos…</span>
        </div>
      )}

      {/* Bottom bar — manual Load More fallback + end-of-feed message */}
      {!loadingMore && (
        <div className="py-8 text-center px-4">
          {hasMore ? (
            <button
              onClick={handleLoadMore}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl font-semibold active:scale-[0.97] transition-transform"
              style={{ background: t.accentBg, color: t.accentSoft }}
              aria-label="Load more videos"
            >
              Load more
            </button>
          ) : (
            <>
              <div className="w-12 h-1 rounded-full mx-auto mb-3" style={{ background: t.surface2 }} />
              <p className="text-xs font-medium" style={{ color: t.textMuted }}>
                You've reached the end of the video feed.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
