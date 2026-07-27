import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Search, Users, Sparkles,
  Building2, ChevronRight, UserCheck,
  Globe, X, Wifi, WifiOff,
  Loader2, BadgeCheck,
  RefreshCw, User,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { getEventMembersApi, getMemberDetailApi, getMeProfileApi, EventMember, MemberDetail } from '@/app/api/audienceClient';
import { getCached, setCached } from '@/app/lib/pageCache';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

const AVATAR_COLORS = [
  '#7c3aed', '#4f46e5', '#ec4899', '#10b981',
  '#f59e0b', '#3b82f6', '#a855f7', '#14b8a6',
  '#ef4444', '#f97316', '#06b6d4', '#8b5cf6',
];

function avatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const MemberAvatar: React.FC<{ member: EventMember; size?: number; rounded?: string }> = ({
  member, size = 48, rounded = 'rounded-xl',
}) => {
  const [imgError, setImgError] = useState(false);
  const color = avatarColor(member.userId);

  if (member.avatar && !imgError) {
    return (
      <img src={member.avatar} alt={member.name}
        className={`object-cover ${rounded}`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)} />
    );
  }
  return (
    <div className={`flex items-center justify-center ${rounded}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}aa)` }}>
      <span style={{ color: '#fff', fontSize: size * 0.33, fontWeight: 800, letterSpacing: '-0.02em' }}>
        {getInitials(member.name)}
      </span>
    </div>
  );
};

// ─── DetailRow helper ─────────────────────────────────────────────────────────

const DetailRow: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | null | undefined;
  divider?: boolean;
  valueColor?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: Record<string, any>;
}> = ({ icon, iconBg, label, value, divider, valueColor, t }) => {
  const safeValue: string | null = value == null
    ? null
    : typeof value === 'string'
      ? (value || null)
      : String(value) || null;

  return (
    <div className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: divider ? `1px solid ${t.divider}` : undefined }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>{label}</p>
        {safeValue ? (
          <p className="truncate" style={{ color: valueColor ?? t.text, fontSize: 13, fontWeight: 600 }}>{safeValue}</p>
        ) : (
          <p style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic' }}>—</p>
        )}
      </div>
    </div>
  );
};

// ─── Detail Page ──────────────────────────────────────────────────────────────

const MemberDetailPage: React.FC<{
  member: EventMember;
  eventId: string | number;
  onBack: () => void;
}> = ({ member, eventId, onBack }) => {
  const { t, isDark } = useTheme();
  const { user } = useApp();
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    setDetailLoading(true);
    const isOwnProfile = !!user?.email && user.email.toLowerCase() === member.email.toLowerCase();

    const memberDetailPromise = getMemberDetailApi(eventId, member.userId);
    const meProfilePromise = isOwnProfile ? getMeProfileApi() : Promise.resolve({ success: false as const });

    Promise.all([memberDetailPromise, meProfilePromise]).then(([memberRes, meRes]) => {
      const base = memberRes.success && memberRes.data ? memberRes.data : null;
      if (isOwnProfile && meRes.success && meRes.data) {
        const me = meRes.data;
        const merged: MemberDetail = {
          ...(base ?? {
            memberId: member.memberId,
            userId: member.userId,
            eventId: typeof eventId === 'number' ? eventId : Number(eventId),
            name: member.name,
            email: member.email,
            phone: member.phone,
            avatar: member.avatar,
            company: member.company,
            title: member.title,
            bio: member.bio,
            role: member.role,
            status: member.status,
            isCheckedIn: member.isCheckedIn,
            checkedInAt: member.checkedInAt,
            joinedAt: member.joinedAt,
            badgeCode: member.badgeCode,
            networkingOptIn: member.networkingOptIn,
            firstName: null,
            lastName: null,
            industry: null,
            interestedTopics: [],
            socialLinks: {},
            linkedinUrl: null,
          }),
          firstName: me.first_name || null,
          lastName: me.last_name || null,
          title: me.title || base?.title || null,
          bio: me.bio || base?.bio || null,
          company: me.company || base?.company || member.company,
          avatar: me.avatar_url || me.profile_image || base?.avatar || null,
          industry: me.industry || null,
          interestedTopics: me.interested_topics,
          socialLinks: Object.fromEntries(
            Object.entries(me.social_links ?? {})
              .map(([k, v]) => [k, typeof v === 'string' ? v : (v != null ? String(v) : '')])
              .filter(([, v]) => v),
          ) as Record<string, string>,
          linkedinUrl: me.linkedin_url || null,
        };
        setDetail(merged);
      } else if (base) {
        setDetail(base);
      }
    }).finally(() => setDetailLoading(false));
  }, [eventId, member.memberId, member.email, user?.email]);

  const firstName = detail?.firstName ?? member.name.split(' ')[0] ?? null;
  const lastName = detail?.lastName ?? (member.name.includes(' ') ? member.name.split(' ').slice(1).join(' ') : null);
  const company = detail?.company || member.company;
  const title = detail?.title || member.title;
  const industry = detail?.industry ?? null;
  const bio = detail?.bio || member.bio;
  const interestedTopics = detail?.interestedTopics ?? [];
  const socialLinks = Object.fromEntries(
    Object.entries(detail?.socialLinks ?? {}).filter(([k]) => !k.startsWith('cxo_'))
  );
  const linkedinUrl = detail?.linkedinUrl ?? null;

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
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
        style={{
          background: isDark
            ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)'
            : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 50%,#818cf8 100%)',
        }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="absolute bottom-0 -left-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-5 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.75)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Audience</span>
          </button>

          <div className="flex items-start gap-4">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2"
                style={{ borderColor: 'rgba(255,255,255,0.25)' }}>
                <MemberAvatar member={member} size={80} rounded="rounded-none" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 flex items-center justify-center"
                style={{ borderColor: isDark ? '#312e81' : '#6366f1' }}>
                <BadgeCheck style={{ width: 11, height: 11, color: '#fff' }} />
              </div>
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 2 }}>
                {member.name}
              </h1>
              {title && (
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                  {typeof title === 'string' ? title : String(title)}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold"
                  style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>
                  <BadgeCheck style={{ width: 10, height: 10 }} /> Checked In
                </span>
              </div>
            </div>
          </div>

          {member.networkingOptIn && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <Wifi style={{ width: 14, height: 14, color: '#34d399' }} />
              <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600 }}>Open to networking</span>
              <Sparkles style={{ width: 12, height: 12, color: '#34d399' }} />
            </div>
          )}
        </div>
      </div>

      {detailLoading && (
        <div className="px-5 mb-4">
          <div className="h-2 rounded-full animate-pulse mb-1" style={{ background: t.border, width: '60%' }} />
          <div className="h-2 rounded-full animate-pulse" style={{ background: t.border, width: '40%' }} />
        </div>
      )}

      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Profile Details</h3>
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <DetailRow icon={<User style={{ width: 14, height: 14, color: '#6366f1' }} />} iconBg="rgba(99,102,241,0.1)" label="First Name" value={firstName} divider t={t} />
          <DetailRow icon={<User style={{ width: 14, height: 14, color: '#6366f1' }} />} iconBg="rgba(99,102,241,0.1)" label="Last Name" value={lastName} divider t={t} />
          <DetailRow icon={<BadgeCheck style={{ width: 14, height: 14, color: '#7c3aed' }} />} iconBg="rgba(124,58,237,0.1)" label="Job Title" value={title} divider t={t} />
          <DetailRow icon={<Building2 style={{ width: 14, height: 14, color: '#f59e0b' }} />} iconBg="rgba(245,158,11,0.1)" label="Company" value={company || null} divider t={t} />
          <DetailRow icon={<Globe style={{ width: 14, height: 14, color: '#06b6d4' }} />} iconBg="rgba(6,182,212,0.1)" label="Company Industry" value={industry} t={t} />
        </div>
      </div>

      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Introduction</h3>
        <div className="rounded-2xl px-4 py-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {bio ? (
            <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.7 }}>{bio}</p>
          ) : (
            <p style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic' }}>—</p>
          )}
        </div>
      </div>

      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Interested Topics</h3>
        <div className="rounded-2xl px-4 py-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {interestedTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {interestedTopics.map((topic, i) => {
                const label = typeof topic === 'string' ? topic : (topic && typeof topic === 'object' ? ((topic as Record<string, unknown>).name ?? (topic as Record<string, unknown>).label ?? JSON.stringify(topic)) : String(topic ?? ''));
                return label ? (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                    style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                    {String(label)}
                  </span>
                ) : null;
              })}
            </div>
          ) : (
            <p style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic' }}>—</p>
          )}
        </div>
      </div>

      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Social Links</h3>
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {linkedinUrl ? (
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: Object.keys(socialLinks).length > 0 ? `1px solid ${t.divider}` : undefined }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(10,102,194,0.1)' }}>
                <Globe style={{ width: 14, height: 14, color: '#0a66c2' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>LinkedIn</p>
                <p className="truncate" style={{ color: '#6366f1', fontSize: 13, fontWeight: 600 }}>{linkedinUrl}</p>
              </div>
            </div>
          ) : null}
          {Object.entries(socialLinks).map(([platform, url], i, arr) => {
            const safeUrl = typeof url === 'string' ? url : (url && typeof url === 'object' ? ((url as Record<string, unknown>).url ?? JSON.stringify(url)) : String(url ?? ''));
            return safeUrl ? (
              <div key={platform} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : undefined }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                  <Globe style={{ width: 14, height: 14, color: '#6366f1' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{platform}</p>
                  <p className="truncate" style={{ color: '#6366f1', fontSize: 13, fontWeight: 600 }}>{String(safeUrl)}</p>
                </div>
              </div>
            ) : null;
          })}
          {!linkedinUrl && Object.keys(socialLinks).length === 0 && (
            <div className="px-4 py-3">
              <p style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic' }}>—</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 mb-5">
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: member.networkingOptIn ? 'rgba(16,185,129,0.06)' : t.surface2,
            border: `1px solid ${member.networkingOptIn ? 'rgba(16,185,129,0.2)' : t.border}`,
          }}>
          {member.networkingOptIn
            ? <>
                <Wifi style={{ width: 20, height: 20, color: '#10b981', flexShrink: 0 }} />
                <div>
                  <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Open to Networking</p>
                  <p style={{ color: t.textSec, fontSize: 12 }}>This attendee is looking to connect with others.</p>
                </div>
              </>
            : <>
                <WifiOff style={{ width: 20, height: 20, color: t.textMuted, flexShrink: 0 }} />
                <p style={{ color: t.textMuted, fontSize: 13, fontWeight: 600 }}>Not networking at this event</p>
              </>
          }
        </div>
      </div>

      <div className="px-5 pb-8">
        <div className="rounded-xl p-4" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <div className="flex items-start gap-2.5">
            <Globe style={{ width: 14, height: 14, color: t.textMuted, flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: t.textMuted, fontSize: 11, lineHeight: 1.5 }}>
              Some personal details are partially masked for privacy.
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.3 }}
      onClick={onClick}
      className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
      style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden">
            <MemberAvatar member={member} size={48} rounded="rounded-none" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>
              {member.name}
            </h3>
            {isConnected && <UserCheck style={{ width: 13, height: 13, color: t.successText, flexShrink: 0 }} />}
          </div>

          {member.title && (
            <p className="truncate mb-1" style={{ color: t.textSec, fontSize: 12, fontWeight: 600 }}>
              {member.title}
            </p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {member.company && (
              <span className="truncate flex items-center gap-1" style={{ color: t.textSec, fontSize: 12 }}>
                <Building2 style={{ width: 10, height: 10, color: t.textMuted, flexShrink: 0 }} />
                {member.company}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-1" style={{ color: '#10b981', fontSize: 11, fontWeight: 600 }}>
            <BadgeCheck style={{ width: 11, height: 11 }} />
            Checked in
          </div>
        </div>

        <div className="flex-shrink-0">
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

  const [members, setMembers] = useState<EventMember[]>(() =>
    getCached<EventMember[]>('members:checkedIn', eventConfig.eventId ?? '') ?? [],
  );
  const [loading, setLoading] = useState<boolean>(() =>
    !getCached<EventMember[]>('members:checkedIn', eventConfig.eventId ?? ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<EventMember | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selectedMember) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [selectedMember]);

  const eventId = eventConfig?.eventId;
  const eventName = eventConfig?.name ?? 'This Event';

  const fetchMembers = useCallback(async (force = false) => {
    if (!eventId) { setLoading(false); return; }

    const cached = getCached<EventMember[]>('members:checkedIn', eventId);
    if (cached && !force) {
      setMembers(cached);
      setLoading(false);
      return;
    }

    if (!cached) setLoading(true);
    setError(null);

    // Always fetch checked-in only — single API call, no toggle needed.
    const listRes = await getEventMembersApi(eventId, true);
    if (listRes.success && listRes.data) {
      // Client-side safety net: keep only truly checked-in records
      const checkedIn = listRes.data.filter(m => m.isCheckedIn);
      setCached('members:checkedIn', eventId, checkedIn);
      setMembers(checkedIn);
    } else {
      setError(listRes.error?.message ?? 'Failed to load audience');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.company.toLowerCase().includes(q) ||
      (m.title ?? '').toLowerCase().includes(q),
    );
  }, [members, searchQuery]);

  const networkingCount = useMemo(
    () => members.filter(m => m.networkingOptIn).length,
    [members],
  );

  const handleConnect = (userId: number) => {
    if (connectedIds.has(userId)) return;
    const member = members.find(m => m.userId === userId);
    if (!member) return;
    setConnectedIds(prev => new Set([...prev, userId]));
    sendConnectionRequest({
      id: String(member.userId),
      name: member.name,
      title: member.role,
      company: member.company,
      avatar: member.avatar ?? '',
    }).catch(() => {
      setConnectedIds(prev => { const next = new Set(prev); next.delete(userId); return next; });
    });
    addPoints(10, 'New connection made!');
  };

  return (
    <div className="min-h-screen relative" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-5"
        style={{
          background: eventConfig?.backgroundURL
            ? `linear-gradient(160deg,rgba(10,5,30,0.82) 0%,rgba(30,10,60,0.72) 100%),url(${eventConfig.backgroundURL}) center/cover no-repeat`
            : isDark
              ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 100%)'
              : 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 55%,#6366f1 100%)',
        }}>
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
            Checked-in attendees
          </p>

          {/* Stats */}
          {!loading && !error && (
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.2)' }}>
                <BadgeCheck style={{ width: 13, height: 13, color: '#34d399' }} />
                <span style={{ color: '#34d399', fontSize: 12, fontWeight: 700 }}>{members.length}</span>
                <span style={{ color: 'rgba(52,211,153,0.7)', fontSize: 11 }}>checked in</span>
              </div>
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
            <input type="text"
              placeholder="Search by name, company, or title…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 13,
              }} />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 active:opacity-60">
                <X style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)' }} />
              </button>
            )}
          </div>
        </div>
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
              <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Couldn't load audience</h3>
              <p style={{ color: t.textMuted, fontSize: 13, marginBottom: 16 }}>{error}</p>
              <button onClick={() => fetchMembers(true)}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                <RefreshCw style={{ width: 14, height: 14 }} /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: t.surface2 }}>
              <BadgeCheck style={{ width: 28, height: 28, color: t.emptyIcon }} />
            </div>
            <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>No check-ins yet</h3>
            <p style={{ color: t.textMuted, fontSize: 13, maxWidth: 240 }}>
              No attendees have checked in for this event yet.
            </p>
          </div>
        )}

        {/* Results count */}
        {!loading && !error && filteredMembers.length > 0 && (
          <div className="py-3">
            <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
              {filteredMembers.length} checked-in attendee{filteredMembers.length !== 1 ? 's' : ''}
              {searchQuery ? ' found' : ''}
            </p>
          </div>
        )}

        {/* List */}
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

          {/* Search empty */}
          {!loading && !error && filteredMembers.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: t.surface2 }}>
                <Search style={{ width: 24, height: 24, color: t.emptyIcon }} />
              </div>
              <div>
                <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>No results</h3>
                <p style={{ color: t.textMuted, fontSize: 13 }}>
                  No checked-in attendees match "{searchQuery}"
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedMember && (
          <MemberDetailPage
            key={selectedMember.userId}
            member={selectedMember}
            eventId={eventId ?? ''}
            onBack={() => setSelectedMember(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
