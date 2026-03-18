import React from 'react';
import { FeedVideoPost } from './FeedVideoPost';
import { FeedPoll } from './FeedPoll';
import { mockFeedItems, FeedVideoPost as FeedVideoPostType, FeedPoll as FeedPollType } from '@/app/data/mockFeed';
import { useTheme } from '@/app/context/ThemeContext';

interface SocialFeedProps {
  onNavigate?: (page: string) => void;
}

export const SocialFeed: React.FC<SocialFeedProps> = () => {
  const { t } = useTheme();

  const feedItems = mockFeedItems.filter(
    item => item.type === 'video' || item.type === 'poll'
  );

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

      <div className="py-8 text-center">
        <div className="w-12 h-1 rounded-full mx-auto mb-3" style={{ background: t.surface2 }} />
        <p className="text-xs font-medium" style={{ color: t.textMuted }}>
          You're all caught up!
        </p>
      </div>
    </div>
  );
};
