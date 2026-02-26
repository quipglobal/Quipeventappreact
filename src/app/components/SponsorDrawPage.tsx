import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Gift, Trophy, Users, Sparkles, RotateCcw,
  Crown, Star, PartyPopper, Building2, Tag, Flame,
  ThermometerSun, Snowflake, ChevronDown, Plus, X, Check,
} from 'lucide-react';
import { useApp, Lead } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

// ─── Mock pre-populated leads (same as LeadsPage for consistency) ────────────

const mockPrePopulatedLeads: Lead[] = [
  {
    id: 'pre-1', code: 'ATT-4419', name: 'Olivia Martinez', title: 'Head of Procurement',
    company: 'Global Logistics Corp', avatar: 'https://ui-avatars.com/api/?name=Olivia+Martinez&background=ec4899&color=fff',
    notes: '', tags: ['Decision Maker'], priority: 'hot', timestamp: new Date(Date.now() - 45 * 60000),
  },
  {
    id: 'pre-2', code: 'ATT-2781', name: 'James Park', title: 'Senior DevOps Engineer',
    company: 'Fintech Innovations', avatar: 'https://ui-avatars.com/api/?name=James+Park&background=3b82f6&color=fff',
    notes: '', tags: ['Technical Lead'], priority: 'warm', timestamp: new Date(Date.now() - 90 * 60000),
  },
  {
    id: 'pre-3', code: 'ATT-6155', name: 'Amara Osei', title: 'Innovation Manager',
    company: 'Deloitte Digital', avatar: 'https://ui-avatars.com/api/?name=Amara+Osei&background=10b981&color=fff',
    notes: '', tags: ['Referral'], priority: 'warm', timestamp: new Date(Date.now() - 150 * 60000),
  },
  {
    id: 'pre-4', code: 'ATT-8830', name: 'Chen Wei', title: 'Staff Software Engineer',
    company: 'ByteScale', avatar: 'https://ui-avatars.com/api/?name=Chen+Wei&background=8b5cf6&color=fff',
    notes: '', tags: [], priority: 'cold', timestamp: new Date(Date.now() - 200 * 60000),
  },
  {
    id: 'pre-5', code: 'ATT-3372', name: 'Fatima Al-Rashid', title: 'VP of Technology',
    company: 'Emirates Digital', avatar: 'https://ui-avatars.com/api/?name=Fatima+AlRashid&background=f59e0b&color=fff',
    notes: '', tags: ['Decision Maker', 'Budget Holder'], priority: 'hot', timestamp: new Date(Date.now() - 25 * 60000),
  },
];

// ─── Draw history entry ──────────────────────────────────────────────────────

interface DrawEntry {
  id: string;
  prizeName: string;
  winner: Lead;
  timestamp: Date;
}

type DrawPhase = 'setup' | 'spinning' | 'winner' | 'history';

// ─── Component ───────────────────────────────────────────────────────────────

interface SponsorDrawPageProps {
  onBack: () => void;
}

export const SponsorDrawPage: React.FC<SponsorDrawPageProps> = ({ onBack }) => {
  const { leads } = useApp();
  const { t, isDark } = useTheme();

  // Combine real + mock leads
  const allLeads = useMemo(() => {
    const realCodes = leads.map(l => l.code);
    const uniqueMocks = mockPrePopulatedLeads.filter(m => !realCodes.includes(m.code));
    return [...leads, ...uniqueMocks];
  }, [leads]);

  const [phase, setPhase] = useState<DrawPhase>('setup');
  const [prizeName, setPrizeName] = useState('');
  const [drawHistory, setDrawHistory] = useState<DrawEntry[]>([]);
  const [winner, setWinner] = useState<Lead | null>(null);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [excludeWon, setExcludeWon] = useState(true);
  const shuffleRef = useRef<any>(null);

  // Pool excluding previous winners if enabled
  const eligiblePool = useMemo(() => {
    if (!excludeWon) return allLeads;
    const wonIds = new Set(drawHistory.map(d => d.winner.id));
    return allLeads.filter(l => !wonIds.has(l.id));
  }, [allLeads, drawHistory, excludeWon]);

  const startDraw = () => {
    if (eligiblePool.length === 0) return;
    setPhase('spinning');
    setWinner(null);

    let count = 0;
    const totalCycles = 30 + Math.floor(Math.random() * 15); // 30–45 cycles
    const winnerIdx = Math.floor(Math.random() * eligiblePool.length);

    shuffleRef.current = setInterval(() => {
      count++;
      setShuffleIndex(Math.floor(Math.random() * eligiblePool.length));

      // Slow down towards the end
      if (count > totalCycles - 10) {
        clearInterval(shuffleRef.current);
        shuffleRef.current = setInterval(() => {
          count++;
          setShuffleIndex(Math.floor(Math.random() * eligiblePool.length));
          if (count >= totalCycles) {
            clearInterval(shuffleRef.current);
            setShuffleIndex(winnerIdx);
            const selectedWinner = eligiblePool[winnerIdx];
            setWinner(selectedWinner);
            setDrawHistory(prev => [
              {
                id: Date.now().toString(),
                prizeName: prizeName || 'Lucky Draw Prize',
                winner: selectedWinner,
                timestamp: new Date(),
              },
              ...prev,
            ]);
            setTimeout(() => setPhase('winner'), 300);
          }
        }, 200);
      }
    }, 60);
  };

  useEffect(() => {
    return () => {
      if (shuffleRef.current) clearInterval(shuffleRef.current);
    };
  }, []);

  const resetDraw = () => {
    setPhase('setup');
    setPrizeName('');
    setWinner(null);
  };

  const drawAgain = () => {
    setPhase('setup');
    setWinner(null);
  };

  const currentShuffled = eligiblePool[shuffleIndex] ?? null;

  return (
    <div className="min-h-screen relative" style={{ background: t.bgPage }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-5"
        style={{
          background: isDark
            ? 'linear-gradient(160deg,#1e1b4b 0%,#4c1d95 50%,#7c3aed 100%)'
            : 'linear-gradient(160deg,#7c3aed 0%,#a855f7 50%,#c084fc 100%)',
        }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #fbbf24, transparent 70%)' }} />
        <div className="absolute bottom-0 -left-6 w-32 h-32 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-4 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
          </button>

          <div className="flex items-center gap-2.5 mb-1">
            <Gift style={{ width: 22, height: 22, color: '#fbbf24' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Sponsor Tool
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
            Lucky Draw
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            Randomly pick a winner from your scanned leads
          </p>

          <div className="flex items-center gap-2.5 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Users style={{ width: 13, height: 13, color: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{eligiblePool.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>eligible</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Trophy style={{ width: 12, height: 12, color: '#fbbf24' }} />
              <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700 }}>{drawHistory.length}</span>
              <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 11 }}>drawn</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="px-5 py-5">
        <AnimatePresence mode="wait">
          {/* ── SETUP PHASE ──────────────────────────────────── */}
          {phase === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              {/* Prize name input */}
              <div className="mb-5">
                <label style={{ color: t.textSec, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Prize Name (optional)
                </label>
                <input
                  type="text"
                  value={prizeName}
                  onChange={e => setPrizeName(e.target.value)}
                  placeholder="e.g., AirPods Pro, $100 Gift Card, Conference Pass…"
                  className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                    fontSize: 13,
                    ringColor: t.inputFocus,
                  }}
                />
              </div>

              {/* Exclude previous winners toggle */}
              <div className="flex items-center justify-between mb-5 rounded-xl px-4 py-3"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div>
                  <p style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>Exclude previous winners</p>
                  <p style={{ color: t.textMuted, fontSize: 11 }}>Prevent same person from winning twice</p>
                </div>
                <button onClick={() => setExcludeWon(!excludeWon)}
                  className="w-12 h-7 rounded-full transition-all relative active:scale-95"
                  style={{
                    background: excludeWon ? t.accent : t.surface2,
                    border: `1px solid ${excludeWon ? t.accent : t.border}`,
                  }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all"
                    style={{ left: excludeWon ? 24 : 2 }} />
                </button>
              </div>

              {/* Eligible pool preview */}
              <div className="mb-5">
                <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                  Eligible Pool ({eligiblePool.length} leads)
                </h3>
                {eligiblePool.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ background: t.surface2 }}>
                      <Users style={{ width: 24, height: 24, color: t.emptyIcon }} />
                    </div>
                    <p style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No eligible leads</p>
                    <p style={{ color: t.textMuted, fontSize: 12 }}>
                      {drawHistory.length > 0 ? 'All leads have already won. Toggle off "Exclude previous winners" to re-enter them.' : 'Scan some attendee badges first to build your lead pool.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    {eligiblePool.slice(0, 5).map((lead, i) => (
                      <div key={lead.id} className="flex items-center gap-3 px-4 py-2.5"
                        style={{ borderBottom: i < Math.min(eligiblePool.length, 5) - 1 ? `1px solid ${t.divider}` : 'none' }}>
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                          {lead.avatar ? (
                            <img src={lead.avatar} alt={lead.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontSize: 12, fontWeight: 800 }}>
                              {lead.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>{lead.name}</p>
                          <p className="truncate" style={{ color: t.textMuted, fontSize: 10 }}>{lead.company}</p>
                        </div>
                      </div>
                    ))}
                    {eligiblePool.length > 5 && (
                      <div className="px-4 py-2 text-center" style={{ background: t.surface2 }}>
                        <span style={{ color: t.textMuted, fontSize: 11, fontWeight: 600 }}>
                          +{eligiblePool.length - 5} more leads in the pool
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Draw button */}
              <button
                onClick={startDraw}
                disabled={eligiblePool.length === 0}
                className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  boxShadow: '0 4px 24px rgba(245,158,11,0.3)',
                }}
              >
                <Gift style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 16, fontWeight: 800 }}>Pick a Winner!</span>
              </button>
            </motion.div>
          )}

          {/* ── SPINNING PHASE ───────────────────────────────── */}
          {phase === 'spinning' && currentShuffled && (
            <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8">
              {/* Shuffling card */}
              <div className="mb-6">
                <p className="text-center mb-4"
                  style={{ color: t.textMuted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Shuffling…
                </p>
                <motion.div
                  key={currentShuffled.id + shuffleIndex}
                  initial={{ scale: 0.9, rotateY: -90 }}
                  animate={{ scale: 1, rotateY: 0 }}
                  transition={{ duration: 0.05 }}
                  className="w-64 rounded-2xl p-5 text-center mx-auto"
                  style={{
                    background: t.surface,
                    border: `2px solid ${t.borderAcc}`,
                    boxShadow: `0 0 30px rgba(124,58,237,0.2), ${t.shadowHov}`,
                  }}
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden mx-auto mb-3">
                    {currentShuffled.avatar ? (
                      <img src={currentShuffled.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontSize: 22, fontWeight: 800 }}>
                        {currentShuffled.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{currentShuffled.name}</p>
                  <p style={{ color: t.textSec, fontSize: 12 }}>{currentShuffled.company}</p>
                </motion.div>
              </div>

              {/* Pulsing dots */}
              <div className="flex items-center gap-2">
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full"
                    style={{ background: t.accent }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── WINNER PHASE ─────────────────────────────────── */}
          {phase === 'winner' && winner && (
            <motion.div key="winner" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="flex flex-col items-center py-6"
            >
              {/* Confetti / celebration header */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="mb-4"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 0 40px rgba(245,158,11,0.4)' }}>
                  <Crown style={{ width: 28, height: 28, color: '#fff' }} />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ color: '#f59e0b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}
              >
                We Have a Winner!
              </motion.p>

              {/* Winner card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="w-full rounded-2xl p-6 text-center relative overflow-hidden"
                style={{
                  background: t.surface,
                  border: `2px solid rgba(245,158,11,0.4)`,
                  boxShadow: `0 0 40px rgba(245,158,11,0.15), ${t.shadowHov}`,
                }}
              >
                {/* Decorative sparkles */}
                <div className="absolute top-3 left-4">
                  <Sparkles style={{ width: 16, height: 16, color: 'rgba(245,158,11,0.3)' }} />
                </div>
                <div className="absolute top-5 right-6">
                  <Star style={{ width: 12, height: 12, color: 'rgba(245,158,11,0.25)' }} />
                </div>
                <div className="absolute bottom-4 left-8">
                  <Star style={{ width: 10, height: 10, color: 'rgba(124,58,237,0.2)' }} />
                </div>

                <div className="relative z-10">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 ring-4"
                    style={{ ringColor: 'rgba(245,158,11,0.3)' }}>
                    {winner.avatar ? (
                      <img src={winner.avatar} alt={winner.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontSize: 28, fontWeight: 800 }}>
                        {winner.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <h2 style={{ color: t.text, fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{winner.name}</h2>
                  <p style={{ color: t.textSec, fontSize: 14, marginBottom: 2 }}>{winner.title}</p>
                  <p className="flex items-center justify-center gap-1.5" style={{ color: t.textMuted, fontSize: 12 }}>
                    <Building2 style={{ width: 12, height: 12 }} /> {winner.company}
                  </p>

                  {(prizeName || 'Lucky Draw Prize') && (
                    <div className="mt-4 px-4 py-2 rounded-xl inline-flex items-center gap-2 mx-auto"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <Gift style={{ width: 14, height: 14, color: '#f59e0b' }} />
                      <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>
                        {prizeName || 'Lucky Draw Prize'}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 w-full">
                <button onClick={drawAgain}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl active:scale-[0.97] transition-all"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.25)' }}>
                  <RotateCcw style={{ width: 16, height: 16, color: '#fff' }} />
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Draw Again</span>
                </button>
                <button onClick={() => setPhase('history')}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl active:scale-[0.97] transition-all"
                  style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <Trophy style={{ width: 16, height: 16, color: t.accentSoft }} />
                  <span style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>History</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ── HISTORY PHASE ────────────────────────────────── */}
          {phase === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>Draw History</h3>
                <button onClick={() => setPhase('setup')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                  style={{ background: t.accentBg, border: `1px solid ${t.borderAcc}` }}>
                  <Plus style={{ width: 13, height: 13, color: t.accentSoft }} />
                  <span style={{ color: t.accentSoft, fontSize: 12, fontWeight: 700 }}>New Draw</span>
                </button>
              </div>

              {drawHistory.length === 0 ? (
                <div className="rounded-xl p-8 text-center" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ background: t.surface2 }}>
                    <Trophy style={{ width: 24, height: 24, color: t.emptyIcon }} />
                  </div>
                  <p style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No draws yet</p>
                  <p style={{ color: t.textMuted, fontSize: 12 }}>Run your first lucky draw to see results here</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {drawHistory.map((entry, i) => (
                    <motion.div key={entry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl p-4"
                      style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden">
                            {entry.winner.avatar ? (
                              <img src={entry.winner.avatar} alt={entry.winner.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontSize: 16, fontWeight: 800 }}>
                                {entry.winner.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                            <Crown style={{ width: 10, height: 10, color: '#fff' }} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{entry.winner.name}</p>
                          <p className="truncate" style={{ color: t.textSec, fontSize: 12 }}>
                            {entry.winner.title} · {entry.winner.company}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                              style={{ background: 'rgba(245,158,11,0.1)', fontSize: 10, fontWeight: 600, color: '#f59e0b' }}>
                              <Gift style={{ width: 9, height: 9 }} /> {entry.prizeName}
                            </span>
                            <span style={{ color: t.textMuted, fontSize: 10 }}>
                              {entry.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                        </div>

                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(16,185,129,0.1)' }}>
                          <Check style={{ width: 14, height: 14, color: '#10b981' }} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Back to setup */}
              <button onClick={() => setPhase('setup')}
                className="w-full mt-5 py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.25)' }}>
                <Gift style={{ width: 16, height: 16, color: '#fff' }} />
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Start New Draw</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
