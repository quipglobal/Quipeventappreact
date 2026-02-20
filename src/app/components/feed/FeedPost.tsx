import React, { useState } from 'react';
import { Heart, MessageSquare, Share2, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@/app/context/ThemeContext';
import { FeedPost as FeedPostType } from '@/app/data/mockFeed';
import { useApp } from '@/app/context/AppContext';

interface FeedPostProps {
  post: FeedPostType;
}

export const FeedPost: React.FC<FeedPostProps> = ({ post }) => {
  const { t } = useTheme();
  const { addPoints } = useApp();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showHeartAnim, setShowHeartAnim] = useState(false);

  const handleLike = () => {
    if (!isLiked) {
      setIsLiked(true);
      setLikesCount(prev => prev + 1);
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 1000);
      // Small gamification reward occasionally?
      if (Math.random() > 0.7) addPoints(1, 'Liked a post'); 
    } else {
      setIsLiked(false);
      setLikesCount(prev => prev - 1);
    }
  };

  return (
    <div className="mb-4 bg-transparent">
      <div className="p-4 rounded-3xl" style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: t.surface2 }}>
              <img src={post.user.avatar} alt={post.user.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight" style={{ color: t.text }}>{post.user.name}</h3>
              <p className="text-xs truncate max-w-[180px]" style={{ color: t.textSec }}>{post.user.title}</p>
              <p className="text-[10px]" style={{ color: t.textMuted }}>{post.timestamp}</p>
            </div>
          </div>
          <button className="p-1 rounded-full hover:bg-white/5" style={{ color: t.textMuted }}>
            <MoreHorizontal size={18} />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm mb-3 leading-relaxed whitespace-pre-wrap" style={{ color: t.text }}>
          {post.content}
        </p>

        {/* Image Attachment */}
        {post.image && (
          <div className="relative mb-4 rounded-2xl overflow-hidden group cursor-pointer">
            <img src={post.image} alt="Post attachment" className="w-full h-auto object-cover max-h-[300px]" />
            {/* Heart Overlay Animation */}
            <AnimatePresence>
              {showHeartAnim && (
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <Heart fill="#ec4899" color="#ec4899" size={80} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: t.divider }}>
          <button 
            onClick={handleLike}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors hover:bg-white/5 group"
          >
            <div className={`transition-transform duration-200 ${isLiked ? 'scale-110' : 'group-active:scale-90'}`}>
              <Heart 
                size={18} 
                fill={isLiked ? '#ec4899' : 'none'} 
                color={isLiked ? '#ec4899' : t.textSec} 
              />
            </div>
            <span className="text-xs font-medium" style={{ color: isLiked ? '#ec4899' : t.textSec }}>
              {likesCount}
            </span>
          </button>

          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors hover:bg-white/5">
            <MessageSquare size={18} color={t.textSec} />
            <span className="text-xs font-medium" style={{ color: t.textSec }}>
              {post.comments.length}
            </span>
          </button>

          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors hover:bg-white/5">
            <Share2 size={18} color={t.textSec} />
            <span className="text-xs font-medium" style={{ color: t.textSec }}>
              {post.shares}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
