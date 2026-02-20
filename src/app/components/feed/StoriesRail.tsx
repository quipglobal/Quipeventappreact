import React from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { mockStories } from '@/app/data/mockFeed';

export const StoriesRail: React.FC = () => {
  const { t } = useTheme();

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-4 pl-4 select-none">
      <div className="flex items-start gap-4 pr-4">
        {/* My Story / Add Story */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
          <div className="relative w-[68px] h-[68px]">
            <div className="absolute inset-0 rounded-full p-[2px]" 
              style={{ border: `2px dashed ${t.accentSoft}` }}>
              <div className="w-full h-full rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                <div className="w-full h-full flex items-center justify-center">
                  <Plus style={{ color: t.accent, width: 24, height: 24 }} />
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center border-2"
              style={{ background: t.accent, borderColor: t.bgPage }}>
              <Plus style={{ color: '#fff', width: 14, height: 14 }} strokeWidth={3} />
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.textSec }}>My Story</span>
        </div>

        {/* Other Stories */}
        {mockStories.map((story) => (
          <div key={story.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
            <div className="relative w-[68px] h-[68px] p-[2px] rounded-full"
              style={{ 
                background: story.hasUnseen 
                  ? `linear-gradient(135deg, ${t.accent}, #ec4899)` 
                  : t.border 
              }}>
              <div className="w-full h-full rounded-full border-2 overflow-hidden" style={{ borderColor: t.bgPage }}>
                <img 
                  src={story.user.avatar} 
                  alt={story.user.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                />
              </div>
              {story.user.isLive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold text-white tracking-wide uppercase border-2"
                  style={{ background: '#ef4444', borderColor: t.bgPage }}>
                  Live
                </div>
              )}
            </div>
            <span className="max-w-[72px] truncate" style={{ fontSize: 11, fontWeight: 500, color: story.hasUnseen ? t.text : t.textSec }}>
              {story.user.name.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
