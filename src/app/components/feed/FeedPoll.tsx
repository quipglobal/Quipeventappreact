import React, { useState } from 'react';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '@/app/context/ThemeContext';
import { FeedPoll as FeedPollType } from '@/app/data/mockFeed';
import { useApp } from '@/app/context/AppContext';

interface FeedPollProps {
  poll: FeedPollType;
}

export const FeedPoll: React.FC<FeedPollProps> = ({ poll }) => {
  const { t } = useTheme();
  const { addPoints } = useApp();
  const [hasVoted, setHasVoted] = useState(poll.hasVoted);
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(poll.userVotedOptionId);
  const [totalVotes, setTotalVotes] = useState(poll.totalVotes);
  const [liveOptions, setLiveOptions] = useState(poll.options);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVote = async (optionId: string) => {
    if (hasVoted || isSubmitting) return;

    setIsSubmitting(true);
    const updatedOptions = liveOptions.map(o =>
      o.id === optionId ? { ...o, votes: o.votes + 1 } : o
    );
    setLiveOptions(updatedOptions);
    setTotalVotes(totalVotes + 1);
    setHasVoted(true);
    setSelectedOptionId(optionId);
    addPoints(10, 'Voted in a poll');
    setIsSubmitting(false);
  };

  return (
    <div className="mb-4">
      <div className="p-5 rounded-3xl relative overflow-hidden" 
        style={{ 
          background: `linear-gradient(135deg, ${t.surface}, ${t.surface}) padding-box, linear-gradient(135deg, ${t.accent}, #ec4899) border-box`,
          border: '1px solid transparent',
          boxShadow: t.shadow
        }}>
        
        {/* Poll Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg" style={{ background: t.accentBg }}>
                <BarChart3 size={14} color={t.accent} />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.accent }}>Live Poll</span>
            </div>
            <h3 className="text-base font-bold leading-snug" style={{ color: t.text }}>{poll.question}</h3>
          </div>
          <span className="text-xs font-medium opacity-60" style={{ color: t.textSec }}>{poll.timestamp}</span>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {liveOptions.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const percentage = hasVoted ? Math.round((option.votes / totalVotes) * 100) : 0;
            
            return (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                disabled={hasVoted || isSubmitting}
                className="w-full relative group"
              >
                {/* Background Progress Bar (Visible after vote) */}
                <div className="absolute inset-0 rounded-xl transition-all duration-1000 ease-out overflow-hidden"
                   style={{ background: t.surface2 }}>
                  {hasVoted && (
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full opacity-20"
                      style={{ background: isSelected ? t.accent : t.textMuted }}
                    />
                  )}
                </div>

                {/* Option Content */}
                <div className={`relative px-4 py-3 rounded-xl border flex items-center justify-between transition-all ${
                  hasVoted ? 'border-transparent' : 'hover:border-violet-500/50'
                }`}
                style={{ 
                  borderColor: isSelected ? t.accent : t.border,
                }}>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-violet-600 border-violet-600' : ''
                    }`} style={{ borderColor: isSelected ? t.accent : t.textMuted }}>
                      {isSelected && <CheckCircle2 size={10} color="white" />}
                    </div>
                    <span className="text-sm font-medium text-left" style={{ color: t.text }}>{option.text}</span>
                  </div>
                  
                  {hasVoted && (
                    <span className="text-sm font-bold" style={{ color: isSelected ? t.accent : t.textSec }}>
                      {percentage}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-xs" style={{ color: t.textMuted }}>
          <span>{totalVotes} votes</span>
          {!hasVoted && <span>+10 points for voting</span>}
        </div>
      </div>
    </div>
  );
};
