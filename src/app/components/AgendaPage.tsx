import React, { useEffect, useState, useCallback } from 'react';
import { Clock, MapPin, Bookmark, Search, CalendarDays, Users } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { Session } from '@/app/types/config';
import { listSessionsApi } from '@/app/api/agendaClient';
import { getCached, setCached } from '@/app/lib/pageCache';
import { DataState } from '@/app/components/ui/DataState';

function formatDayLabel(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
  } catch { return dateStr; }
}

function formatShortDay(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  } catch { return dateStr; }
}

export const AgendaPage: React.FC = () => {
  const { bookmarkedSessions, toggleBookmark, eventConfig } = useApp();
  const { t } = useTheme();

  const [sessions, setSessions]       = useState<Session[]>(() => getCached<Session[]>('sessions', eventConfig.eventId ?? '') ?? []);
  const [loading, setLoading]         = useState<boolean>(() => !getCached<Session[]>('sessions', eventConfig.eventId ?? ''));
  const [error, setError]             = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode]       = useState<'all' | 'bookmarked'>('all');
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const c = getCached<Session[]>('sessions', eventConfig.eventId ?? '');
    if (!c?.length) return '';
    return (Array.from(new Set(c.map(s => s.date).filter(Boolean))).sort() as string[])[0] ?? '';
  });

  const fetchSessions = useCallback(async () => {
    try {
      setError(null);
      const res = await listSessionsApi(eventConfig.eventId);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed to load sessions');
      setSessions(res.data);
      setCached('sessions', eventConfig.eventId, res.data);
      const dates = Array.from(new Set(res.data.map(s => s.date).filter(Boolean))).sort();
      setSelectedDay(prev => prev || (dates[0] ?? ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [eventConfig.eventId]);

  useEffect(() => {
    const hasCached = getCached<Session[]>('sessions', eventConfig.eventId ?? '') !== null;
    if (!hasCached) {
      setLoading(true);
      setSessions([]);
      setSelectedDay('');
    }
    void fetchSessions();
  }, [fetchSessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const uniqueDays  = Array.from(new Set(sessions.map(s => s.date).filter(Boolean))).sort();
  const isMultiDay  = uniqueDays.length > 1;

  const filteredSessions = sessions.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.room.toLowerCase().includes(q);
    const matchDay = !selectedDay || s.date === selectedDay;
    const matchView = viewMode === 'all' || bookmarkedSessions.includes(s.id);
    return matchSearch && matchDay && matchView;
  });

  const headerBg = eventConfig?.backgroundURL
    ? `linear-gradient(160deg,rgba(10,5,30,0.82) 0%,rgba(30,10,60,0.72) 100%),url(${eventConfig.backgroundURL}) center/cover no-repeat`
    : 'linear-gradient(135deg,#7c3aed 0%,#4f46e5 55%,#6366f1 100%)';

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10" style={{ background: headerBg }}>
        <div className="px-5 pt-12 pb-3">
          {eventConfig.name && (
            <div className="flex items-center gap-1.5 mb-1">
              <CalendarDays style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.65)' }} />
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 600 }}>
                {eventConfig.name}
              </p>
            </div>
          )}
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>
            Agenda
          </h1>

          {/* Search */}
          <div className="relative mb-3">
            <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(0,0,0,0.4)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search sessions…"
              className="w-full pl-10 pr-4 py-3 rounded-xl outline-none"
              style={{ background: '#fff', color: '#09090F', fontSize: 14 }}
            />
          </div>

          {/* All Sessions / My Agenda toggle */}
          <div className="flex p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {(['all', 'bookmarked'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className="flex-1 py-2 rounded-lg transition-all"
                style={{
                  background: viewMode === m ? '#fff' : 'transparent',
                  color: viewMode === m ? '#4f46e5' : '#fff',
                  fontSize: 13, fontWeight: 600,
                }}>
                {m === 'all' ? 'All Sessions' : 'My Agenda'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Day tabs for multi-day events ── */}
        {isMultiDay && !loading && (
          <div
            className="flex gap-2 overflow-x-auto px-5 pb-3"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {uniqueDays.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className="flex-shrink-0 px-4 py-2 rounded-xl transition-all"
                style={{
                  background: selectedDay === day ? '#fff' : 'rgba(255,255,255,0.2)',
                  color: selectedDay === day ? '#4f46e5' : '#fff',
                  fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                {formatShortDay(day)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Day label banner ── */}
      {isMultiDay && selectedDay && !loading && (
        <div className="px-5 pt-4 pb-1">
          <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {formatDayLabel(selectedDay)}
          </p>
        </div>
      )}

      {/* ── Session list ── */}
      <div className="px-5 py-5">
        {loading ? (
          <DataState loading loadingRows={4} />
        ) : error ? (
          <DataState error={error} onRetry={() => { setLoading(true); fetchSessions(); }} />
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays style={{ width: 48, height: 48, color: t.emptyIcon, margin: '0 auto 12px' }} />
            <h3 style={{ color: t.text, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
              {viewMode === 'bookmarked' ? 'No Bookmarked Sessions' : 'No Sessions Found'}
            </h3>
            <p style={{ color: t.textSec, fontSize: 14 }}>
              {viewMode === 'bookmarked'
                ? 'Bookmark sessions to build your personal agenda'
                : searchQuery
                  ? 'Try a different search term'
                  : 'No sessions scheduled for this event yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map(session => {
              const isBookmarked = bookmarkedSessions.includes(session.id);
              return (
                <div
                  key={session.id}
                  className="rounded-2xl p-5 transition-all"
                  style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>

                  {/* Time + Room */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: t.accentBg }}>
                      <Clock style={{ width: 13, height: 13, color: t.accentSoft }} />
                      <span style={{ color: t.accentSoft, fontSize: 12, fontWeight: 700 }}>
                        {session.startTime}{session.endTime ? ` – ${session.endTime}` : ''}
                      </span>
                    </div>
                    {session.room && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                        <MapPin style={{ width: 13, height: 13, color: t.textSec }} />
                        <span style={{ color: t.textSec, fontSize: 12, fontWeight: 600 }}>{session.room}</span>
                      </div>
                    )}
                  </div>

                  {/* Title + Bookmark */}
                  <div className="flex items-start gap-3 mb-2">
                    <h3 style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>
                      {session.title}
                    </h3>
                    <button
                      onClick={() => toggleBookmark(session.id)}
                      className="p-2 rounded-lg transition-all flex-shrink-0"
                      style={{ background: isBookmarked ? 'rgba(245,158,11,0.15)' : t.surface2 }}>
                      <Bookmark style={{
                        width: 18, height: 18,
                        color: isBookmarked ? '#f59e0b' : t.textMuted,
                        fill: isBookmarked ? '#f59e0b' : 'none',
                      }} />
                    </button>
                  </div>

                  {/* Description */}
                  {session.description ? (
                    <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
                      {session.description}
                    </p>
                  ) : null}

                  {/* Speakers */}
                  {session.speakers.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${t.divider}` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users style={{ width: 12, height: 12, color: t.textMuted }} />
                        <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {session.speakers.length === 1 ? 'Speaker' : 'Speakers'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {session.speakers.map((spk, i) => {
                          const displayName = spk.name?.trim() || spk.title?.trim() || 'Unnamed Speaker';
                          const subtitle = spk.name?.trim()
                            ? [spk.title, spk.company].filter(Boolean).join(' · ')
                            : spk.company?.trim() || '';
                          const isModerator = (spk.role || '').toLowerCase().includes('moderator');
                          return (
                            <div key={spk.id || i} className="flex items-center gap-2">
                              {spk.avatar ? (
                                <img src={spk.avatar} alt={displayName} className="w-7 h-7 rounded-full flex-shrink-0 object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-violet-600 text-white text-xs font-bold">
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p style={{ color: t.text, fontSize: 12, fontWeight: 600 }} className="truncate">
                                    {displayName}
                                  </p>
                                  {isModerator && (
                                    <span
                                      className="px-1.5 py-0.5 rounded"
                                      style={{
                                        background: 'rgba(245,158,11,0.15)',
                                        color: '#f59e0b',
                                        fontSize: 9,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      Moderator
                                    </span>
                                  )}
                                  {!isModerator && spk.role && spk.role.toLowerCase() !== 'speaker' && (
                                    <span
                                      className="px-1.5 py-0.5 rounded"
                                      style={{
                                        background: t.accentBg,
                                        color: t.accentSoft,
                                        fontSize: 9,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                      }}
                                    >
                                      {spk.role}
                                    </span>
                                  )}
                                </div>
                                {subtitle && (
                                  <p style={{ color: t.textMuted, fontSize: 11 }} className="truncate">
                                    {subtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Assigned Audience */}
                  {session.assignedAudience && session.assignedAudience.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${t.divider}` }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users style={{ width: 12, height: 12, color: t.textMuted }} />
                        <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Audience
                        </span>
                        <span style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>
                          · {session.assignedAudience.length} assigned
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {session.assignedAudience.slice(0, 5).map((m, i) => (
                            <div
                              key={m.id || i}
                              title={m.name}
                              className="w-7 h-7 rounded-full overflow-hidden border-2 flex-shrink-0"
                              style={{ borderColor: t.surface, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                            >
                              {m.avatar ? (
                                <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          ))}
                          {session.assignedAudience.length > 5 && (
                            <div
                              className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: t.surface, background: t.surface2, color: t.textSec, fontSize: 10, fontWeight: 700 }}
                            >
                              +{session.assignedAudience.length - 5}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {session.assignedAudience.slice(0, 2).map((m, i) => (
                            <div key={m.id || i} className="truncate" style={{ color: t.textSec, fontSize: 12, lineHeight: 1.35 }}>
                              <span style={{ fontWeight: 600, color: t.textPri }}>{m.name}</span>
                              {m.title ? <span style={{ color: t.textMuted }}> · {m.title}</span> : null}
                              {m.company ? <span style={{ color: t.textMuted }}> · {m.company}</span> : null}
                            </div>
                          ))}
                          {session.assignedAudience.length > 2 && (
                            <div style={{ color: t.textMuted, fontSize: 11 }}>
                              +{session.assignedAudience.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Track / Tags — only shown if they exist */}
                  {(session.track || session.tags.length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {session.track && (
                        <span className="px-2.5 py-1 rounded-lg" style={{ background: t.accentBg, color: t.accentSoft, fontSize: 11, fontWeight: 600 }}>
                          {session.track}
                        </span>
                      )}
                      {session.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-2.5 py-1 rounded-lg" style={{ background: t.surface2, color: t.textSec, fontSize: 11, fontWeight: 600 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Live poll / Survey */}
                  {(session.pollId || session.surveyId) && (
                    <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${t.divider}` }}>
                      {session.pollId   && <div className="px-3 py-1.5 rounded-lg" style={{ background: 'rgba(6,182,212,0.12)', color: '#0891b2', fontSize: 12, fontWeight: 600 }}>📊 Live Poll</div>}
                      {session.surveyId && <div className="px-3 py-1.5 rounded-lg" style={{ background: t.successBg, color: t.successText, fontSize: 12, fontWeight: 600 }}>📝 Survey</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
