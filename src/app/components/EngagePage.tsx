import React from 'react';
import { Building2, FileText, BarChart3, Trophy, Sparkles, ArrowRight, Users } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockSurveys, mockPolls, mockSponsors, mockChallenges } from '@/app/data/mockData';

interface EngagePageProps { onNavigate: (page: string) => void; }

export const EngagePage: React.FC<EngagePageProps> = ({ onNavigate }) => {
  const { completedSurveys, votedPolls, metSponsors, completedChallenges, eventConfig, gamificationConfig } = useApp();
  const { t } = useTheme();

  const newSurveysCount  = mockSurveys.filter(s => !completedSurveys.includes(s.id)).length;
  const livePollsCount   = mockPolls.filter(p => p.isLive && !votedPolls.includes(p.id)).length;
  const availableSponsors = mockSponsors.filter(s => !metSponsors.includes(s.id)).length;
  const activeChallenges = mockChallenges.filter(c => !completedChallenges.includes(c.id)).length;

  const modules = [
    { id: 'sponsors',   title: 'Sponsors & Companies', desc: 'Connect with sponsors at their booths',    icon: Building2, grad: 'linear-gradient(135deg,#f97316,#ef4444)', pts: `+${gamificationConfig.pointActions.sponsorCheckIn} per check-in`, badge: availableSponsors > 0 ? `${availableSponsors} available` : null, badgeColor: '#f97316', enabled: eventConfig.modulesEnabled.sponsors },
    { id: 'surveys',    title: 'Surveys',               desc: 'Share your feedback and earn points',     icon: FileText,  grad: 'linear-gradient(135deg,#10b981,#0d9488)',  pts: `+${gamificationConfig.pointActions.completeSurvey} per survey`,  badge: newSurveysCount > 0 ? `${newSurveysCount} new` : null,         badgeColor: '#10b981', enabled: eventConfig.modulesEnabled.surveys },
    { id: 'polls',      title: 'Live Polls',            desc: 'Vote on live polls and see results',      icon: BarChart3, grad: 'linear-gradient(135deg,#7c3aed,#ec4899)', pts: `+${gamificationConfig.pointActions.votePoll} per poll`,          badge: livePollsCount > 0 ? `${livePollsCount} live` : null,          badgeColor: '#7c3aed', enabled: eventConfig.modulesEnabled.polls },
    { id: 'challenges', title: 'Challenges',            desc: 'Complete challenges for bonus points',    icon: Trophy,    grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)', pts: `+${gamificationConfig.pointActions.completeChallenge} per challenge`, badge: activeChallenges > 0 ? `${activeChallenges} active` : null, badgeColor: '#3b82f6', enabled: eventConfig.modulesEnabled.challenges },
    { id: 'audience',   title: 'Networking',            desc: 'Connect with other attendees',            icon: Users,     grad: 'linear-gradient(135deg,#4f46e5,#7c3aed)', pts: 'Connect & collaborate',                                        badge: null,                                                          badgeColor: '#4f46e5', enabled: eventConfig.modulesEnabled.audience },
  ].filter(m => m.enabled);

  const stats = [
    { value: completedSurveys.length, label: 'Surveys',  color: '#10b981' },
    { value: votedPolls.length,       label: 'Polls',    color: '#7c3aed' },
    { value: metSponsors.length,      label: 'Sponsors', color: '#f97316' },
  ];

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-8" style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#9333ea 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <Sparkles style={{ width: 26, height: 26, color: '#fff' }} />
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Engage</h1>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>Earn points and unlock rewards by participating</p>
      </div>

      {/* Stats card */}
      <div className="px-5 -mt-4 mb-5">
        <div className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
          <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Your Engagement Today</p>
          <div className="grid grid-cols-3 gap-4">
            {stats.map(({ value, label, color }) => (
              <div key={label} className="text-center">
                <p style={{ color, fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</p>
                <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 600, marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="px-5 space-y-3 mb-5">
        {modules.map(mod => {
          const Icon = mod.icon;
          return (
            <button key={mod.id} onClick={() => onNavigate(`engage-${mod.id}`)}
              className="w-full rounded-2xl p-5 text-left hover:opacity-90 active:scale-[0.99] transition-all"
              style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: mod.grad }}>
                  <Icon style={{ width: 26, height: 26, color: '#fff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{mod.title}</h3>
                    {mod.badge && (
                      <span className="px-2 py-0.5 rounded-full" style={{ background: `${mod.badgeColor}22`, color: mod.badgeColor, fontSize: 11, fontWeight: 700 }}>
                        {mod.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ color: t.textSec, fontSize: 13, marginBottom: 4 }}>{mod.desc}</p>
                  <p style={{ color: '#10b981', fontSize: 12, fontWeight: 600 }}>{mod.pts}</p>
                </div>
                <ArrowRight style={{ width: 18, height: 18, color: t.textMuted, flexShrink: 0, marginTop: 4 }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Pro Tip */}
      <div className="px-5">
        <div className="rounded-2xl p-5" style={{ background: t.warningBg, border: `1px solid ${t.border}` }}>
          <div className="flex items-start gap-3">
            <Sparkles style={{ width: 18, height: 18, color: t.warningText, flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Pro Tip</h3>
              <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>
                Complete all surveys and polls to maximise your points and climb the leaderboard!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
