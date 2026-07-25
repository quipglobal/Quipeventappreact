import React, { useState } from 'react';
import {
  QrCode, Type, Save, X, ScanLine, Building2,
  Flame, ThermometerSun, Snowflake, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { scanBadgeLead, updateLeadApi } from '@/app/api/leadsClient';
import { saveLeadEdit } from '@/app/lib/leadEditsStorage';
import { findMemberByBadgeCodeApi, checkInMemberApi, type EventMember } from '@/app/api/audienceClient';
import { CameraScanner } from './CameraScanner';

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

interface ScannedAttendee {
  code: string;
  name: string;
  title: string;
  company: string;
  avatar: string;
  memberId?: number;
  isCheckedIn?: boolean;
  /** Lead id created by the backend at scan time, if any. */
  leadId?: string;
  /** True when the badge code didn't match any event member. */
  unrecognized?: boolean;
  /** True when scan-time gamification points were already credited (so
   *  Save doesn't double-award even if the Save-time backend call also
   *  reports points). */
  pointsCreditedAtScan?: boolean;
}

const avatarFor = (name: string, palette = '6b7280') =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${palette}&color=fff`;

function attendeeFromMember(m: EventMember): ScannedAttendee {
  return {
    code: m.badgeCode ?? '',
    name: m.name || 'Unknown Attendee',
    title: m.title ?? '',
    company: m.company ?? '',
    avatar: m.avatar ?? avatarFor(m.name || 'Attendee', '6366f1'),
    memberId: m.memberId,
    isCheckedIn: m.isCheckedIn,
  };
}

export const SponsorScannerPage: React.FC = () => {
  const { t, isDark } = useTheme();
  const { saveLead, updateLead, leads, eventConfig, addPoints, gamificationConfig, showToast, user } = useApp();

  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [manualCode, setManualCode] = useState('');

  const [scannedData, setScannedData] = useState<ScannedAttendee | null>(null);
  const [autoCheckedIn, setAutoCheckedIn] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priority, setPriority] = useState<Priority>('warm');
  const [isSaving, setIsSaving] = useState(false);

  const eventId = eventConfig?.eventId ?? '0';

  const handleCodeDetected = async (code: string) => {
    if (resolving || scannedData) return;
    const trimmed = code.trim();
    if (!trimmed) return;

    // The badge QR encodes either a plain badge code string (legacy) or a
    // structured JSON payload per BACKEND_SCAN_ENDPOINTS.md §QR format:
    //   { "id": "<userId>", "badge_code": "<code>", "event": "<eventCode>" }
    // Extract badge_code from JSON when present; fall back to the raw string.
    let badgeCode = trimmed;
    let scannedUserId: string | undefined;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        if (typeof p.badge_code === 'string' && p.badge_code.trim()) {
          badgeCode = p.badge_code.trim();
        } else if (typeof p.code === 'string' && p.code.trim()) {
          badgeCode = p.code.trim();
        }
        if (typeof p.id === 'string') scannedUserId = p.id;
      }
    } catch {
      // Not JSON — raw string is already the badge code.
    }
    if (!badgeCode) return;

    setResolving(true);
    try {
      // 1. Backend-first resolution. The scan endpoint resolves the attendee
      //    profile, may auto check-in the attendee, and returns the lead row
      //    that the backend created for this scan.
      const scan = await scanBadgeLead(eventId, {
        code: badgeCode,
        ...(scannedUserId ? { scanned_user_id: scannedUserId } : {}),
      } as Parameters<typeof scanBadgeLead>[1]);

      // Treat the scan as resolved only when the server actually returned a
      // recognizable attendee. A successful HTTP shape with no canonical
      // identifier (no name, no code, no memberId) means the backend couldn't
      // resolve the badge — fall through to the audience-list fallback.
      const resolvedByBackend = !!(
        scan.success &&
        scan.data &&
        ((scan.data.name && scan.data.name.trim()) ||
          scan.data.code ||
          typeof scan.data.memberId === 'number')
      );

      if (resolvedByBackend && scan.data) {
        const d = scan.data;
        const attendee: ScannedAttendee = {
          code: d.code || badgeCode,
          name: d.name || 'Unknown Attendee',
          title: d.title || '',
          company: d.company || '',
          avatar: d.avatar || avatarFor(d.name || badgeCode, '6366f1'),
          memberId: d.memberId,
          leadId: d.id,
          isCheckedIn: d.checkedIn === true ? true : undefined,
          unrecognized: typeof d.memberId !== 'number',
        };

        // Auto check-in BEFORE save:
        //   - server already flipped them on this scan (`checkedIn === true`)
        //     → just surface the toast/badge.
        //   - attendee is currently NOT checked-in (`isCheckedIn === false`)
        //     and we have a memberId → call the explicit check-in fallback.
        //   - `isCheckedIn === true` → do nothing; they're already Active.
        let didCheckIn = d.checkedIn === true;
        const alreadyCheckedIn = d.isCheckedIn === true;
        if (!didCheckIn && !alreadyCheckedIn && typeof d.memberId === 'number') {
          const ok = await checkInMemberApi(eventId, d.memberId);
          if (ok) didCheckIn = true;
        }
        if (didCheckIn) {
          setAutoCheckedIn(true);
          attendee.isCheckedIn = true;
        } else if (alreadyCheckedIn) {
          attendee.isCheckedIn = true;
        }

        // Award scan points immediately (the backend already created the lead).
        // The server is the source of truth — `pointsAwarded` reflects the
        // event's lead_scan gamification config, and is 0 when the scan was
        // a duplicate (no double points). If the server omits the field we
        // fall back to the client-side gamification config; otherwise 0 (no
        // toast, no points).
        // If we also auto checked-in, fold that into the same toast so the
        // points feedback doesn't immediately overwrite a separate
        // "Auto checked-in" toast.
        const pts =
          typeof d.pointsAwarded === 'number'
            ? d.pointsAwarded
            : (gamificationConfig?.pointActions as Record<string, number> | undefined)?.scanBadge
              ?? 0;
        const reason = didCheckIn
          ? `Auto checked-in & scanned ${attendee.name}`
          : `Scanned ${attendee.name}'s badge`;
        if (pts > 0) {
          addPoints(pts, reason);
          // Tag the form so handleSave doesn't double-award in Path B if the
          // backend rejects the second /leads/scan call (it's the same scan).
          attendee.pointsCreditedAtScan = true;
        } else if (didCheckIn) {
          showToast(`Auto checked-in ${attendee.name}`);
        }
        setScannedData(attendee);

        // Mirror the new lead into local state so My Leads shows it even if
        // the user navigates away before pressing Save. Silent so we don't
        // pop a "Lead saved" toast before the user has actually saved
        // their notes — they get that toast when they press Save.
        if (d.id) {
          saveLead({
            id: d.id,
            code: d.code,
            name: d.name,
            company: d.company,
            title: d.title,
            notes: d.notes ?? '',
            avatar: d.avatar,
            tags: d.tags ?? [],
            priority: d.priority ?? 'warm',
          }, { silent: true });
        }
        return;
      }

      // 2. Backend could not resolve the code — fall back to the audience
      //    members list and (if found) call the check-in endpoint directly.
      const member = await findMemberByBadgeCodeApi(eventId, badgeCode);
      if (member) {
        const attendee = attendeeFromMember(member);
        setScannedData(attendee);

        if (member.memberId && !member.isCheckedIn) {
          const ok = await checkInMemberApi(eventId, member.memberId);
          if (ok) {
            setAutoCheckedIn(true);
            showToast(`Auto checked-in ${attendee.name}`);
          }
        }
      } else {
        // 3. Truly unknown code — keep the form alive so a sponsor can still
        //    capture notes; lead will be created on Save.
        setScannedData({
          code: badgeCode,
          name: 'Unknown Attendee',
          title: 'Event Attendee',
          company: '',
          avatar: avatarFor(badgeCode),
          unrecognized: true,
        });
      }
    } finally {
      setResolving(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.length < 3) return;
    void handleCodeDetected(manualCode.toUpperCase());
  };

  const handleSave = async () => {
    if (!scannedData) return;
    setIsSaving(true);

    // Path A: backend already created the lead at scan time. Update
    // notes/tags/priority on the server, but ALWAYS apply them locally
    // first so the user's input is never lost — backend failure (e.g. PUT
    // /leads/:id 404'ing because the route isn't deployed yet) becomes a
    // best-effort sync, not a hard error.
    if (scannedData.leadId) {
      // Apply locally first — source of truth for "My Leads".
      updateLead(scannedData.leadId, { notes, tags: selectedTags, priority });
      // Mirror to the per-user edits overlay under the badge code too,
      // since `updateLead`'s code lookup misses on first-ever scans
      // (the lead row hasn't been saved to context yet). The merge
      // falls back to the code key when the server returns this lead
      // under a different id.
      if (user?.id) {
        saveLeadEdit(
          user.id,
          scannedData.leadId,
          { notes, tags: selectedTags, priority },
          scannedData.code,
        );
      }

      const upd = await updateLeadApi(eventId, scannedData.leadId, {
        notes,
        tags: selectedTags,
        priority,
      });
      setIsSaving(false);

      if (!upd.success && upd.error?.code !== '404' && upd.error?.code !== 'NOT_IMPLEMENTED') {
        // Surface only genuine backend errors (validation, server failure).
        // 404 means the update endpoint isn't deployed yet — local save
        // already covered the user; don't alarm them.
        // updateLead already called showToast; suppress the duplicate by
        // logging instead.
        console.warn('[Lead update] backend sync failed:', upd.error);
      }
      resetScanner();
      return;
    }

    // Path B: scan endpoint didn't create a lead (unknown code, audience
    // fallback path, or no-id response). Submit the full payload now to
    // create the lead and award points server-side, but ALWAYS persist
    // locally so the user's notes survive backend hiccups.
    const res = await scanBadgeLead(eventId, {
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

    if (res.success && res.data) {
      // Backend created (or re-resolved) the lead — use its canonical
      // payload, but prefer the user's just-typed notes/tags/priority over
      // whatever the server returned (it usually echoes empty defaults).
      saveLead({
        id: res.data.id,
        code: res.data.code || scannedData.code,
        name: res.data.name || scannedData.name,
        company: res.data.company ?? scannedData.company,
        title: res.data.title ?? scannedData.title,
        notes,
        avatar: res.data.avatar ?? scannedData.avatar,
        tags: selectedTags,
        priority,
      });
      // Mirror notes/tags/priority into the per-user overlay (keyed by
      // both id and badge code) so a later GET /my-leads — which often
      // echoes back null/empty for these fields — still surfaces what
      // the user just typed.
      if (user?.id) {
        saveLeadEdit(
          user.id,
          res.data.id,
          { notes, tags: selectedTags, priority },
          res.data.code || scannedData.code,
        );
      }

      // Auto check-in reconciliation for the fallback path
      if (!autoCheckedIn) {
        if (res.data.checkedIn) {
          showToast(`Auto checked-in ${res.data.name}`);
        } else if (typeof res.data.memberId === 'number') {
          const ok = await checkInMemberApi(eventId, res.data.memberId);
          if (ok) showToast(`Auto checked-in ${res.data.name}`);
        }
      }

      // Use the server's awarded points; 0 means duplicate scan (no toast,
      // no double credit). Only fall back to the local config when the
      // server omits the field entirely.
      const pts =
        typeof res.data.pointsAwarded === 'number'
          ? res.data.pointsAwarded
          : (gamificationConfig?.pointActions as Record<string, number> | undefined)?.scanBadge
            ?? 0;
      if (pts > 0) {
        addPoints(pts, `Scanned ${res.data.name}'s badge`);
      }

      resetScanner();
      return;
    }

    // Backend rejected the save (route missing, duplicate, server error,
    // etc). The user's notes are still valuable — persist locally so the
    // lead lands in "My Leads" instead of vanishing. This mirrors the
    // mobile audience-fallback behaviour.
    //
    // Mark as `pendingSync: true` so the LeadsPage reconciliation step can
    // push it to the backend the next time the leads-list endpoint succeeds
    // (or the user navigates back to the list). Until then, the UI can show
    // a "syncing" indicator on the row.
    saveLead({
      code: scannedData.code,
      name: scannedData.name,
      company: scannedData.company,
      title: scannedData.title,
      notes,
      avatar: scannedData.avatar,
      tags: selectedTags,
      priority,
      pendingSync: true,
    });
    // Only award local fallback points if scan-time didn't already credit
    // them (e.g. when the badge wasn't recognized by the backend at scan
    // time, so no points were given). This prevents double-counting when
    // handleCodeDetected already awarded points but the backend later
    // rejects the second /leads/scan with the full payload.
    if (!scannedData.pointsCreditedAtScan) {
      const localPts =
        (gamificationConfig?.pointActions as Record<string, number> | undefined)?.scanBadge ?? 0;
      if (localPts > 0) {
        addPoints(localPts, `Scanned ${scannedData.name}'s badge`);
      }
    }
    if (res.error?.code && res.error.code !== 'NOT_IMPLEMENTED' && res.error.code !== 'SCAN_FAILED') {
      // Surface real backend errors quietly in the console for debugging
      // without alarming the user — their lead is captured.
      console.warn('[Lead save] backend sync failed:', res.error);
    }
    resetScanner();
  };

  const resetScanner = () => {
    setScannedData(null);
    setAutoCheckedIn(false);
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
          <h1 style={{ color: t.text, fontSize: 18, fontWeight: 800 }}>Scan Badge</h1>
          <p style={{ color: t.textMuted, fontSize: 11, marginTop: 1 }}>
            {leads.length} badge{leads.length !== 1 ? 's' : ''} scanned · earn points per scan
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

              <div className="rounded-2xl p-4 mb-4" style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={scannedData.avatar} alt={scannedData.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{scannedData.name}</h3>
                    {scannedData.title && (
                      <p style={{ color: t.textSec, fontSize: 13 }}>{scannedData.title}</p>
                    )}
                    {scannedData.company && (
                      <p className="flex items-center gap-1 mt-0.5" style={{ color: t.textMuted, fontSize: 12 }}>
                        <Building2 style={{ width: 11, height: 11 }} /> {scannedData.company}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3 py-1.5 rounded-lg inline-flex items-center gap-2"
                    style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                    <ScanLine style={{ width: 12, height: 12, color: t.accentSoft }} />
                    <span style={{ color: t.textSec, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                      {scannedData.code}
                    </span>
                  </div>
                  {autoCheckedIn && (
                    <div className="px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                      style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)' }}>
                      <CheckCircle2 style={{ width: 12, height: 12, color: '#22c55e' }} />
                      <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 700 }}>
                        Auto checked-in to event
                      </span>
                    </div>
                  )}
                </div>
                {scannedData.unrecognized && (
                  <div className="mt-3 px-3 py-2 rounded-lg flex items-start gap-2"
                    style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }}>
                    <AlertTriangle style={{ width: 14, height: 14, color: '#f59e0b', marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ color: '#b45309', fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>
                        Badge not recognized
                      </p>
                      <p style={{ color: t.textSec, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                        This code didn't match anyone in the audience list. Saving as a manual entry — double-check the details before saving.
                      </p>
                    </div>
                  </div>
                )}
              </div>

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
                    className="flex flex-col items-center"
                  >
                    <CameraScanner
                      onCodeDetected={handleCodeDetected}
                      onSwitchToManual={() => setMode('manual')}
                    />
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
                        disabled={manualCode.length < 3 || resolving}
                        className="w-full py-3.5 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>
                          {resolving ? 'Looking up…' : 'Find Attendee'}
                        </span>
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {mode === 'scan' && (
                <p className="animate-pulse" style={{ color: t.textSec, fontSize: 13, fontWeight: 600 }}>
                  {resolving ? 'Looking up attendee…' : 'Point the camera at the badge QR'}
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
