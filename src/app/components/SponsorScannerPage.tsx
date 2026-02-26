import React, { useState, useEffect } from 'react';
import {
  QrCode, Type, Save, X, ScanLine, Building2,
  Flame, ThermometerSun, Snowflake, Tag, ChevronDown,
} from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';
import { motion, AnimatePresence } from 'motion/react';

// ─── Mock attendee pool for simulated scans ──────────────────────────────────

const attendeePool = [
  { code: 'ATT-8492', name: 'Sarah Chen',       title: 'Product Designer',         company: 'Stripe',            avatar: 'https://ui-avatars.com/api/?name=Sarah+Chen&background=6366f1&color=fff' },
  { code: 'ATT-3017', name: 'Marcus Johnson',    title: 'VP of Engineering',        company: 'InnovateLab',       avatar: 'https://ui-avatars.com/api/?name=Marcus+Johnson&background=8b5cf6&color=fff' },
  { code: 'ATT-5291', name: 'Priya Patel',       title: 'Data Science Lead',        company: 'DataFlow Systems',  avatar: 'https://ui-avatars.com/api/?name=Priya+Patel&background=ec4899&color=fff' },
  { code: 'ATT-7738', name: 'David Kim',         title: 'Startup Founder & CEO',    company: 'NeuralWave AI',     avatar: 'https://ui-avatars.com/api/?name=David+Kim&background=3b82f6&color=fff' },
  { code: 'ATT-1124', name: 'Elena Rodriguez',   title: 'UX Research Director',     company: 'DesignFirst Studio', avatar: 'https://ui-avatars.com/api/?name=Elena+Rodriguez&background=a855f7&color=fff' },
  { code: 'ATT-6603', name: 'Alex Thompson',     title: 'Cloud Solutions Architect', company: 'CloudStream',       avatar: 'https://ui-avatars.com/api/?name=Alex+Thompson&background=06b6d4&color=fff' },
  { code: 'ATT-9450', name: 'Sophie Laurent',    title: 'Head of DevRel',           company: 'OpenAPI Collective', avatar: 'https://ui-avatars.com/api/?name=Sophie+Laurent&background=14b8a6&color=fff' },
  { code: 'ATT-2285', name: 'Raj Malhotra',      title: 'CTO',                      company: 'FinEdge Technologies', avatar: 'https://ui-avatars.com/api/?name=Raj+Malhotra&background=7c3aed&color=fff' },
];

const QUICK_TAGS = [
  'Follow Up', 'Demo Requested', 'Send Pricing', 'Decision Maker',
  'Technical Lead', 'Budget Holder', 'Interested in Enterprise', 'Referral',
];

type Priority = 'hot' | 'warm' | 'cold';
const priorityConfig: Record<Priority, { label: string; icon: React.ElementType; color: string; bg: string; gradient: string }> = {
  hot:  { label: 'Hot',  icon: Flame,          color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  gradient: 'linear-gradient(135deg,#ef4444,#f97316)' },
  warm: { label: 'Warm', icon: ThermometerSun,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  cold: { label: 'Cold', icon: Snowflake,       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', gradient: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const SponsorScannerPage: React.FC = () => {
  const { t, isDark } = useTheme();
  const { saveLead, leads } = useApp();

  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [manualCode, setManualCode] = useState('');

  // Scanned Data State
  const [scannedData, setScannedData] = useState<typeof attendeePool[0] | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>('warm');
  const [isSaving, setIsSaving] = useState(false);

  // Auto-scan simulation
  useEffect(() => {
    let timeout: any;
    if (mode === 'scan' && !scannedData) {
      // Pick a random attendee that hasn't been scanned yet
      const scannedCodes = leads.map(l => l.code);
      const available = attendeePool.filter(a => !scannedCodes.includes(a.code));
      const pick = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : attendeePool[0];

      timeout = setTimeout(() => {
        handleCodeDetected(pick.code);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [mode, scannedData]);

  const handleCodeDetected = (code: string) => {
    const found = attendeePool.find(a => a.code === code);
    if (found) {
      setScannedData(found);
    } else {
      // Fallback for manual codes
      setScannedData({
        code,
        name: 'Unknown Attendee',
        title: 'Event Attendee',
        company: 'Unknown',
        avatar: `https://ui-avatars.com/api/?name=${code}&background=6b7280&color=fff`,
      });
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.length < 3) return;
    handleCodeDetected(manualCode.toUpperCase());
  };

  const handleSave = () => {
    if (!scannedData) return;
    setIsSaving(true);
    setTimeout(() => {
      saveLead({
        code: scannedData.code,
        name: scannedData.name,
        company: scannedData.company,
        title: scannedData.title,
        notes,
        avatar: scannedData.avatar,
        tags: selectedTags,
        priority,
      });
      setIsSaving(false);
      resetScanner();
    }, 800);
  };

  const resetScanner = () => {
    setScannedData(null);
    setNotes('');
    setManualCode('');
    setSelectedTags([]);
    setPriority('warm');
    setMode('scan');
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen pb-24 relative flex flex-col" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-5 py-3.5 backdrop-blur-md border-b flex items-center justify-between"
        style={{ background: isDark ? 'rgba(7,7,15,0.85)' : 'rgba(255,255,255,0.9)', borderColor: t.border }}>
        <div>
          <h1 style={{ color: t.text, fontSize: 18, fontWeight: 800 }}>Lead Retrieval</h1>
          <p style={{ color: t.textMuted, fontSize: 11, marginTop: 1 }}>
            {leads.length} lead{leads.length !== 1 ? 's' : ''} captured today
          </p>
        </div>
        <div className="flex rounded-lg p-1" style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
          <button
            onClick={() => { if (!scannedData) setMode('scan'); }}
            className="p-2 rounded-md transition-all"
            style={{
              background: mode === 'scan' ? t.accent : 'transparent',
              color: mode === 'scan' ? '#fff' : t.textMuted,
            }}>
            <QrCode size={18} />
          </button>
          <button
            onClick={() => { if (!scannedData) setMode('manual'); }}
            className="p-2 rounded-md transition-all"
            style={{
              background: mode === 'manual' ? t.accent : 'transparent',
              color: mode === 'manual' ? '#fff' : t.textMuted,
            }}>
            <Type size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-y-auto">
        <AnimatePresence mode="wait">
          {scannedData ? (
            // ─── LEAD DETAILS FORM ──────────────────────────────────
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="flex-1 p-5 flex flex-col"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 style={{ color: t.text, fontSize: 18, fontWeight: 800 }}>New Lead</h2>
                <button onClick={resetScanner} className="p-2 rounded-full active:scale-95 transition-transform"
                  style={{ background: t.surface2, color: t.textMuted }}>
                  <X size={18} />
                </button>
              </div>

              {/* ── Scanned Person Card ──────────────────────────── */}
              <div className="rounded-2xl p-4 mb-4" style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={scannedData.avatar} alt={scannedData.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{scannedData.name}</h3>
                    <p style={{ color: t.textSec, fontSize: 13 }}>{scannedData.title}</p>
                    <p className="flex items-center gap-1 mt-0.5" style={{ color: t.textMuted, fontSize: 12 }}>
                      <Building2 style={{ width: 11, height: 11 }} /> {scannedData.company}
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg inline-flex items-center gap-2"
                  style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                  <ScanLine style={{ width: 12, height: 12, color: t.accentSoft }} />
                  <span style={{ color: t.textSec, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                    {scannedData.code}
                  </span>
                </div>
              </div>

              {/* ── Priority Selector ────────────────────────────── */}
              <div className="mb-4">
                <label style={{ color: t.textSec, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Lead Priority
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(priorityConfig) as [Priority, typeof priorityConfig.hot][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    const isActive = priority === key;
                    return (
                      <button key={key} onClick={() => setPriority(key)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all active:scale-[0.97]"
                        style={{
                          background: isActive ? cfg.bg : t.surface,
                          border: `1.5px solid ${isActive ? cfg.color : t.border}`,
                        }}>
                        <Icon style={{ width: 15, height: 15, color: isActive ? cfg.color : t.textMuted }} />
                        <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? cfg.color : t.textSec }}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Quick Tags ────────────────────────────────────── */}
              <div className="mb-4">
                <label style={{ color: t.textSec, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Quick Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAGS.map(tag => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className="px-3 py-1.5 rounded-full transition-all active:scale-[0.96]"
                        style={{
                          background: active ? t.accentBg : t.surface,
                          color: active ? t.accentSoft : t.textSec,
                          fontSize: 12,
                          fontWeight: active ? 700 : 600,
                          border: `1px solid ${active ? t.borderAcc : t.border}`,
                        }}>
                        {active && <span className="mr-1">✓</span>}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Notes ─────────────────────────────────────────── */}
              <div className="mb-5 flex-1">
                <label style={{ color: t.textSec, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Conversation Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Capture key discussion points, pain points, interests, follow-up actions…"
                  rows={5}
                  className="w-full p-4 rounded-xl resize-none outline-none transition-all focus:ring-2"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                    fontSize: 13,
                    lineHeight: 1.6,
                    ringColor: t.inputFocus,
                  }}
                />
                <p className="mt-1.5 text-right" style={{ color: t.textMuted, fontSize: 10 }}>
                  {notes.length} characters
                </p>
              </div>

              {/* ── Save Button ────────────────────────────────────── */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-3.5 rounded-xl text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Saving Lead…</span>
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Save Lead</span>
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            // ─── SCANNER / INPUT VIEW ───────────────────────────────
            <motion.div
              key="scanner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-6 text-center"
            >
              <AnimatePresence mode="wait">
                {mode === 'scan' ? (
                  <motion.div
                    key="scan"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="w-full max-w-xs aspect-square rounded-3xl border-2 relative overflow-hidden mb-8"
                    style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                  >
                    {/* Simulated Camera Feed */}
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)' }}>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace' }}>CAMERA FEED</p>
                    </div>

                    {/* Scanner Overlay */}
                    <div className="absolute inset-0">
                      <div className="absolute top-0 left-0 w-full h-1 bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)] animate-[scan_2s_linear_infinite]" />
                      <div className="absolute inset-0 border-[40px]" style={{ borderColor: 'rgba(0,0,0,0.6)' }} />
                      <div className="absolute inset-8 border-2 rounded-xl" style={{ borderColor: 'rgba(255,255,255,0.25)' }} />
                      {/* Corner markers */}
                      <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl-lg" />
                      <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr-lg" />
                      <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl-lg" />
                      <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br-lg" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="manual"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-sm"
                  >
                    <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                      style={{ background: t.accentBg, border: `1px solid ${t.borderAcc}` }}>
                      <Type size={32} style={{ color: t.accentSoft }} />
                    </div>
                    <h2 style={{ color: t.text, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Enter Badge Code</h2>
                    <p style={{ color: t.textSec, fontSize: 13, marginBottom: 32 }}>
                      Type the code found on the attendee's badge.
                    </p>
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                      <input
                        type="text"
                        placeholder="e.g. ATT-8492"
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="w-full h-14 text-center text-xl tracking-widest uppercase rounded-xl border outline-none transition-all focus:ring-2"
                        style={{
                          borderColor: t.inputBorder,
                          color: t.text,
                          background: t.inputBg,
                          fontFamily: 'monospace',
                          ringColor: t.inputFocus,
                        }}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={manualCode.length < 3}
                        className="w-full py-3.5 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Find Attendee</span>
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'scan' && (
                <p className="animate-pulse" style={{ color: t.textSec, fontSize: 13, fontWeight: 600 }}>
                  Scanning for attendee badge…
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};
