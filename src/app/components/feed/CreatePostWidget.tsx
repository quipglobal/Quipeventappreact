import React, { useState } from 'react';
import { Image, Send, Smile, Calendar } from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';

export const CreatePostWidget: React.FC = () => {
  const { t } = useTheme();
  const { user, addPoints } = useApp();
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handlePost = () => {
    if (!content.trim()) return;
    
    // Simulate posting logic
    addPoints(15, 'Shared a post');
    setContent('');
    setIsFocused(false);
  };

  if (!user) return null;

  return (
    <div className="px-4 mb-2">
      <div className="rounded-2xl p-4 transition-all duration-300"
        style={{ 
          background: t.surface, 
          boxShadow: isFocused ? t.shadowHov : t.shadow, 
          border: `1px solid ${isFocused ? t.borderAcc : t.border}` 
        }}>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gray-200">
             {/* If user has avatar, use it, else fallback */}
             {user.avatar ? (
               <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center bg-violet-500 text-white font-bold">
                 {user.name.charAt(0)}
               </div>
             )}
          </div>
          <div className="flex-1">
            <textarea
              placeholder="Start a conversation about an event..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => !content && setIsFocused(false)}
              className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-opacity-50"
              style={{ color: t.text, minHeight: isFocused ? 80 : 40 }}
            />
            
            {/* Actions Bar */}
            <div className={`flex items-center justify-between mt-2 pt-2 border-t transition-opacity duration-200 ${isFocused || content ? 'opacity-100' : 'opacity-60'}`}
              style={{ borderColor: t.border }}>
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
                  <Image style={{ width: 18, height: 18, color: t.accent }} />
                </button>
                <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
                  <Calendar style={{ width: 18, height: 18, color: t.accent }} />
                </button>
                <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
                  <Smile style={{ width: 18, height: 18, color: t.accent }} />
                </button>
              </div>
              <button 
                onClick={handlePost}
                disabled={!content.trim()}
                className="px-4 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                style={{ background: content.trim() ? t.accent : t.textMuted }}>
                <span>Post</span>
                <Send style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
