import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, TrendingUp, Clock } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { mockPolls } from '@/app/data/mockData';

interface PollsListPageProps {
  onBack: () => void;
}

export const PollsListPage: React.FC<PollsListPageProps> = ({ onBack }) => {
  const { votedPolls, setVotedPolls, addPoints, gamificationConfig } = useApp();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const handleVote = (pollId: string) => {
    if (!votedPolls.includes(pollId) && selectedOptions[pollId]) {
      setVotedPolls([...votedPolls, pollId]);
      addPoints(gamificationConfig.pointActions.votePoll, 'Poll vote submitted!');
    }
  };

  const getTotalVotes = (poll: typeof mockPolls[0]) => {
    return poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-600 px-6 pt-12 pb-8 text-white sticky top-0 z-10">
        <button onClick={onBack} className="mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold mb-1">Live Polls</h1>
        <p className="text-white/90 text-sm">Vote to earn +{gamificationConfig.pointActions.votePoll} points per poll</p>
      </div>

      {/* Polls List */}
      <div className="px-6 py-6 space-y-6">
        {mockPolls.map((poll) => {
          const hasVoted = votedPolls.includes(poll.id);
          const totalVotes = getTotalVotes(poll);
          const userSelection = selectedOptions[poll.id];

          return (
            <div key={poll.id} className="bg-white rounded-2xl shadow-md p-6">
              {/* Poll Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {poll.isLive && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        <span>LIVE</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{poll.title}</h3>
                  <p className="text-sm text-gray-600">{poll.description}</p>
                </div>
                {hasVoted && (
                  <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                )}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-4">
                {poll.options.map((option) => {
                  const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                  const isSelected = userSelection === option.id;
                  const isWinning = hasVoted && option.votes === Math.max(...poll.options.map(o => o.votes));

                  return (
                    <button
                      key={option.id}
                      onClick={() => !hasVoted && setSelectedOptions({ ...selectedOptions, [poll.id]: option.id })}
                      disabled={hasVoted}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all relative overflow-hidden ${
                        hasVoted
                          ? 'cursor-default'
                          : isSelected
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {/* Background bar for results */}
                      {hasVoted && (
                        <div
                          className={`absolute inset-0 transition-all ${
                            isWinning ? 'bg-purple-100' : 'bg-gray-50'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      )}

                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          {!hasVoted && isSelected && (
                            <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                          {!hasVoted && !isSelected && (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0" />
                          )}
                          <span className={`font-medium ${
                            hasVoted ? 'text-gray-900' : isSelected ? 'text-purple-600' : 'text-gray-700'
                          }`}>
                            {option.text}
                          </span>
                        </div>
                        {hasVoted && (
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm text-gray-600">{option.votes.toLocaleString()}</span>
                            <span className="text-sm font-bold text-purple-600 min-w-[3rem] text-right">
                              {percentage}%
                            </span>
                            {isWinning && (
                              <TrendingUp className="w-4 h-4 text-purple-600" />
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                {hasVoted ? (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Total votes: {totalVotes.toLocaleString()}</span>
                  </p>
                ) : (
                  <p className="text-sm font-medium text-emerald-600">
                    +{poll.rewardPoints} points
                  </p>
                )}

                {!hasVoted && (
                  <button
                    onClick={() => handleVote(poll.id)}
                    disabled={!userSelection}
                    className="px-6 py-2 rounded-xl font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Vote
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
