import React, { useEffect, useState, useCallback } from 'react';
import { FeedVideoPost } from './FeedVideoPost';
import { FeedPoll } from './FeedPoll';
import { FeedVideoPost as FeedVideoPostType, FeedPoll as FeedPollType, FeedItem } from '@/app/data/mockFeed';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';
import { getFeedApi } from '@/app/api/feedClient';
import { DataState } from '@/app/components/ui/DataState';
import { Loader2, Video } from 'lucide-react';

interface SocialFeedProps {
  onNavigate?: (page: string) => void;
}

export const SocialFeed: React.FC<SocialFeedProps> = () => {
  const { t } = useTheme();
  const { eventConfig } = useApp();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (pageNum: number, append = false) => {
    try {
      const res = await getFeedApi(eventConfig.eventId, pageNum);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message ?? 'Failed to load video feeds');
      }
      setItems(prev => append ? [...prev, ...res.data!.items] : res.data!.items);
      setHasMore(res.data.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video feeds');
    }
  }, [eventConfig.eventId]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    setPage(1);
    setHasMore(false);
    fetchPage(1, false).finally(() => setLoading(false));
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setLoadingMore(true);
    await fetchPage(next, true);
    setPage(next);
    setLoadingMore(false);
  };

  const handleRetry = () => {
    setLoading(true);
    setPage(1);
    fetchPage(1, false).finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="pb-28 pt-3 px-4">
        <DataState loading loadingRows={3} />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="pb-28 pt-3">
        <DataState error={error} onRetry={handleRetry} />
      </div>
    );
  }

  const feedItems = items.filter(item => item.type === 'video' || item.type === 'poll');

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

      {/* Load more / end state */}
      <div className="py-8 text-center px-4">
        {hasMore ? (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl font-semibold active:scale-[0.97] transition-transform"
            style={{ background: t.accentBg, color: t.accentSoft }}
          >
            {loadingMore
              ? <><Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />Loading…</>
              : 'Load more'}
          </button>
        ) : (
          <>
            <div className="w-12 h-1 rounded-full mx-auto mb-3" style={{ background: t.surface2 }} />
            <p className="text-xs font-medium" style={{ color: t.textMuted }}>
              You're all caught up!
            </p>
          </>
        )}
      </div>
    </div>
  );
};
