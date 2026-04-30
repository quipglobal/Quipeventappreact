import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Gift, Trophy, Users, Sparkles, RotateCcw,
  Crown, Star, PartyPopper, Building2, Tag, Flame,
  ThermometerSun, Snowflake, ChevronDown, Plus, X, Check,
} from 'lucide-react';
import { useApp, Lead, SponsorGiveaway } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { triggerLuckyDraw, listLeads } from '@/app/api/leadsClient';

// ─── Draw history entry ──────────────────────────────────────────────────────

interface DrawParticipant {
  id: string;
  name: string;
  company: string;
  title: string;
  avatar: string;
}

interface DrawEntry {
  id: string;
  prizeName: string;
  giveawayId?: string;
  winner: DrawParticipant;
  timestamp: Date;
}

type DrawPhase = 'setup' | 'spinning' | 'winner' | 'history';

// ─── Component ───────────────────────────────────────────────────────────────

interface SponsorDrawPageProps {
  onBack: () => void;
}

export const SponsorDrawPage: React.FC<SponsorDrawPageProps> = ({ onBack }) => {
  const { sponsorGiveaways, user, showToast, eventConfig, recordGiveawayWinner, isMyGiveaway } = useApp();
  const { t, isDark } = useTheme();
  const [poolLeads, setPoolLeads] = useState<Lead[]>([]);

  useEffect(() => {
    listLeads(eventConfig?.eventId ?? '0').then(res => {
      if (res.success && res.data) {
        setPoolLeads(res.data);
      }
    });
  }, [eventConfig?.eventId]);

  // Show every giveaway returned by the event-scoped backend list,
  // not just the ones whose `sponsorId`/`sponsorName` happen to match
  // the current rep's identifiers. Backends frequently re-stamp
  // sponsor_id with their own foreign key on write (so what comes
  // back doesn't equal `user.id`), and the previous strict filter
  // hid the rep's own freshly-added prize whenever that happened —
  // which was the root cause of "added giveaway not appearing on
  // Lucky Draw" in the field. The list is already authorized + event-
  // scoped server-side, and SponsorGiveawaysPage now uses the same
  // unfiltered list so the two screens stay in sync. `isMyGiveaway`
  // is still used below to decide whether to render edit/delete
  // affordances on individual cards.
  const drawableGiveaways = sponsorGiveaways;
  // Surfaced for parity with the manage screen — kept around for
  // any future "owned by me" pill we might add.
  void isMyGiveaway;

  const [phase, setPhase] = useState<DrawPhase>('setup');
  const [selectedGiveaway, setSelectedGiveaway] = useState<SponsorGiveaway | null>(null);
  const [showGiveawayPicker, setShowGiveawayPicker] = useState(false);
  const [drawHistory, setDrawHistory] = useState<DrawEntry[]>([]);
  const [winner, setWinner] = useState<DrawParticipant | null>(null);
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [excludeWon, setExcludeWon] = useState(true);
  const shuffleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Single-flight guard so a rapid double-click on "Pick a Winner!"
  // can't kick off two overlapping draws (each with its own shuffle
  // interval and its own `recordGiveawayWinner` write). The button
  // is also gated by `phase !== 'setup'` rendering, but the phase
  // flip is async and a fast user can fire two clicks before React
  // re-renders.
  const drawInFlightRef = useRef(false);

  // Whenever the rep picks a giveaway, surface every winner the merged
  // giveaway list already carries — backend-arbitrated picks (admin in
  // the back-office or another rep on a different device, once the
  // backend list endpoint serves native `winners`) are unioned with
  // this device's local overlay in AppContext, so we just need to keep
  // `drawHistory` in sync with that source of truth.
  //
  // Crucially we MERGE (union by winner id) instead of replacing,
  // because:
  //   • the giveaway list can refetch mid-draw (event change, focus
  //     refresh, optimistic update settling) and a hard replace would
  //     wipe an in-progress local draw entry that hasn't propagated
  //     back to `sponsorGiveaways[i].winners` yet;
  //   • freshly added local entries (`setDrawHistory(prev => [...])`
  //     in the success path below) MUST survive the next refetch tick
  //     even before the overlay round-trip completes;
  //   • dedupe keeps `excludeWon` honest if the same id appears in
  //     both the seed and a recent local pick.
  //
  // This effect MUST live below the `selectedGiveaway`/`drawHistory`
  // useState declarations above — referencing them earlier in the
  // function body trips the temporal dead zone and crashes
  // SponsorDrawPage on mount with "Cannot access 'selectedGiveaway'
  // before initialization".
  useEffect(() => {
    if (!selectedGiveaway?.id) {
      setDrawHistory([]);
      return;
    }
    const live = sponsorGiveaways.find(g => g.id === selectedGiveaway.id);
    const winners = live?.winners ?? [];
    if (winners.length === 0) return; // nothing new to merge in
    setDrawHistory(prev => {
      const known = new Set(prev.map(e => e.winner.id));
      const seedEntries: DrawEntry[] = winners
        .filter(w => w?.id && !known.has(w.id))
        .map((w, idx) => ({
          // Stable id derived from the winner so a re-seed doesn't
          // change React keys (avoids pointless list re-mounts).
          id: `seed-${selectedGiveaway.id}-${w.id}-${idx}`,
          prizeName: live?.title ?? selectedGiveaway.title ?? 'Lucky Draw Prize',
          giveawayId: selectedGiveaway.id,
          winner: {
            id: w.id,
            name: w.name,
            company: w.company ?? '',
            title: w.title ?? '',
            avatar: w.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&background=7c3aed&color=fff`,
          },
          timestamp: w.drawnAt ? new Date(w.drawnAt) : new Date(),
        }));
      if (seedEntries.length === 0) return prev;
      // Newest seeds first, then existing local entries — matches the
      // append-to-front convention used by the live draw success path.
      return [...seedEntries, ...prev];
    });
  }, [selectedGiveaway?.id, sponsorGiveaways]);

  // Convert backend leads to common DrawParticipant format
  const basePool: DrawParticipant[] = useMemo(() => {
    return poolLeads.map(l => ({
      id: l.id,
      name: l.name,
      company: l.company,
      title: l.title,
      avatar: l.avatar || '',
    }));
  }, [poolLeads]);

  // Pool excluding previous winners if enabled
  const eligiblePool = useMemo(() => {
    if (!excludeWon) return basePool;
    const wonIds = new Set(drawHistory.map(d => d.winner.id));
    return basePool.filter(l => !wonIds.has(l.id));
  }, [basePool, drawHistory, excludeWon]);

  const prizeName = selectedGiveaway?.title || 'Lucky Draw Prize';

  const startDraw = async () => {
    if (eligiblePool.length === 0) return;
    if (drawInFlightRef.current) return;
    drawInFlightRef.current = true;
    setPhase('spinning');
    setWinner(null);

    // Snapshot the event id BEFORE we kick off the async draw so a
    // mid-flight `switchEvent` can't cause this winner to be filed
    // under a different event's overlay key. AppContext also gates
    // its in-memory state mutation on this snapshot.
    const eventIdAtDrawStart = eventConfig?.eventId ?? '0';
    const giveawayIdAtDrawStart = selectedGiveaway?.id;

    const excludeIds = drawHistory.map(d => d.winner.id);
    // Snapshot the eligible pool BEFORE we kick off the network call —
    // we need it as the source for the local-fallback random pick when
    // the backend has no `/leads/draw` endpoint deployed (the resolver
    // returns NOT_IMPLEMENTED). Picking later from the live `eligiblePool`
    // ref would race the shuffle animation's `setShuffleIndex` updates.
    const localPool = eligiblePool;
    const drawPromise = triggerLuckyDraw(eventIdAtDrawStart, {
      giveawayId: giveawayIdAtDrawStart,
      excludeIds: excludeWon ? excludeIds : undefined,
    }).then(res => {
      // Backend doesn't ship a draw endpoint yet (see leadsClient.ts
      // for the full Laravel route-collision write-up). Substitute a
      // client-side random pick so the UX still completes — the result
      // is persisted to the per-event winners overlay below, exactly
      // the same way a server-arbitrated winner would have been.
      if (!res.success && res.error?.code === 'NOT_IMPLEMENTED') {
        if (localPool.length === 0) {
          return {
            success: false as const,
            error: { code: 'EMPTY_POOL', message: 'No eligible participants in the draw pool.' },
          };
        }
        const w = localPool[Math.floor(Math.random() * localPool.length)];
        return {
          success: true as const,
          data: {
            id: w.id,
            name: w.name,
            company: w.company,
            title: w.title,
            avatar: w.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&background=7c3aed&color=fff`,
          },
        };
      }
      return res;
    });

    let count = 0;
    const totalCycles = 30 + Math.floor(Math.random() * 15);

    const runShuffle = () => {
      shuffleRef.current = setInterval(() => {
        count++;
        setShuffleIndex(Math.floor(Math.random() * eligiblePool.length));

        if (count > totalCycles - 10) {
          clearInterval(shuffleRef.current);
          shuffleRef.current = setInterval(() => {
            count++;
            setShuffleIndex(Math.floor(Math.random() * eligiblePool.length));
            if (count >= totalCycles) {
              clearInterval(shuffleRef.current);
              drawPromise.then(res => {
                if (!res.success || !res.data) {
                  setPhase('setup');
                  // Surface a friendly, actionable message ONLY for codes
                  // we explicitly recognize (e.g. EMPTY_POOL after the
                  // local-fallback substitution found nothing). Anything
                  // else gets the generic copy so a raw Laravel
                  // exception (like the original
                  // `MobileEventController::leadsUpdate(): Argument #3
                  // ($scanId) must be of type int, string given`) can
                  // never bubble through `apiClient.parseResponse`'s
                  // pass-through `message` into a user-facing toast.
                  // The original error is still visible to engineers
                  // via the dev console below.
                  const code = res.error?.code;
                  let toastMsg = 'Draw failed. Please try again.';
                  if (code === 'EMPTY_POOL') {
                    toastMsg = 'No eligible participants in the draw pool.';
                  } else if (code === 'NETWORK_ERROR') {
                    toastMsg = 'Network error. Please check your connection.';
                  }
                  if (typeof console !== 'undefined' && res.error) {
                    console.warn('[SponsorDrawPage] draw failed:', res.error);
                  }
                  showToast(toastMsg);
                  drawInFlightRef.current = false;
                  return;
                }
                const selectedWinner: DrawParticipant = {
                  id: res.data.id,
                  name: res.data.name,
                  company: res.data.company,
                  title: res.data.title,
                  avatar: res.data.avatar,
                };

                const winnerPoolIdx = eligiblePool.findIndex(p => p.id === selectedWinner.id);
                setShuffleIndex(winnerPoolIdx >= 0 ? winnerPoolIdx : 0);
                setWinner(selectedWinner);
                setDrawHistory(prev => [
                  {
                    id: Date.now().toString(),
                    prizeName,
                    giveawayId: selectedGiveaway?.id,
                    winner: selectedWinner,
                    timestamp: new Date(),
                  },
                  ...prev,
                ]);
                // Persist the winner against the selected giveaway so
                // the public Giveaways screen can show their name.
                // Only record when the rep actually picked a giveaway
                // (we still allow ad-hoc draws when no giveaway exists).
                // We pass `giveawayIdAtDrawStart` and the snapshotted
                // event id so a mid-draw selection change or event
                // switch can't reroute the win.
                if (giveawayIdAtDrawStart) {
                  recordGiveawayWinner(
                    giveawayIdAtDrawStart,
                    {
                      id: selectedWinner.id,
                      name: selectedWinner.name,
                      company: selectedWinner.company,
                      title: selectedWinner.title,
                      avatar: selectedWinner.avatar,
                      drawnAt: new Date().toISOString(),
                    },
                    eventIdAtDrawStart,
                  );
                }
                setTimeout(() => setPhase('winner'), 300);
                drawInFlightRef.current = false;
              });
            }
          }, 200);
        }
      }, 60);
    };

    runShuffle();
  };

  useEffect(() => {
    return () => {
      if (shuffleRef.current) clearInterval(shuffleRef.current);
    };
  }, []);

  const resetDraw = () => {
    setPhase('setup');
    setSelectedGiveaway(null);
    setWinner(null);
    // Defensive: in any unexpected exit from the draw flow, free the
    // single-flight gate so the rep isn't stuck unable to start a
    // new draw without reloading the page.
    drawInFlightRef.current = false;
  };

  const drawAgain = () => {
    setPhase('setup');
    setWinner(null);
    drawInFlightRef.current = false;
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
            Pick a winner from your leads or checked-in attendees
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
              {/* Giveaway selector */}
              <div className="mb-5">
                <label style={{ color: t.textSec, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Select Giveaway
                </label>
                {drawableGiveaways.length > 0 ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowGiveawayPicker(!showGiveawayPicker)}
                      className="w-full px-4 py-3 rounded-xl text-left flex items-center justify-between active:scale-[0.99] transition-all"
                      style={{
                        background: t.inputBg,
                        border: `1px solid ${selectedGiveaway ? t.accent : t.inputBorder}`,
                        color: selectedGiveaway ? t.text : t.textMuted,
                        fontSize: 13,
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {selectedGiveaway?.image && (
                          <img src={selectedGiveaway.image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="truncate block" style={{ fontWeight: selectedGiveaway ? 600 : 400 }}>
                            {selectedGiveaway ? selectedGiveaway.title : 'Choose a giveaway for this draw…'}
                          </span>
                          {selectedGiveaway && (
                            <span style={{ color: t.textMuted, fontSize: 11 }}>
                              {selectedGiveaway.numberOfItems} item{selectedGiveaway.numberOfItems !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronDown style={{ width: 16, height: 16, color: t.textMuted, flexShrink: 0, transform: showGiveawayPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    <AnimatePresence>
                      {showGiveawayPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-20 w-full mt-2 rounded-xl overflow-hidden"
                          style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
                        >
                          {drawableGiveaways.map((g, i) => (
                            <button
                              key={g.id}
                              onClick={() => {
                                setSelectedGiveaway(g);
                                setShowGiveawayPicker(false);
                              }}
                              className="w-full px-4 py-3 flex items-center gap-3 text-left active:opacity-70 transition-opacity"
                              style={{
                                background: selectedGiveaway?.id === g.id ? t.accentBg : 'transparent',
                                borderBottom: i < drawableGiveaways.length - 1 ? `1px solid ${t.divider}` : 'none',
                              }}
                            >
                              {g.image ? (
                                <img src={g.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
                                  <Gift style={{ width: 18, height: 18, color: '#fff' }} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="truncate" style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>{g.title}</p>
                                <p style={{ color: t.textMuted, fontSize: 11 }}>
                                  {g.numberOfItems} item{g.numberOfItems !== 1 ? 's' : ''}
                                </p>
                              </div>
                              {selectedGiveaway?.id === g.id && (
                                <Check style={{ width: 16, height: 16, color: t.accent, flexShrink: 0 }} />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 text-center" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <Gift style={{ width: 20, height: 20, color: t.textMuted, margin: '0 auto 6px' }} />
                    <p style={{ color: t.textSec, fontSize: 12, fontWeight: 600 }}>No giveaways created yet</p>
                    <p style={{ color: t.textMuted, fontSize: 11 }}>Add giveaways from the Leads page first</p>
                  </div>
                )}
              </div>

              {/* Pool source indicator */}
              <div className="mb-5 rounded-xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.15)' }}>
                  <Users style={{ width: 16, height: 16, color: '#10b981' }} />
                </div>
                <div>
                  <p style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>
                    Drawing from scanned leads
                  </p>
                  <p style={{ color: t.textMuted, fontSize: 11 }}>
                    {`${eligiblePool.length} lead${eligiblePool.length !== 1 ? 's' : ''} in pool`}
                  </p>
                </div>
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
                  Eligible Pool ({eligiblePool.length} lead{eligiblePool.length !== 1 ? 's' : ''})
                </h3>
                {eligiblePool.length === 0 ? (
                  <div className="rounded-xl p-6 text-center" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ background: t.surface2 }}>
                      <Users style={{ width: 24, height: 24, color: t.emptyIcon }} />
                    </div>
                    <p style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>No eligible participants</p>
                    <p style={{ color: t.textMuted, fontSize: 12 }}>
                      {drawHistory.length > 0 ? 'All participants have already won. Toggle off "Exclude previous winners" to re-enter them.' : 'Scan attendee badges to build your lead pool, or check-in attendees will be used.'}
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
                          +{eligiblePool.length - 5} more in the pool
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Draw button */}
              <button
                onClick={startDraw}
                disabled={eligiblePool.length === 0 || (drawableGiveaways.length > 0 && !selectedGiveaway)}
                className="w-full py-4 rounded-2xl text-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg,#f59e0b,#d97706)',
                  boxShadow: '0 4px 24px rgba(245,158,11,0.3)',
                }}
              >
                <Gift style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 16, fontWeight: 800 }}>
                  {drawableGiveaways.length > 0 && !selectedGiveaway ? 'Select a Giveaway First' : 'Pick a Winner!'}
                </span>
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

                  <div className="mt-4 px-4 py-2 rounded-xl inline-flex items-center gap-2 mx-auto"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    {selectedGiveaway?.image && (
                      <img src={selectedGiveaway.image} alt="" className="w-6 h-6 rounded object-cover" />
                    )}
                    <Gift style={{ width: 14, height: 14, color: '#f59e0b' }} />
                    <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>
                      {prizeName}
                    </span>
                  </div>
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
