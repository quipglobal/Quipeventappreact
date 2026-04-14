import React, { useRef, useState, useCallback } from 'react';
import { Heart, MessageSquare, Share2, Play, Volume2, VolumeX, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '@/app/context/ThemeContext';
import { FeedVideoPost as FeedVideoPostType } from '@/app/data/mockFeed';
import { useApp } from '@/app/context/AppContext';
import { markVideoWatchedApi } from '@/app/api/feedClient';

interface FeedVideoPostProps {
  post: FeedVideoPostType;
}

export const FeedVideoPost: React.FC<FeedVideoPostProps> = ({ post }) => {
  const { t } = useTheme();
  const { addPoints, showToast, eventConfig } = useApp();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [hasEarned, setHasEarned] = useState(false);
  const [showEarnedBurst, setShowEarnedBurst] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showOverlay, setShowOverlay] = useState(true);

  const handlePlayPause = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
      setShowOverlay(false);
    } else {
      vid.pause();
      setIsPlaying(false);
      setShowOverlay(true);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const pct = vid.currentTime / vid.duration;
    setProgress(pct * 100);

    if (!hasEarned && pct >= 0.8) {
      setHasEarned(true);
      setShowEarnedBurst(true);
      addPoints(post.pointsReward, `Watched "${post.user.name}" video`);
      showToast(`+${post.pointsReward} pts for watching!`, post.pointsReward);
      setTimeout(() => setShowEarnedBurst(false), 2200);
      markVideoWatchedApi(eventConfig.eventId, post.id, post.pointsReward).catch(() => {/* silent */});
    }
  }, [hasEarned, addPoints, showToast, post.pointsReward, post.user.name, post.id, eventConfig.eventId]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setShowOverlay(true);
    setProgress(100);
  }, []);

  const handleLike = () => {
    if (!isLiked) {
      setIsLiked(true);
      setLikesCount(p => p + 1);
      if (Math.random() > 0.7) addPoints(1, 'Liked a video');
    } else {
      setIsLiked(false);
      setLikesCount(p => p - 1);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsMuted(vid.muted);
  };

  return (
    <div className="mb-4">
      <div className="rounded-3xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>

        {/* Header */}
        <div className="flex items-start justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ background: t.surface2 }}>
              <img src={post.user.avatar} alt={post.user.name} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight" style={{ color: t.text }}>{post.user.name}</h3>
              <p className="text-xs" style={{ color: t.textSec }}>{post.user.title}</p>
              <p className="text-[10px]" style={{ color: t.textMuted }}>{post.timestamp}</p>
            </div>
          </div>

          {/* Points reward badge */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-full"
            style={{
              background: hasEarned ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.13)',
              border: `1px solid ${hasEarned ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
            }}
          >
            <Star size={11} fill={hasEarned ? '#10b981' : '#f59e0b'} color={hasEarned ? '#10b981' : '#f59e0b'} />
            <span className="text-[10px] font-bold" style={{ color: hasEarned ? '#10b981' : '#f59e0b' }}>
              {hasEarned ? `+${post.pointsReward} earned!` : `+${post.pointsReward} pts`}
            </span>
          </div>
        </div>

        {/* Caption */}
        <p className="text-sm leading-relaxed px-4 pb-3" style={{ color: t.text }}>
          {post.content}
        </p>

        {/* Video Player */}
        <div className="relative mx-4 mb-4 rounded-2xl overflow-hidden cursor-pointer" style={{ background: '#000' }} onClick={handlePlayPause}>
          <video
            ref={videoRef}
            src={post.videoUrl}
            poster={post.thumbnail}
            muted={isMuted}
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            className="w-full object-cover"
            style={{ maxHeight: 280, display: 'block' }}
          />

          {/* Duration badge */}
          {!isPlaying && (
            <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
              {post.duration}
            </div>
          )}

          {/* Play/pause overlay */}
          <AnimatePresence>
            {showOverlay && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              >
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.35)' }}
                >
                  <Play size={26} fill="white" color="white" style={{ marginLeft: 3 }} />
                </motion.div>

                {/* Earn prompt on overlay */}
                {!hasEarned && (
                  <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,158,11,0.4)' }}>
                      <Star size={12} fill="#f59e0b" color="#f59e0b" />
                      <span className="text-[11px] font-semibold text-white">Watch to earn +{post.pointsReward} pts</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mute toggle (visible while playing) */}
          {isPlaying && (
            <button
              onClick={toggleMute}
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            >
              {isMuted
                ? <VolumeX size={14} color="white" />
                : <Volume2 size={14} color="white" />
              }
            </button>
          )}

          {/* Points earned burst */}
          <AnimatePresence>
            {showEarnedBurst && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.1, y: -16 }}
                transition={{ type: 'spring', stiffness: 340, damping: 22 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl"
                  style={{ background: 'rgba(16,185,129,0.92)', backdropFilter: 'blur(12px)' }}>
                  <span className="text-3xl">🎉</span>
                  <span className="text-white font-black text-xl">+{post.pointsReward} pts!</span>
                  <span className="text-green-100 text-xs font-medium">Thanks for watching</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="mx-4 mb-3 h-1 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: hasEarned
                ? 'linear-gradient(90deg,#10b981,#34d399)'
                : 'linear-gradient(90deg,#7c3aed,#4f46e5)',
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 pb-4 pt-1 border-t" style={{ borderColor: t.divider }}>
          <button onClick={handleLike} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5">
            <Heart size={18} fill={isLiked ? '#ec4899' : 'none'} color={isLiked ? '#ec4899' : t.textSec} />
            <span className="text-xs font-medium" style={{ color: isLiked ? '#ec4899' : t.textSec }}>{likesCount}</span>
          </button>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5">
            <MessageSquare size={18} color={t.textSec} />
            <span className="text-xs font-medium" style={{ color: t.textSec }}>{post.comments.length}</span>
          </button>
          <button className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5">
            <Share2 size={18} color={t.textSec} />
            <span className="text-xs font-medium" style={{ color: t.textSec }}>{post.shares}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
