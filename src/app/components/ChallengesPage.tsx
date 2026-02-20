import React from 'react';
import { ArrowLeft, Trophy, Target, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { mockChallenges } from '@/app/data/mockData';

interface ChallengesPageProps {
  onBack: () => void;
}

export const ChallengesPage: React.FC<ChallengesPageProps> = ({ onBack }) => {
  const { completedChallenges, completedSurveys, votedPolls, metSponsors, bookmarkedSessions, completeChallenge } = useApp();

  const getChallengeProgress = (challenge: typeof mockChallenges[0]) => {
    switch (challenge.type) {
      case 'sponsor_visits':
        return Math.min(metSponsors.length, challenge.target);
      case 'survey_completion':
        return Math.min(completedSurveys.length, challenge.target);
      case 'poll_votes':
        return Math.min(votedPolls.length, challenge.target);
      case 'session_attendance':
        return Math.min(bookmarkedSessions.length, challenge.target);
      default:
        return 0;
    }
  };

  const activeChallenges = mockChallenges.map(challenge => ({
    ...challenge,
    progress: getChallengeProgress(challenge),
    completed: completedChallenges.includes(challenge.id) || getChallengeProgress(challenge) >= challenge.target,
  }));

  const handleClaimReward = (challengeId: string) => {
    const challenge = activeChallenges.find(c => c.id === challengeId);
    if (challenge && challenge.progress >= challenge.target && !completedChallenges.includes(challengeId)) {
      completeChallenge(challengeId);
    }
  };

  const activeCount = activeChallenges.filter(c => !c.completed).length;
  const completedCount = activeChallenges.filter(c => c.completed).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 px-6 pt-12 pb-8 text-white sticky top-0 z-10">
        <button onClick={onBack} className="mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Challenges</h1>
        </div>
        <p className="text-white/90 text-sm">Complete challenges for bonus points</p>
      </div>

      {/* Stats */}
      <div className="px-6 -mt-4 mb-6">
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{activeCount}</p>
              <p className="text-sm text-gray-600">Active</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-600">{completedCount}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Challenges List */}
      <div className="px-6 space-y-4">
        {activeChallenges.map((challenge) => {
          const progressPercentage = (challenge.progress / challenge.target) * 100;
          const canClaim = challenge.progress >= challenge.target && !completedChallenges.includes(challenge.id);

          return (
            <div
              key={challenge.id}
              className={`bg-white rounded-2xl shadow-md p-6 ${
                challenge.completed ? 'opacity-75' : ''
              }`}
            >
              {/* Challenge Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-lg">{challenge.title}</h3>
                    {challenge.completed && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{challenge.description}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Target className="w-4 h-4" />
                    <span>Progress: {challenge.progress}/{challenge.target}</span>
                  </div>
                  <span className="font-bold text-blue-600">{Math.round(progressPercentage)}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      challenge.completed
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                    }`}
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-bold text-emerald-600">+{challenge.rewardPoints} pts</span>
                  {challenge.expiresAt && !challenge.completed && (
                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span>Expires soon</span>
                    </div>
                  )}
                </div>
                {canClaim && (
                  <button
                    onClick={() => handleClaimReward(challenge.id)}
                    className="px-5 py-2 rounded-xl font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md"
                  >
                    Claim Reward
                  </button>
                )}
                {challenge.completed && (
                  <div className="px-5 py-2 rounded-xl font-medium bg-emerald-100 text-emerald-700">
                    Completed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="px-6 mt-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Trophy className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 mb-1">How Challenges Work</h3>
              <p className="text-sm text-gray-700">
                Complete activities throughout the event to progress on challenges. Once you reach the target, claim your reward to earn bonus points!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
