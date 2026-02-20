import React from 'react';
import { StoriesRail } from './StoriesRail';
import { CreatePostWidget } from './CreatePostWidget';
import { FeedPost } from './FeedPost';
import { FeedPoll } from './FeedPoll';
import { mockFeedItems } from '@/app/data/mockFeed';
import { useTheme } from '@/app/context/ThemeContext';

interface SocialFeedProps {
  onNavigate?: (page: string) => void;
}

export const SocialFeed: React.FC<SocialFeedProps> = ({ onNavigate }) => {
  const { t } = useTheme();

  return (
    <div className="pb-24">
      {/* Stories Rail */}
      <div className="mb-2 bg-transparent">
        <StoriesRail />
      </div>

      {/* Create Post Widget */}
      <CreatePostWidget />

      {/* Feed Stream */}
      <div className="px-4 space-y-4">
        {mockFeedItems.map((item) => {
          if (item.type === 'poll') {
            return <FeedPoll key={item.id} poll={item} />;
          }
          return <FeedPost key={item.id} post={item} />;
        })}
      </div>

      {/* End of Feed Message */}
      <div className="py-8 text-center">
        <div className="w-12 h-1 rounded-full mx-auto mb-3" style={{ background: t.surface2 }} />
        <p className="text-xs font-medium" style={{ color: t.textMuted }}>
          You're all caught up!
        </p>
      </div>
    </div>
  );
};
