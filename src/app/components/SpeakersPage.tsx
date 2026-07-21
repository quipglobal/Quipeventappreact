import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Mic, Search, Loader2, AlertCircle, Building2, Linkedin } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { getEventSpeakersApi, getMemberDetailApi, type EventMember, type MemberDetail } from '@/app/api/audienceClient';
import { getCached, setCached } from '@/app/lib/pageCache';

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');
}

const AVATAR_COLORS = [
  '#7c3aed', '#4f46e5', '#ec4899', '#10b981',
  '#f59e0b', '#3b82f6', '#a855f7', '#14b8a6',
  '#ef4444', '#f97316', '#06b6d4', '#8b5cf6',
];
function avatarColor(userId: number): string {
  return AVATAR_COLORS[Math.abs(userId) % AVATAR_COLORS.length];
}

const SpeakerAvatar: React.FC<{ speaker: EventMember; size?: number }> = ({ speaker, size = 56 }) => {
  const [imgError, setImgError] = useState(false);
  const color = avatarColor(speaker.userId);
  if (speaker.avatar && !imgError) {
    return (
      <img
        src={speaker.avatar}
        alt={speaker.name}
        className="object-cover rounded-full"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}aa)`,
      }}
    >
      <span style={{ color: '#fff', fontSize: size * 0.34, fontWeight: 800 }}>
        {getInitials(speaker.name)}
      </span>
    </div>
  );
};

export const SpeakersPage: React.FC = () => {
  const { eventConfig } = useApp();
  const { t, isDark } = useTheme();

  const [speakers, setSpeakers] = useState<EventMember[]>(() => getCached<EventMember[]>('speakers', eventConfig.eventId ?? '') ?? []);
  const [loading, setLoading] = useState<boolean>(() => !getCached<EventMember[]>('speakers', eventConfig.eventId ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EventMember | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const SPK_PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(SPK_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(SPK_PAGE_SIZE); }, [query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + SPK_PAGE_SIZE); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!eventConfig?.eventId) return;
    const targetId = eventConfig.eventId;
    let cancelled = false;
    const hasCached = getCached<EventMember[]>('speakers', targetId) !== null;
    if (!hasCached) setLoading(true);
    setError(null);
    getEventSpeakersApi(targetId, 200)
      .then(res => {
        if (cancelled || targetId !== eventConfig.eventId) return;
        if (res.success && res.data) {
          setSpeakers(res.data);
          setCached('speakers', targetId, res.data);
        } else {
          setError(res.error?.message ?? 'Could not load speakers.');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load speakers.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventConfig?.eventId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return speakers;
    return speakers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.title ?? '').toLowerCase().includes(q) ||
      (s.company ?? '').toLowerCase().includes(q),
    );
  }, [query, speakers]);

  const openSpeaker = (sp: EventMember) => {
    setSelected(sp);
    setDetail(null);
    if (!eventConfig?.eventId) return;
    const targetUserId = sp.userId;
    setDetailLoading(true);
    getMemberDetailApi(eventConfig.eventId, targetUserId)
      .then(res => {
        // Guard against late responses overwriting the currently-open speaker
        // if the user tapped through several rows quickly.
        if (res.success && res.data && res.data.userId === targetUserId) {
          setDetail(res.data);
        }
      })
      .catch(() => { /* fall back to list-level data */ })
      .finally(() => setDetailLoading(false));
  };

  const closeSpeaker = () => {
    setSelected(null);
    setDetail(null);
  };

  return (
    <div className="min-h-screen pb-6" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="px-4 pt-3">
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.12))',
            border: '1px solid rgba(245,158,11,0.3)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#ea580c)' }}
          >
            <Mic size={18} color="#fff" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 style={{ color: t.text, fontSize: 17, fontWeight: 800, lineHeight: 1.15 }}>
              Speakers
            </h1>
            <p style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
              {speakers.length > 0
                ? `${speakers.length} speaker${speakers.length === 1 ? '' : 's'} at this event`
                : 'Meet the people taking the stage'}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      {speakers.length > 0 && (
        <div className="px-4 pt-3">
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <Search size={15} color={t.textMuted} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search speakers"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: t.text }}
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-4 pt-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 size={28} color="#a78bfa" className="animate-spin" />
            <p style={{ color: t.textMuted, fontSize: 13, marginTop: 12 }}>Loading speakers…</p>
          </div>
        )}

        {!loading && error && (
          <div
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <AlertCircle size={18} color="#ef4444" className="flex-shrink-0 mt-0.5" />
            <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>
          </div>
        )}

        {!loading && !error && speakers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.1)' }}
            >
              <Mic size={22} color={isDark ? '#a78bfa' : '#7c3aed'} />
            </div>
            <p style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>No speakers yet</p>
            <p style={{ color: t.textMuted, fontSize: 12, marginTop: 4, maxWidth: 240 }}>
              The speaker lineup for this event hasn't been published.
            </p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && speakers.length > 0 && (
          <p style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
            No speakers match "{query}"
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {filtered.slice(0, visibleCount).map(sp => (
              <button
                key={sp.memberId}
                onClick={() => openSpeaker(sp)}
                className="w-full text-left rounded-2xl p-3.5 flex items-start gap-3 active:scale-[0.99] transition-transform"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
              >
                <SpeakerAvatar speaker={sp} size={56} />
                <div className="flex-1 min-w-0">
                  <p style={{ color: t.text, fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}
                     className="truncate">
                    {sp.name}
                  </p>
                  {sp.title && (
                    <p style={{ color: t.textMuted, fontSize: 12, marginTop: 2, lineHeight: 1.25 }}
                       className="line-clamp-2">
                      {sp.title}
                    </p>
                  )}
                  {sp.company && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <Building2 size={11} color="#a78bfa" />
                      <span style={{ color: '#a78bfa', fontSize: 11, fontWeight: 600 }}
                            className="truncate">
                        {sp.company}
                      </span>
                    </div>
                  )}
                </div>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg,#f59e0b,#ea580c)',
                    color: '#fff',
                    letterSpacing: '0.04em',
                  }}
                >
                  SPEAKER
                </span>
              </button>
            ))}
            <div ref={sentinelRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Detail bottom sheet */}
      {selected && (
        <>
          <div
            onClick={closeSpeaker}
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[71] mx-auto rounded-t-3xl overflow-hidden"
            style={{
              maxWidth: 430,
              background: isDark ? '#0d0a1a' : '#ffffff',
              borderTop: `1px solid ${t.border}`,
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              className="px-5 pt-5 pb-4 flex items-start gap-4"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.1))',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <SpeakerAvatar speaker={selected} size={72} />
              <div className="flex-1 min-w-0">
                <span
                  className="inline-block px-2 py-0.5 rounded text-[9px] font-bold mb-1.5"
                  style={{
                    background: 'linear-gradient(135deg,#f59e0b,#ea580c)',
                    color: '#fff',
                    letterSpacing: '0.06em',
                  }}
                >
                  SPEAKER
                </span>
                <h2 style={{ color: t.text, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>
                  {selected.name}
                </h2>
                {selected.title && (
                  <p style={{ color: t.textSec, fontSize: 13, marginTop: 3, lineHeight: 1.3 }}>
                    {selected.title}
                  </p>
                )}
                {selected.company && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Building2 size={12} color="#a78bfa" />
                    <span style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600 }}>
                      {selected.company}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={closeSpeaker}
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}
                aria-label="Close"
              >
                <span style={{ color: t.text, fontSize: 18, lineHeight: 1 }}>×</span>
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {detailLoading && !detail && (
                <div className="flex items-center gap-2" style={{ color: t.textMuted, fontSize: 12 }}>
                  <Loader2 size={14} className="animate-spin" />
                  Loading profile…
                </div>
              )}

              {(detail?.bio || selected.bio) && (
                <div className="mb-4">
                  <p style={{
                    color: t.textMuted, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
                  }}>About</p>
                  <p style={{ color: t.text, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {detail?.bio || selected.bio}
                  </p>
                </div>
              )}

              {detail?.interestedTopics && detail.interestedTopics.length > 0 && (
                <div className="mb-4">
                  <p style={{
                    color: t.textMuted, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
                  }}>Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.interestedTopics.map(topic => (
                      <span
                        key={topic}
                        className="px-2.5 py-1 rounded-full"
                        style={{
                          background: isDark ? 'rgba(124,58,237,0.18)' : 'rgba(124,58,237,0.1)',
                          border: `1px solid ${isDark ? 'rgba(124,58,237,0.35)' : 'rgba(124,58,237,0.25)'}`,
                          color: isDark ? '#c4b5fd' : '#7c3aed',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail?.linkedinUrl && (
                <a
                  href={detail.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    color: t.text,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <Linkedin size={15} color="#0a66c2" />
                  View LinkedIn profile
                </a>
              )}

              {!detailLoading && !detail?.bio && !selected.bio &&
               !(detail?.interestedTopics && detail.interestedTopics.length > 0) &&
               !detail?.linkedinUrl && (
                <p style={{ color: t.textMuted, fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
                  No additional profile details yet.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
