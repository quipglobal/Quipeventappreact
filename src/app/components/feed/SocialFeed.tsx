import React from 'react';
import { FeedVideoPost } from './FeedVideoPost';
import { mockFeedItems } from '@/app/data/mockFeed';
import { useTheme } from '@/app/context/ThemeContext';
import { Video } from 'lucide-react';

interface SocialFeedProps {
  onNavigate?: (page: string) => void;
}

export const SocialFeed: React.FC<SocialFeedProps> = () => {
  const { t } = useTheme();

  const videoItems = mockFeedItems.filter(item => item.type === 'video') as Extract<
    (typeof mockFeedItems)[number],
    { type: 'video' }
  >[];

  return (
    <div className="pb-28">
      {/* Section label */}
      <div className="flex items-center gap-2 px-4 pt-2 pb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
          <Video size={14} color="white" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: t.textMuted, letterSpacing: '0.1em' }}>
            Event Videos
          </p>
          <p className="text-[10px]" style={{ color: t.textMuted }}>
            {videoItems.length} video{videoItems.length !== 1 ? 's' : ''} · Watch to earn points
          </p>
        </div>
      </div>

      {/* Video posts */}
      <div className="px-4 space-y-4">
        {videoItems.map(item => (
          <FeedVideoPost key={item.id} post={item} />
        ))}
      </div>

      {/* End indicator */}
      <div className="py-8 text-center">
        <div className="w-12 h-1 rounded-full mx-auto mb-3" style={{ background: t.surface2 }} />
        <p className="text-xs font-medium" style={{ color: t.textMuted }}>
          You're all caught up!
        </p>
      </div>
    </div>
  );
};
