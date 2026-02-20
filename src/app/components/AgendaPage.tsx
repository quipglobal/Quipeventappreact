import React, { useState } from 'react';
import { Clock, MapPin, Bookmark, Search, Filter, Tag } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockSessions } from '@/app/data/mockData';

export const AgendaPage: React.FC = () => {
  const { bookmarkedSessions, toggleBookmark } = useApp();
  const { t } = useTheme();
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedTrack, setSelectedTrack] = useState('all');
  const [selectedType, setSelectedType]   = useState('all');
  const [showFilters, setShowFilters]   = useState(false);
  const [viewMode, setViewMode]         = useState<'all' | 'bookmarked'>('all');

  const tracks = ['All Tracks', 'Keynote', 'AI & ML', 'Sustainability', 'Startups'];
  const types  = ['All Types', 'Keynote', 'Workshop', 'Panel', 'Competition'];

  const filteredSessions = mockSessions.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      (s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) &&
      (selectedTrack === 'all' || s.track === selectedTrack) &&
      (selectedType  === 'all' || s.type  === selectedType)  &&
      (viewMode === 'all' || bookmarkedSessions.includes(s.id))
    );
  });

  const GRAD = 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#9333ea 100%)';

  return (
    <div className="pb-24 min-h-screen" style={{ background: t.bgPage }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 px-5 pt-12 pb-4" style={{ background: GRAD }}>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 12 }}>Event Agenda</h1>

        {/* Search */}
        <div className="relative mb-3">
          <Search style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: 'rgba(0,0,0,0.4)' }} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sessions…"
            className="w-full pl-10 pr-4 py-3 rounded-xl outline-none"
            style={{ background: '#fff', color: '#09090F', fontSize: 14 }} />
        </div>

        {/* Toggle + filter */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {['all', 'bookmarked'].map(m => (
              <button key={m} onClick={() => setViewMode(m as any)}
                className="flex-1 py-2 rounded-lg transition-all"
                style={{ background: viewMode === m ? '#fff' : 'transparent', color: viewMode === m ? '#4f46e5' : '#fff', fontSize: 13, fontWeight: 600 }}>
                {m === 'all' ? 'All Sessions' : 'My Agenda'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className="p-3 rounded-xl transition-all"
            style={{ background: showFilters ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)' }}>
            <Filter style={{ width: 18, height: 18, color: '#fff' }} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="px-5 py-4 space-y-3" style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          {[
            { label: 'Track', val: selectedTrack, set: setSelectedTrack, opts: tracks, all: 'All Tracks' },
            { label: 'Type',  val: selectedType,  set: setSelectedType,  opts: types,  all: 'All Types' },
          ].map(({ label, val, set, opts, all }) => (
            <div key={label}>
              <label style={{ color: t.textMuted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
              <select value={val} onChange={e => set(e.target.value)}
                className="w-full mt-1.5 px-4 py-2.5 rounded-xl outline-none"
                style={{ background: t.inputBg, border: `1px solid ${t.border}`, color: t.text, fontSize: 14 }}>
                {opts.map(o => <option key={o} value={o === all ? 'all' : o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Sessions */}
      <div className="px-5 py-5">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-16">
            <Bookmark style={{ width: 48, height: 48, color: t.emptyIcon, margin: '0 auto 12px' }} />
            <h3 style={{ color: t.text, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
              {viewMode === 'bookmarked' ? 'No Bookmarked Sessions' : 'No Sessions Found'}
            </h3>
            <p style={{ color: t.textSec, fontSize: 14 }}>
              {viewMode === 'bookmarked' ? 'Bookmark sessions to build your agenda' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map(session => {
              const isBookmarked = bookmarkedSessions.includes(session.id);
              return (
                <div key={session.id} className="rounded-2xl p-5 transition-all"
                  style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>

                  {/* Time + Room */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: t.accentBg }}>
                      <Clock style={{ width: 13, height: 13, color: t.accentSoft }} />
                      <span style={{ color: t.accentSoft, fontSize: 12, fontWeight: 700 }}>{session.startTime} – {session.endTime}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: t.surface2 }}>
                      <MapPin style={{ width: 13, height: 13, color: t.textSec }} />
                      <span style={{ color: t.textSec, fontSize: 12, fontWeight: 600 }}>{session.room}</span>
                    </div>
                  </div>

                  {/* Title + Bookmark */}
                  <div className="flex items-start gap-3 mb-3">
                    <h3 style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{session.title}</h3>
                    <button onClick={() => toggleBookmark(session.id)}
                      className="p-2 rounded-lg transition-all flex-shrink-0"
                      style={{ background: isBookmarked ? 'rgba(245,158,11,0.15)' : t.surface2 }}>
                      <Bookmark style={{ width: 18, height: 18, color: isBookmarked ? '#f59e0b' : t.textMuted, fill: isBookmarked ? '#f59e0b' : 'none' }} />
                    </button>
                  </div>

                  {/* Speaker */}
                  {session.speakers.length > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <img src={session.speakers[0].avatar} alt={session.speakers[0].name} className="w-7 h-7 rounded-full flex-shrink-0" />
                      <div>
                        <p style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>{session.speakers[0].name}</p>
                        <p style={{ color: t.textMuted, fontSize: 11 }}>{session.speakers[0].title}</p>
                      </div>
                    </div>
                  )}

                  <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{session.description}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: t.accentBg, color: t.accentSoft, fontSize: 11, fontWeight: 600 }}>
                      <Tag style={{ width: 10, height: 10 }} />{session.track}
                    </span>
                    {session.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg" style={{ background: t.surface2, color: t.textSec, fontSize: 11, fontWeight: 600 }}>{tag}</span>
                    ))}
                  </div>

                  {/* Session actions */}
                  {(session.pollId || session.surveyId) && (
                    <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: `1px solid ${t.divider}` }}>
                      {session.pollId   && <div className="px-3 py-1.5 rounded-lg" style={{ background: t.infoBg ?? 'rgba(6,182,212,0.12)', color: '#0891b2', fontSize: 12, fontWeight: 600 }}>📊 Live Poll</div>}
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
