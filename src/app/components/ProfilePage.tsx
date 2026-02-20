import React from 'react';
import {
  Mail, Building2, Award, CheckCircle, BarChart3, Calendar,
  Bell, Globe, LogOut, User as UserIcon, Briefcase,
  Trophy, TrendingUp, History, Moon, Sun, ChevronRight,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';

export const ProfilePage: React.FC = () => {
  const { user, completedSurveys, votedPolls, metSponsors, pointsHistory, setUser } = useApp();
  const { t, isDark, toggleTheme, mode } = useTheme();

  if (!user) return null;

  const tierGradient =
    user.tier === 'Platinum' ? 'linear-gradient(135deg,#94a3b8,#64748b)'
    : user.tier === 'Gold'   ? 'linear-gradient(135deg,#f59e0b,#d97706)'
    : user.tier === 'Silver' ? 'linear-gradient(135deg,#9ca3af,#6b7280)'
    :                          'linear-gradient(135deg,#92400e,#78350f)';

  const stats = [
    { label: 'Total Points', value: user.points,             icon: Trophy,      color: '#7c3aed' },
    { label: 'Surveys Done', value: completedSurveys.length, icon: CheckCircle, color: '#10b981' },
    { label: 'Polls Voted',  value: votedPolls.length,       icon: BarChart3,   color: '#7c3aed' },
    { label: 'Sponsors Met', value: metSponsors.length,      icon: Building2,   color: '#f97316' },
  ];

  const achievements = [
    { id: '1', title: 'Early Bird',        desc: 'Checked in on day 1',    icon: Calendar,   earned: true,                      grad: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
    { id: '2', title: 'Survey Master',     desc: 'Completed 3 surveys',    icon: CheckCircle,earned: completedSurveys.length>=3, grad: 'linear-gradient(135deg,#10b981,#0d9488)' },
    { id: '3', title: 'Social Butterfly',  desc: 'Met 5 sponsors',         icon: Building2,  earned: metSponsors.length>=5,      grad: 'linear-gradient(135deg,#7c3aed,#ec4899)' },
    { id: '4', title: 'Poll Enthusiast',   desc: 'Voted in all polls',     icon: BarChart3,  earned: votedPolls.length>=3,       grad: 'linear-gradient(135deg,#f59e0b,#f97316)' },
  ];

  const contactRows = [
    { icon: Mail,      label: 'Email',   value: user.email,   bg: 'rgba(79,70,229,0.15)',  iconColor: '#818cf8' },
    { icon: Building2, label: 'Company', value: user.company, bg: 'rgba(124,58,237,0.15)', iconColor: '#a78bfa' },
    { icon: Briefcase, label: 'Title',   value: user.title,   bg: 'rgba(236,72,153,0.15)', iconColor: '#f472b6' },
  ];

  const handleSignOut = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    window.location.reload();
  };

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="px-6 pt-12 pb-16 text-white" style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#9333ea 100%)' }}>
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full" style={{ border: '4px solid rgba(255,255,255,0.3)' }} />
            <div className="absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-xs font-bold text-white" style={{ background: tierGradient }}>
              {user.tier}
            </div>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{user.name}</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 2 }}>{user.title}</p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 12 }}>{user.company}</p>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <UserIcon style={{ width: 14, height: 14 }} />
            {user.role === 'attendee' ? 'Attendee' : 'Sponsor'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 -mt-10 mb-5">
        <div className="grid grid-cols-2 gap-3">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl p-4 text-center" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              <Icon style={{ width: 22, height: 22, color, margin: '0 auto 8px' }} />
              <p style={{ color, fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 4 }}>{value}</p>
              <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 600 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="px-5 mb-5">
        <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Contact Information</h2>
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
          {contactRows.map(({ icon: Icon, label, value, bg, iconColor }, i) => (
            <div key={label} className="flex items-center gap-4 p-4" style={{ borderBottom: i < contactRows.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon style={{ width: 18, height: 18, color: iconColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: t.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p style={{ color: t.text, fontSize: 14, fontWeight: 600 }} className="truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      <div className="px-5 mb-5">
        <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Achievements</h2>
        <div className="grid grid-cols-2 gap-3">
          {achievements.map(({ id, title, desc, icon: Icon, earned, grad }) => (
            <div key={id} className="rounded-2xl p-4" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}`, opacity: earned ? 1 : 0.45 }}>
              <div className="relative w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: grad }}>
                <Icon style={{ width: 22, height: 22, color: '#fff' }} />
                {earned && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#10b981', border: `2px solid ${t.surface}` }}>
                    <CheckCircle style={{ width: 12, height: 12, color: '#fff' }} />
                  </div>
                )}
              </div>
              <h3 style={{ color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{title}</h3>
              <p style={{ color: t.textSec, fontSize: 11 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-5 mb-5">
        <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Recent Activity</h2>
        <div className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
          {pointsHistory.length > 0 ? (
            <div className="space-y-3">
              {pointsHistory.slice(0, 5).map(event => (
                <div key={event.id} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${t.divider}` }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: t.successBg }}>
                      <TrendingUp style={{ width: 14, height: 14, color: t.successText }} />
                    </div>
                    <p style={{ color: t.text, fontSize: 13 }} className="truncate">{event.action}</p>
                  </div>
                  <span style={{ color: t.successText, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>+{event.points}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History style={{ width: 40, height: 40, color: t.emptyIcon, margin: '0 auto 8px' }} />
              <p style={{ color: t.textMuted, fontSize: 14 }}>No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="px-5 mb-5">
        <h2 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Settings</h2>
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>

          {/* ── Theme Toggle ── */}
          <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: t.accentBg }}>
                {isDark
                  ? <Moon  style={{ width: 18, height: 18, color: t.accentSoft }} />
                  : <Sun   style={{ width: 18, height: 18, color: '#f59e0b' }} />}
              </div>
              <div>
                <p style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>Appearance</p>
                <p style={{ color: t.textMuted, fontSize: 12 }}>{isDark ? 'Dark mode' : 'Light mode'} active</p>
              </div>
            </div>

            {/* Toggle switch */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="relative flex-shrink-0"
              style={{ width: 52, height: 30 }}
            >
              <div className="w-full h-full rounded-full transition-all duration-300"
                style={{ background: isDark ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(0,0,0,0.15)' }} />
              <div className="absolute top-[3px] rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  width: 24, height: 24,
                  background: '#fff',
                  left: isDark ? 25 : 3,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}>
                {isDark
                  ? <Moon style={{ width: 12, height: 12, color: '#7c3aed' }} />
                  : <Sun  style={{ width: 12, height: 12, color: '#f59e0b' }} />}
              </div>
            </button>
          </div>

          {/* Other settings */}
          {[
            { id: 'notifications', label: 'Notifications', sub: 'Manage alerts & reminders', icon: Bell,  iconBg: 'rgba(59,130,246,0.15)', iconColor: '#60a5fa' },
            { id: 'language',      label: 'Language',      sub: 'English (US)',              icon: Globe, iconBg: 'rgba(16,185,129,0.15)', iconColor: '#34d399' },
          ].map(({ id, label, sub, icon: Icon, iconBg, iconColor }, i, arr) => (
            <button key={id} className="w-full flex items-center justify-between p-5 transition-all hover:opacity-80"
              style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : 'none' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
                  <Icon style={{ width: 18, height: 18, color: iconColor }} />
                </div>
                <div className="text-left">
                  <p style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>{label}</p>
                  <p style={{ color: t.textMuted, fontSize: 12 }}>{sub}</p>
                </div>
              </div>
              <ChevronRight style={{ width: 17, height: 17, color: t.textMuted }} />
            </button>
          ))}
        </div>
      </div>

      {/* Sign Out */}
      <div className="px-5">
        <button onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold transition-all hover:opacity-80 active:scale-[0.99]"
          style={{ background: t.errorBg, border: `1.5px solid ${t.errorText}22`, color: t.errorText, fontSize: 15 }}>
          <LogOut style={{ width: 18, height: 18 }} />
          Sign Out
        </button>
      </div>
    </div>
  );
};
