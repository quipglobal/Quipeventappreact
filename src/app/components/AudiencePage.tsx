import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Search, Users, Clock, Sparkles,
  Building2, ChevronRight, UserPlus, UserCheck,
  MessageCircle, Globe, X, Wifi, WifiOff,
  Loader2, BadgeCheck, QrCode, Calendar,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { getEventMembersApi, EventMember } from '@/app/api/audienceClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('');
}

const AVATAR_COLORS = [
  '#7c3aed', '#4f46e5', '#ec4899', '#10b981',
  '#f59e0b', '#3b82f6', '#a855f7', '#14b8a6',
  '#ef4444', '#f97316', '#06b6d4', '#8b5cf6',
];

function avatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

function formatJoinDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatCheckedInTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

const roleGradients: Record<string, string> = {
  Speaker:   'linear-gradient(135deg,#f59e0b,#ea580c)',
  VIP:       'linear-gradient(135deg,#a78bfa,#7c3aed)',
  Sponsor:   'linear-gradient(135deg,#10b981,#0d9488)',
  Organizer: 'linear-gradient(135deg,#3b82f6,#6366f1)',
  Staff:     'linear-gradient(135deg,#06b6d4,#0284c7)',
  Moderator: 'linear-gradient(135deg,#ec4899,#db2777)',
  Exhibitor: 'linear-gradient(135deg,#f97316,#ef4444)',
  Attendee:  'linear-gradient(135deg,#6b7280,#4b5563)',
};

function roleGrad(role: string): string {
  return roleGradients[role] ?? roleGradients['Attendee'];
}

// ─── Avatar Component ─────────────────────────────────────────────────────────

const MemberAvatar: React.FC<{
  member: EventMember;
  size?: number;
  rounded?: string;
}> = ({ member, size = 48, rounded = 'rounded-xl' }) => {
  const [imgError, setImgError] = useState(false);
  const color = avatarColor(member.userId);
  const initials = getInitials(member.name);

  if (member.avatar && !imgError) {
    return (
      <img
        src={member.avatar}
        alt={member.name}
        className={`object-cover ${rounded}`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center ${rounded}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
      }}
    >
      <span style={{
        color: '#fff',
        fontSize: size * 0.33,
        fontWeight: 800,
        letterSpacing: '-0.02em',
      }}>
        {initials}
      </span>
    </div>
  );
};

// ─── Detail Page ──────────────────────────────────────────────────────────────

const MemberDetailPage: React.FC<{
  member: EventMember;
  onBack: () => void;
  onConnect: (id: number) => void;
  isConnected: boolean;
}> = ({ member, onBack, onConnect, isConnected }) => {
  const { t, isDark } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 z-50 min-h-screen overflow-y-auto"
      style={{ background: t.bgPage }}
    >
      {/* Header */}
      <div
        className="relative overflow-hidden px-5 pt-12 pb-8"
        style={{
          background: isDark
            ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)'
            : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 50%,#818cf8 100%)',
        }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="absolute bottom-0 -left-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />

        <div className="relative z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 mb-5 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Audience</span>
          </button>

          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2"
                style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                <MemberAvatar member={member} size={80} rounded="rounded-none" />
              </div>
              {member.networkingOptIn && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 flex items-center justify-center"
                  style={{ borderColor: isDark ? '#312e81' : '#6366f1' }}>
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 6 }}>
                {member.name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="px-2.5 py-1 rounded-lg text-xs font-bold"
                  style={{ background: roleGrad(member.role), color: '#fff' }}
                >
                  {member.role}
                </span>
                <span
                  className="px-2 py-0.5 rounded-md text-xs font-600"
                  style={{
                    background: member.status === 'Active' || member.status === 'Confirmed'
                      ? 'rgba(16,185,129,0.2)'
                      : 'rgba(107,114,128,0.2)',
                    color: member.status === 'Active' || member.status === 'Confirmed'
                      ? '#34d399'
                      : '#9ca3af',
                  }}
                >
                  {member.status}
                </span>
              </div>
            </div>
          </div>

          {/* Networking badge */}
          {member.networkingOptIn && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <Wifi style={{ width: 14, height: 14, color: '#34d399' }} />
              <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600 }}>
                Open to networking
              </span>
              <Sparkles style={{ width: 12, height: 12, color: '#34d399' }} />
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 -mt-4 mb-5 relative z-10">
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: t.surface, boxShadow: t.shadowHov, border: `1px solid ${t.border}` }}>
          <button
            onClick={() => onConnect(member.userId)}
            disabled={isConnected}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all active:scale-[0.97]"
            style={{
              background: isConnected ? t.successBg : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              border: isConnected ? `1px solid ${t.successText}30` : 'none',
              color: isConnected ? t.successText : '#fff',
            }}
          >
            {isConnected ? (
              <>
                <UserCheck style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Connected</span>
              </>
            ) : (
              <>
                <UserPlus style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Connect</span>
              </>
            )}
          </button>
          <button
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]"
            style={{ background: t.surface2, border: `1px solid ${t.border}` }}
          >
            <MessageCircle style={{ width: 16, height: 16, color: t.accentSoft }} />
            <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>Message</span>
          </button>
        </div>
      </div>

      {/* Event Details card */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Event Details</h3>
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>

          {/* Role */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}>
              <Building2 style={{ width: 14, height: 14, color: '#7c3aed' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Role</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{member.role}</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <BadgeCheck style={{ width: 14, height: 14, color: '#10b981' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Registration Status</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{member.status}</p>
            </div>
          </div>

          {/* Registered */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
              <Calendar style={{ width: 14, height: 14, color: '#6366f1' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Registered</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{formatJoinDate(member.joinedAt)}</p>
            </div>
          </div>

          {/* Check-in */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: member.badgeCode ? `1px solid ${t.divider}` : undefined }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: member.isCheckedIn ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)' }}>
              <Clock style={{ width: 14, height: 14, color: member.isCheckedIn ? '#10b981' : '#6b7280' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Check-in</p>
              {member.isCheckedIn ? (
                <p style={{ color: '#10b981', fontSize: 13, fontWeight: 700 }}>
                  Checked in {member.checkedInAt ? `at ${formatCheckedInTime(member.checkedInAt)}` : ''}
                </p>
              ) : (
                <p style={{ color: t.textMuted, fontSize: 13, fontWeight: 600 }}>Not yet checked in</p>
              )}
            </div>
          </div>

          {/* Badge code */}
          {member.badgeCode && (
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                <QrCode style={{ width: 14, height: 14, color: '#f59e0b' }} />
              </div>
              <div className="flex-1">
                <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Badge Code</p>
                <p style={{ color: t.text, fontSize: 13, fontWeight: 700, letterSpacing: '0.08em' }}>{member.badgeCode}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Networking */}
      <div className="px-5 mb-5">
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: member.networkingOptIn ? 'rgba(16,185,129,0.06)' : t.surface2,
            border: `1px solid ${member.networkingOptIn ? 'rgba(16,185,129,0.2)' : t.border}`,
          }}>
          {member.networkingOptIn ? (
            <>
              <Wifi style={{ width: 20, height: 20, color: '#10b981', flexShrink: 0 }} />
              <div>
                <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Open to Networking</p>
                <p style={{ color: t.textSec, fontSize: 12 }}>
                  This attendee is looking to connect with others.
                </p>
              </div>
            </>
          ) : (
            <>
              <WifiOff style={{ width: 20, height: 20, color: t.textMuted, flexShrink: 0 }} />
              <div>
                <p style={{ color: t.textMuted, fontSize: 13, fontWeight: 600 }}>Not networking at this event</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="px-5 pb-8">
        <div className="rounded-xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <div className="flex items-start gap-2.5">
            <Globe style={{ width: 14, height: 14, color: t.textMuted, flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: t.textMuted, fontSize: 11, lineHeight: 1.5 }}>
              Personal contact information such as email and phone number is not shared. Use the Connect or Message buttons to reach out.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Member Card ─────────────────────────────────────────────────────────────

const MemberCard: React.FC<{
  member: EventMember;
  isConnected: boolean;
  index: number;
  onClick: () => void;
}> = ({ member, isConnected, index, onClick }) => {
  const { t } = useTheme();

  return (
    <motion.button
      key={member.userId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      onClick={onClick}
      className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
      style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}
    >
      <div className="flex items-center gap-3.5">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            <MemberAvatar member={member} size={48} rounded="rounded-none" />
          </div>
          {member.networkingOptIn && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2"
              style={{ borderColor: t.surface }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>
              {member.name}
            </h3>
            {isConnected && (
              <UserCheck style={{ width: 13, height: 13, color: t.successText, flexShrink: 0 }} />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="px-2 py-0.5 rounded-md text-xs font-bold"
              style={{ background: roleGrad(member.role), color: '#fff' }}
            >
              {member.role}
            </span>
            {member.isCheckedIn && (
              <span className="flex items-center gap-1" style={{ color: '#10b981', fontSize: 10, fontWeight: 600 }}>
                <BadgeCheck style={{ width: 10, height: 10 }} /> Checked in
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1" style={{ color: t.textMuted, fontSize: 11 }}>
              <Calendar style={{ width: 10, height: 10 }} />
              Joined {formatJoinDate(member.joinedAt)}
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {member.networkingOptIn && (
            <Wifi style={{ width: 13, height: 13, color: '#10b981' }} />
          )}
          <ChevronRight style={{ width: 14, height: 14, color: t.textMuted }} />
        </div>
      </div>
    </motion.button>
  );
};

// ─── AudiencePage ─────────────────────────────────────────────────────────────

interface AudiencePageProps {
  onBack?: () => void;
}

export const AudiencePage: React.FC<AudiencePageProps> = ({ onBack }) => {
  const { eventConfig, addPoints, sendConnectionRequest } = useApp();
  const { t, isDark } = useTheme();

  const [members, setMembers] = useState<EventMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [checkedInOnly, setCheckedInOnly] = useState(false);
  const [selectedMember, setSelectedMember] = useState<EventMember | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<number>>(new Set());

  const eventId = eventConfig?.eventId;
  const eventName = eventConfig?.name ?? 'This Event';

  const fetchMembers = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getEventMembersApi(eventId);
    if (res.success && res.data) {
      setMembers(res.data);
    } else {
      setError(res.error?.message ?? 'Failed to load audience');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Unique roles for filter chips
  const availableRoles = useMemo(() => {
    const roles = Array.from(new Set(members.map(m => m.role))).sort();
    return roles;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return members.filter(m => {
      const matchesSearch = !q ||
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || m.role === roleFilter;
      const matchesCheckedIn = !checkedInOnly || m.isCheckedIn;
      return matchesSearch && matchesRole && matchesCheckedIn;
    });
  }, [members, searchQuery, roleFilter, checkedInOnly]);

  const networkingCount = members.filter(m => m.networkingOptIn).length;
  const checkedInCount = members.filter(m => m.isCheckedIn).length;

  const handleConnect = (userId: number) => {
    if (connectedIds.has(userId)) return;
    const member = members.find(m => m.userId === userId);
    if (!member) return;
    setConnectedIds(prev => new Set([...prev, userId]));
    sendConnectionRequest({
      id: String(member.userId),
      name: member.name,
      title: member.role,
      company: '',
      avatar: member.avatar ?? '',
    }).catch(() => {
      setConnectedIds(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });
    addPoints(10, 'New connection made!');
  };

  return (
    <div className="min-h-screen relative" style={{ background: t.bgPage }}>
      {/* Header */}
      <div
        className="relative overflow-hidden px-5 pt-12 pb-5"
        style={{
          background: isDark
            ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 100%)'
            : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 60%,#818cf8 100%)',
        }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />

        <div className="relative z-10">
          {onBack && (
            <button onClick={onBack}
              className="flex items-center gap-1.5 mb-4 active:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.7)' }}>
              <ArrowLeft style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
            </button>
          )}

          <div className="flex items-center gap-2.5 mb-1">
            <Users style={{ width: 22, height: 22, color: '#c4b5fd' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Event Audience
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 2 }}>
            {eventName}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 12 }}>
            Registered attendees for this event
          </p>

          {/* Stats */}
          {!loading && !error && (
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.12)' }}>
                <Users style={{ width: 13, height: 13, color: '#fff' }} />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{members.length}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>registered</span>
              </div>
              {checkedInCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <BadgeCheck style={{ width: 13, height: 13, color: '#34d399' }} />
                  <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>{checkedInCount}</span>
                  <span style={{ color: 'rgba(52,211,153,0.7)', fontSize: 11 }}>checked in</span>
                </div>
              )}
              {networkingCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(99,102,241,0.15)' }}>
                  <Wifi style={{ width: 13, height: 13, color: '#818cf8' }} />
                  <span style={{ color: '#818cf8', fontSize: 12, fontWeight: 700 }}>{networkingCount}</span>
                  <span style={{ color: 'rgba(129,140,248,0.7)', fontSize: 11 }}>networking</span>
                </div>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              placeholder="Search by name or role…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 13,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 active:opacity-60">
                <X style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter row: check-in toggle + role chips */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Checked-in toggle */}
        <button
          onClick={() => setCheckedInOnly(v => !v)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all"
          style={{
            background: checkedInOnly ? '#10b981' : t.surface,
            color: checkedInOnly ? '#fff' : t.textSec,
            fontSize: 12, fontWeight: 700,
            border: `1.5px solid ${checkedInOnly ? '#10b981' : t.border}`,
          }}
        >
          <BadgeCheck style={{ width: 13, height: 13 }} />
          Checked in only
        </button>

        {/* Divider between toggle and role chips */}
        {availableRoles.length > 1 && (
          <div className="w-px flex-shrink-0 self-stretch mx-0.5" style={{ background: t.divider }} />
        )}

        {/* All roles chip */}
        {availableRoles.length > 1 && (
          <button
            onClick={() => setRoleFilter('all')}
            className="px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all"
            style={{
              background: roleFilter === 'all' ? t.accent : t.surface,
              color: roleFilter === 'all' ? '#fff' : t.textSec,
              fontSize: 12, fontWeight: 600,
              border: `1px solid ${roleFilter === 'all' ? t.accent : t.border}`,
            }}
          >
            All roles
          </button>
        )}

        {/* Per-role chips */}
        {availableRoles.length > 1 && availableRoles.map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(role === roleFilter ? 'all' : role)}
            className="px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all whitespace-nowrap"
            style={{
              background: roleFilter === role ? t.accent : t.surface,
              color: roleFilter === role ? '#fff' : t.textSec,
              fontSize: 12, fontWeight: 600,
              border: `1px solid ${roleFilter === role ? t.accent : t.border}`,
            }}
          >
            {role}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-5 pb-28">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 style={{ width: 32, height: 32, color: '#7c3aed', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: t.textMuted, fontSize: 13 }}>Loading attendees…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Users style={{ width: 28, height: 28, color: '#ef4444' }} />
            </div>
            <div>
              <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                Couldn't load audience
              </h3>
              <p style={{ color: t.textMuted, fontSize: 13, marginBottom: 16 }}>{error}</p>
              <button
                onClick={fetchMembers}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700 }}
              >
                <RefreshCw style={{ width: 14, height: 14 }} /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty – no members for this event */}
        {!loading && !error && members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: t.surface2 }}>
              <Users style={{ width: 28, height: 28, color: t.emptyIcon }} />
            </div>
            <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>No attendees yet</h3>
            <p style={{ color: t.textMuted, fontSize: 13, maxWidth: 240 }}>
              No one has registered for this event yet. Check back soon!
            </p>
          </div>
        )}

        {/* Results count */}
        {!loading && !error && members.length > 0 && (
          <div className="py-3">
            <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
              {filteredMembers.length} attendee{filteredMembers.length !== 1 ? 's' : ''}
              {searchQuery || roleFilter !== 'all' ? ' found' : ' registered'}
            </p>
          </div>
        )}

        {/* Members list */}
        {!loading && !error && (
          <div className="space-y-2.5">
            {filteredMembers.map((member, index) => (
              <MemberCard
                key={member.userId}
                member={member}
                isConnected={connectedIds.has(member.userId)}
                index={index}
                onClick={() => setSelectedMember(member)}
              />
            ))}

            {/* Search empty state */}
            {filteredMembers.length === 0 && members.length > 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                  style={{ background: t.surface2 }}>
                  <Search style={{ width: 24, height: 24, color: t.emptyIcon }} />
                </div>
                <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  No results found
                </h3>
                <p style={{ color: t.textMuted, fontSize: 13 }}>
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail overlay */}
      <AnimatePresence>
        {selectedMember && (
          <MemberDetailPage
            member={selectedMember}
            onBack={() => setSelectedMember(null)}
            onConnect={handleConnect}
            isConnected={connectedIds.has(selectedMember.userId)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
