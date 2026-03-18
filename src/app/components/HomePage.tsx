import React, { useState } from 'react';
import { ArrowRight, Calendar, MapPin, X, QrCode, Building2, ChevronRight, Video, CalendarDays } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { SocialFeed } from '@/app/components/feed/SocialFeed';
import { EventsPage } from '@/app/components/EventsPage';
import { motion, AnimatePresence } from 'motion/react';

interface HomePageProps { onNavigate: (page: string) => void; }

type MainTab = 'feed' | 'events';

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { user, eventConfig, hasJoinedEvent, joinEvent, showToast } = useApp();
  const { t } = useTheme();
  const [activeTab, setActiveTab] = useState<MainTab>('feed');
  const [isJoining, setIsJoining] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [eventCode, setEventCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  if (!user) return null;

  const handleJoinClick = () => {
    if (user.isRegistered) {
      performJoin();
    } else {
      setShowCodeInput(true);
    }
  };

  const performJoin = () => {
    setIsJoining(true);
    setTimeout(() => {
      joinEvent();
      setIsJoining(false);
      setShowCodeInput(false);
    }, 1500);
  };

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (eventCode.length < 4) { showToast('Invalid event code'); return; }
    performJoin();
  };

  const handleScan = () => {
    setShowScanner(true);
    setTimeout(() => { setShowScanner(false); performJoin(); }, 2000);
  };

  return (
    <div className="min-h-screen" style={{ background: t.bgPage }}>

      {/* ── Join Event Banner ──────────────────────────────────────────── */}
      <AnimatePresence>
        {!hasJoinedEvent && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="px-4 pt-4 overflow-hidden"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              <div className="absolute inset-0">
                <img src="https://images.unsplash.com/photo-1573339887617-d674bc961c31?ixlib=rb-1.2.1&auto=format&fit=crop&w=1080&q=80" alt="Event" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(7,7,15,0.95), rgba(7,7,15,0.6))' }} />
              </div>
              <div className="relative p-5">
                {!showCodeInput ? (
                  <div className="flex flex-col items-start gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md mb-2 border backdrop-blur-sm"
                        style={{ background: 'rgba(124,58,237,0.2)', borderColor: 'rgba(124,58,237,0.3)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider">Happening Now</span>
                      </div>
                      <h2 className="text-xl font-black text-white leading-tight mb-1">{eventConfig.name}</h2>
                      <div className="flex items-center gap-3 text-white/70 text-xs">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {eventConfig.dates}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {eventConfig.location}</span>
                      </div>
                    </div>
                    <div className="w-full flex items-center justify-between gap-4 mt-1">
                      <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-7 h-7 rounded-full border-2 border-[#111120] bg-gray-600 overflow-hidden">
                            <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="Attendee" className="w-full h-full object-cover" />
                          </div>
                        ))}
                        <div className="w-7 h-7 rounded-full border-2 border-[#111120] bg-gray-800 flex items-center justify-center text-[9px] font-bold text-white">+1k</div>
                      </div>
                      <button onClick={handleJoinClick} disabled={isJoining}
                        className="flex-1 max-w-[140px] py-2.5 rounded-xl font-bold text-xs text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                        style={{ background: t.accent }}>
                        {isJoining
                          ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <><span>Join Now</span><ArrowRight size={14} /></>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-white">Enter Event Code</h2>
                      <button onClick={() => setShowCodeInput(false)} className="p-1 rounded-full bg-white/10 text-white"><X size={16} /></button>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed">Please enter the code from your invitation or scan the QR code at the venue.</p>
                    <form onSubmit={handleSubmitCode} className="flex gap-2">
                      <input type="text" placeholder="e.g. 8492" value={eventCode} onChange={e => setEventCode(e.target.value)}
                        className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white placeholder:text-white/30 outline-none focus:border-violet-500 font-mono text-center tracking-widest uppercase" />
                      <button type="submit" disabled={!eventCode || isJoining}
                        className="px-4 py-2 rounded-xl font-bold text-sm text-white shadow-lg active:scale-95 disabled:opacity-50"
                        style={{ background: t.accent }}>
                        {isJoining ? '...' : <ArrowRight size={18} />}
                      </button>
                    </form>
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                      <span className="relative bg-[#1a1a2e] px-2 text-[10px] text-white/40 uppercase font-bold">Or</span>
                    </div>
                    <button onClick={handleScan}
                      className="w-full py-3 rounded-xl border border-white/20 bg-white/5 flex items-center justify-center gap-2 text-white font-medium hover:bg-white/10">
                      <QrCode size={18} /><span>Scan QR Code</span>
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sponsor Event Card ─────────────────────────────────────────── */}
      {user.role === 'sponsor' && (
        <div className="px-4 pt-3 pb-1">
          <button onClick={() => onNavigate('sponsor-event')}
            className="w-full rounded-2xl p-4 text-left active:scale-[0.98] transition-all relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#312e81,#4f46e5)', boxShadow: '0 4px 24px rgba(79,70,229,0.2)' }}>
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <Building2 style={{ width: 20, height: 20, color: '#c4b5fd' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>{eventConfig.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{eventConfig.dates} · {eventConfig.location}</p>
              </div>
              <ChevronRight style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.4)' }} />
            </div>
          </button>
        </div>
      )}

      {/* ── Feed / Events Tab Bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-30 pt-3 pb-0" style={{ background: t.bgPage }}>
        <div className="flex items-center gap-1 px-4 pb-0">
          {([
            { id: 'feed' as MainTab,   label: 'Feed',   icon: Video },
            { id: 'events' as MainTab, label: 'Events', icon: CalendarDays },
          ] as { id: MainTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: isActive ? (t.surface) : 'transparent',
                  color: isActive ? t.accent : t.textMuted,
                  border: isActive ? `1px solid ${t.border}` : '1px solid transparent',
                  boxShadow: isActive ? t.shadow : 'none',
                }}>
                <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </button>
            );
          })}
        </div>
        {/* Tab underline divider */}
        <div className="mt-2 h-px" style={{ background: t.divider }} />
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'feed' ? (
          <motion.div key="feed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <SocialFeed onNavigate={onNavigate} />
          </motion.div>
        ) : (
          <motion.div key="events" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            <EventsPage onNavigate={onNavigate} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scanner overlay ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showScanner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
            <div className="absolute top-0 left-0 w-full p-6 flex justify-end">
              <button onClick={() => setShowScanner(false)} className="p-2 rounded-full bg-black/50 text-white"><X size={24} /></button>
            </div>
            <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-[scan_2s_linear_infinite]" />
              <div className="w-full h-full bg-white/5 animate-pulse" />
            </div>
            <p className="text-white/70 mt-8 text-sm font-medium">Align QR code within the frame</p>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }`}</style>
    </div>
  );
};
