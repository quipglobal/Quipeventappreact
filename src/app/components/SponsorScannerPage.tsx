import React, { useState, useRef } from 'react';
import {
  QrCode, Type, Save, X, ScanLine, Building2,
  Flame, ThermometerSun, Snowflake, CheckCircle2, AlertTriangle, History,
} from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { scanBadgeLead, updateLeadApi, type SaveLeadResponse } from '@/app/api/leadsClient';
import { saveLeadEdit, clearLeadEdit, loadLeadEdits, lookupLeadEdit } from '@/app/lib/leadEditsStorage';
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

export const SponsorScannerPage: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
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
  const [isInherited, setIsInherited] = useState(false);
  // Incrementing this key remounts CameraScanner so it restarts the QR
  // scanner after the lead form is dismissed (reset flow).
  const [cameraKey, setCameraKey] = useState(0);
  // Ref-based guard so rapid double-taps can't dispatch two concurrent saves
  // even before the first setState re-render has disabled the button.
  const savingRef = useRef(false);

  const eventId = eventConfig?.eventId ?? '0';

  const handleCodeDetected = async (code: string) => {
    if (resolving || scannedData) return;
    const trimmed = code.trim();
    if (!trimmed) return;

    // The badge QR encodes one of:
    //   1. Structured JSON: { "id": "<userId>", "badge_code": "<code>", "event": "<eventCode>" }
    //   2. A URL: https://app.example.com/badge/<code>  or  ?badge_code=<code>&code=<code>
    //   3. A plain badge code string (legacy)
    let badgeCode = trimmed;
    let scannedUserId: string | undefined;

    // Try JSON first.
    if (trimmed.startsWith('{')) {
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
        // Not JSON — fall through.
      }
    } else if (/^https?:\/\//i.test(trimmed)) {
      // URL format — extract the badge code from query params or path.
      try {
        const u = new URL(trimmed);
        const fromParam =
          u.searchParams.get('badge_code') ||
          u.searchParams.get('code') ||
          u.searchParams.get('badgeCode') ||
          u.searchParams.get('id');
        if (fromParam?.trim()) {
          badgeCode = fromParam.trim();
        } else {
          // Last path segment: /badge/ABC123 or /check-in/ABC123
          const seg = u.pathname.split('/').filter(Boolean).pop();
          if (seg && seg.length > 2) badgeCode = seg;
        }
        const uid = u.searchParams.get('user_id') || u.searchParams.get('userId');
        if (uid) scannedUserId = uid;
      } catch {
        // Malformed URL — use raw string as-is.
      }
    }

    if (!badgeCode) return;

    // Reset form fields so each new scan starts fresh; they'll be seeded
    // from the prior-edits overlay once the attendee resolves below.
    setNotes('');
    setSelectedTags([]);
    setPriority('warm');

    setResolving(true);
    try {
      // Speed strategy: fire scan POST and member-list lookup concurrently so
      // the fallback result is already in-flight while the scan is resolving.
      //
      // Crucially we await the SCAN first. If it resolves with a full profile
      // we cancel the member lookup and render immediately — the happy path is
      // not penalised by waiting for the member GET to settle.
      // Only when the scan fails do we await the already-in-flight member
      // promise, paying at most one more partial RTT instead of a full one.
      //
      // A 5-second AbortController bounds the member fallback so a stalling
      // GET endpoint can never freeze the camera screen indefinitely.
      const memberController = new AbortController();
      const memberTimerId = setTimeout(() => memberController.abort(), 5_000);

      const scanPromise = scanBadgeLead(eventId, {
        code: badgeCode,
        ...(scannedUserId ? { scanned_user_id: scannedUserId } : {}),
      } as Parameters<typeof scanBadgeLead>[1]);
      const memberPromise = findMemberByBadgeCodeApi(eventId, badgeCode, { signal: memberController.signal });

      // Await scan first — render immediately on success.
      const scan: SaveLeadResponse = await scanPromise;

      // Treat the scan as resolved only when the server actually returned a
      // recognizable attendee. A successful HTTP shape with no canonical
      // identifier (no name, no code, no memberId) means the backend couldn't
      // resolve the badge — fall through to the member-lookup fallback.
      const resolvedByBackend = !!(
        scan.success &&
        scan.data &&
        ((scan.data.name && scan.data.name.trim()) ||
          scan.data.code ||
          typeof scan.data.memberId === 'number')
      );

      if (resolvedByBackend && scan.data) {
        // Scan resolved — abort the member lookup immediately (safe to do now:
        // fetchWithRetry bypasses its dedup cache for any request that carries
        // an AbortSignal, so aborting this lookup cannot poison a subsequent
        // rescan of the same badge — each callers gets its own fetch).
        clearTimeout(memberTimerId);
        memberController.abort();
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

        // The scanner (sponsor) earns no points for scanning — only the
        // scanned attendee earns points, and the backend credits them
        // server-side. Show the attendee's awarded total as confirmation.
        if (didCheckIn) {
          showToast(`Auto checked-in ${attendee.name}`);
        }
        if (typeof d.attendeePointsAwarded === 'number' && d.attendeePointsAwarded > 0) {
          showToast(`Attendee earned ${d.attendeePointsAwarded} pts`);
        }
        setScannedData(attendee);

        // Seed form fields: first apply any prior local overlay (cross-event
        // propagation from local storage), then let non-empty server-echoed
        // values take precedence — server is authoritative after a successful
        // scan response (MOBILE_AGENT_LEAD_SYNC_PROMPT.md §3.1).
        {
          const overlay = loadLeadEdits(user?.id);
          const prior = lookupLeadEdit(overlay, '', badgeCode);
          if (prior) {
            if (prior.notes) setNotes(prior.notes);
            if (prior.tags?.length) setSelectedTags(prior.tags);
            if (prior.priority) setPriority(prior.priority);
          }
          // Server-echoed notes/tags/priority override the local overlay when
          // present and non-empty (e.g. inherited values from a previous event).
          if (d.notes) setNotes(d.notes);
          if (d.tags?.length) setSelectedTags(d.tags);
          if (d.priority) setPriority(d.priority as Priority);
          if (d.isInherited) setIsInherited(true);
        }

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
          // Anchor the scan_id under the badge code key immediately so
          // handleSave can find it via PATCH even before /my-leads lists it.
          if (user?.id) saveLeadEdit(user.id, d.id, {}, badgeCode);
        }
        return;
      }

      // 2. Backend could not resolve the code — await the already-in-flight
      //    member lookup. It started concurrently with the scan so at worst we
      //    wait for the remaining portion of its RTT, not a full second RTT.
      //
      // When the scan-time request timed out (TIMEOUT error code), the server
      // MAY have already processed it and credited attendee points. The
      // Path B scanBadgeLead retry in handleSave is idempotent by badge
      // code — if the server processed the first request it returns
      // `attendeePointsAwarded: 0` on the duplicate, preventing double toasts.
      const scanTimedOut = scan.error?.code === 'TIMEOUT';
      void scanTimedOut; // used by handleSave to choose retry strategy

      const member = await memberPromise;
      clearTimeout(memberTimerId);
      if (member) {
        const attendee = attendeeFromMember(member);
        setScannedData(attendee);

        // Seed form fields from any prior edits for this badge code.
        {
          const overlay = loadLeadEdits(user?.id);
          const prior = lookupLeadEdit(overlay, '', badgeCode);
          if (prior) {
            if (prior.notes) setNotes(prior.notes);
            if (prior.tags?.length) setSelectedTags(prior.tags);
            if (prior.priority) setPriority(prior.priority);
          }
        }

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

        // Seed form fields from any prior edits for this badge code.
        {
          const overlay = loadLeadEdits(user?.id);
          const prior = lookupLeadEdit(overlay, '', badgeCode);
          if (prior) {
            if (prior.notes) setNotes(prior.notes);
            if (prior.tags?.length) setSelectedTags(prior.tags);
            if (prior.priority) setPriority(prior.priority);
          }
        }
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
    // Synchronous ref check prevents a second invocation from racing through
    // before the first setState re-render has disabled the button visually.
    // The ref stays true until ALL async work (including post-save check-ins)
    // completes so a tap during the success handler can't re-enter.
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      // Path A: backend already created the lead at scan time (the most common
      // path). Apply notes/tags/priority locally first — that's the source of
      // truth for "My Leads". Then navigate away immediately; the PATCH to
      // persist the edits server-side runs in the background so the user isn't
      // blocked waiting for a ~800 ms round-trip.
      if (scannedData.leadId) {
        // Capture all values needed for the background PATCH before resetScanner
        // clears component state.
        const bLeadId   = scannedData.leadId;
        const bCode     = scannedData.code;
        const bNotes    = notes;
        const bTags     = selectedTags;
        const bPriority = priority;
        const bUserId   = user?.id;

        // Apply locally — instant, no server wait.
        updateLead(bLeadId, { notes: bNotes, tags: bTags, priority: bPriority });
        // Mirror to the per-user edits overlay under the badge code too, since
        // `updateLead`'s code lookup misses on first-ever scans (the lead row
        // hasn't been saved to context yet). The merge falls back to the code
        // key when the server returns this lead under a different id.
        if (bUserId) {
          saveLeadEdit(bUserId, bLeadId, { notes: bNotes, tags: bTags, priority: bPriority }, bCode);
        }

        // Navigate immediately — local state is already consistent.
        resetScanner();
        onSaved?.();

        // Background PATCH — fires after navigation; errors are silent to the
        // user because the lead is already captured locally. On success the
        // overlay is retired so the server is authoritative from this point.
        void updateLeadApi(eventId, bLeadId, {
          notes: bNotes, tags: bTags, priority: bPriority,
        }).then(upd => {
          if (upd.success) {
            if (bUserId) clearLeadEdit(bUserId, bLeadId, bCode);
            if (upd.data) {
              updateLead(bLeadId, {
                notes:    upd.data.notes    ?? bNotes,
                tags:     upd.data.tags     ?? bTags,
                priority: upd.data.priority ?? bPriority,
              });
            }
          } else if (upd.error?.code !== '404' && upd.error?.code !== 'NOT_IMPLEMENTED') {
            // Real server failure — keep overlay with syncPending so the
            // reconciler retries on the next leads-list load.
            console.warn('[Lead update] background sync failed:', upd.error);
            if (bUserId) {
              saveLeadEdit(bUserId, bLeadId,
                { notes: bNotes, tags: bTags, priority: bPriority, syncPending: true },
                bCode);
            }
          }
        });
        return;
      }

      // Path B: scan endpoint didn't create a lead at scan time (unknown code,
      // audience-list fallback, or no-id response). Persist locally as
      // pendingSync immediately so the lead appears in "My Leads" right away,
      // then navigate. The actual POST to the scan endpoint runs in background;
      // on success it replaces the pending entry with the server-confirmed one
      // (AppContext.saveLead deduplicates by badge code).
      const bCode        = scannedData.code;
      const bName        = scannedData.name;
      const bCompany     = scannedData.company;
      const bTitle       = scannedData.title;
      const bAvatar      = scannedData.avatar;
      const bNotes       = notes;
      const bTags        = selectedTags;
      const bPriority    = priority;
      const bUserId      = user?.id;
      const bCheckedIn   = autoCheckedIn;

      // Save locally as pendingSync so the lead is immediately visible in
      // My Leads. Use `silent: true` to suppress the generic "Lead saved"
      // toast here — the attendee-points toast below is the meaningful signal.
      saveLead({
        code: bCode, name: bName, company: bCompany, title: bTitle,
        notes: bNotes, avatar: bAvatar, tags: bTags, priority: bPriority,
        pendingSync: true,
      }, { silent: true });

      // Reset the scanner UI immediately — the user sees a blank scanner
      // for the brief moment the scan POST is in-flight.
      resetScanner();

      // Background scan POST — creates the canonical lead on the server and
      // awards attendee points. On success, replace the pending local entry
      // with the server-confirmed payload (AppContext deduplicates by code),
      // show any attendee-points toast, then navigate to My Leads so the
      // toast is visible before the page unmounts.
      void scanBadgeLead(eventId, {
        code: bCode, name: bName, company: bCompany, title: bTitle,
        notes: bNotes, avatar: bAvatar, tags: bTags, priority: bPriority,
      }).then(res => {
        if (res.success && res.data) {
          // Use silent to suppress "Lead saved successfully" toast — the
          // attendee-points toast below is the meaningful feedback.  A
          // stale timer from the generic toast firing at t+3 s would
          // otherwise clear the attendee toast before Playwright (and
          // the real user) can see it.
          saveLead({
            id: res.data.id,
            code: res.data.code || bCode,
            name: res.data.name || bName,
            company: res.data.company ?? bCompany,
            title: res.data.title ?? bTitle,
            notes: bNotes,
            avatar: res.data.avatar ?? bAvatar,
            tags: bTags,
            priority: bPriority,
          }, { silent: true });
          if (bUserId) {
            saveLeadEdit(bUserId, res.data.id,
              { notes: bNotes, tags: bTags, priority: bPriority },
              res.data.code || bCode);
          }
          // Determine if we'll show the attendee-points toast.  This flag is
          // evaluated before the auto-check-in block so we can suppress the
          // check-in toast: checkInMemberApi is async and its showToast fires
          // as a separate microtask that would immediately overwrite the
          // attendee-points toast, causing it to flash for <5 ms and be
          // undetectable by Playwright (and real users on slow devices).
          const attendeePoints =
            typeof res.data.attendeePointsAwarded === 'number' && res.data.attendeePointsAwarded > 0
              ? res.data.attendeePointsAwarded
              : 0;

          // Auto check-in reconciliation — skipped when an attendee-points
          // toast will be shown because the async check-in callback would race
          // and overwrite that toast before it becomes visible.
          if (!bCheckedIn && !attendeePoints) {
            if (res.data.checkedIn) {
              showToast(`Auto checked-in ${res.data.name}`);
            } else if (typeof res.data.memberId === 'number') {
              void checkInMemberApi(eventId, res.data.memberId).then(ok => {
                if (ok) showToast(`Auto checked-in ${res.data.name}`);
              });
            }
          }
          if (attendeePoints > 0) {
            showToast(`Attendee earned ${attendeePoints} pts`);
          }
        } else if (res.error?.code && res.error.code !== 'NOT_IMPLEMENTED' && res.error.code !== 'SCAN_FAILED') {
          console.warn('[Lead save] background sync failed:', res.error);
          // pendingSync flag remains — the background reconciler will retry.
        }
        // Navigate to My Leads after the scan resolves (success or expected
        // failure) so any attendee-points toast is visible before the scanner
        // unmounts. Unexpected exceptions are caught by the outer try/finally.
        onSaved?.();
      });
    } finally {
      // Always release the lock — even if an unexpected exception is thrown —
      // so the button doesn't stay permanently disabled.
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const resetScanner = () => {
    setScannedData(null);
    setAutoCheckedIn(false);
    setNotes('');
    setManualCode('');
    setSelectedTags([]);
    setPriority('warm');
    setIsInherited(false);
    setMode('scan');
    // Remount CameraScanner so the QR scanner restarts cleanly after
    // the lead form is dismissed. Since camera permission is already
    // granted, the remount is instant (no second permission prompt).
    setCameraKey(k => k + 1);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    // Full-screen camera view. The lead form slides up as a bottom sheet
    // after a scan; saving navigates to My Leads via onSaved().
    <div className="relative overflow-hidden" style={{ height: '100dvh', background: '#07070f' }}>

      {/* ── Full-screen camera ───────────────────────────────────────────── */}
      {mode === 'scan' && (
        <CameraScanner
          key={cameraKey}
          onCodeDetected={handleCodeDetected}
          onSwitchToManual={() => setMode('manual')}
        />
      )}

      {/* Manual-mode background (camera not active) */}
      {mode === 'manual' && (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 55%,#0f172a 100%)' }}
        />
      )}

      {/* ── Floating header overlay ──────────────────────────────────────── */}
      <div
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-5 pb-10"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)' }}
      >
        <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
          Scan Badge
        </h1>
        {/* QR / Manual toggle */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          <button
            onClick={() => setMode('scan')}
            className="p-2 rounded-lg transition-all"
            style={{ background: mode === 'scan' ? 'rgba(124,58,237,0.9)' : 'transparent', color: '#fff' }}
          >
            <QrCode size={18} />
          </button>
          <button
            onClick={() => setMode('manual')}
            className="p-2 rounded-lg transition-all"
            style={{ background: mode === 'manual' ? 'rgba(124,58,237,0.9)' : 'transparent', color: '#fff' }}
          >
            <Type size={18} />
          </button>
        </div>
      </div>

      {/* ── QR mode: bottom hint + manual fallback ───────────────────────── */}
      {mode === 'scan' && !scannedData && !resolving && (
        <div
          className="absolute bottom-0 inset-x-0 z-20 flex flex-col items-center pb-10 pt-16"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
              Point camera at badge QR code
            </span>
          </div>
          <button
            onClick={() => setMode('manual')}
            className="px-5 py-2.5 rounded-full active:opacity-70 transition-opacity flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }}
          >
            <Type size={14} color="rgba(255,255,255,0.7)" />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>Enter code manually</span>
          </button>
        </div>
      )}

      {/* ── Manual-mode: bottom sheet for code entry ─────────────────────── */}
      <AnimatePresence>
        {mode === 'manual' && !scannedData && (
          <motion.div
            key="manual-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="absolute bottom-0 inset-x-0 z-30 rounded-t-3xl"
            style={{ background: t.bgPage, boxShadow: '0 -16px 48px rgba(0,0,0,0.6)' }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
            </div>
            <div className="px-5 pt-2 pb-10">
              <h2 style={{ color: t.text, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Enter Badge Code</h2>
              <p style={{ color: t.textSec, fontSize: 13, marginBottom: 20 }}>
                Type the code printed on the attendee's badge.
              </p>
              {resolving && (
                <div className="mb-4 flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                  <span style={{ color: t.textSec, fontSize: 13 }}>Looking up attendee…</span>
                </div>
              )}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="e.g. ATT-8492"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full h-14 text-center text-xl tracking-widest uppercase rounded-xl border outline-none transition-all"
                  style={{
                    borderColor: t.inputBorder,
                    color: t.text,
                    background: t.inputBg,
                    fontFamily: 'monospace',
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={manualCode.length < 3 || resolving}
                  className="w-full py-3.5 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Find Attendee</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('scan')}
                  className="w-full py-3 rounded-xl flex items-center justify-center gap-2 active:opacity-70"
                  style={{ background: t.surface2, border: `1px solid ${t.border}` }}
                >
                  <QrCode size={14} style={{ color: t.textMuted }} />
                  <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 600 }}>Back to camera</span>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Resolving overlay (QR mode lookup) ──────────────────────────── */}
      {resolving && mode === 'scan' && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3"
          style={{ background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(2px)' }}
        >
          <div className="w-11 h-11 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
            Looking up attendee…
          </p>
        </div>
      )}

      {/* ── Lead form bottom sheet (post-scan) ──────────────────────────── */}
      <AnimatePresence>
        {scannedData && (
          <>
            {/* Scrim — fixed so it covers the bottom nav bar too */}
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[200]"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={resetScanner}
            />

            {/* Sheet — fixed so it sits above the bottom nav bar */}
            <motion.div
              key="lead-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              className="fixed bottom-0 inset-x-0 z-[201] rounded-t-3xl overflow-y-auto"
              style={{
                maxHeight: '88vh',
                background: t.bgPage,
                boxShadow: '0 -16px 48px rgba(0,0,0,0.6)',
              }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-0.5">
                <div className="w-9 h-1 rounded-full" style={{ background: t.border }} />
              </div>

              <div className="px-5 pt-2 pb-6 space-y-3">

                {/* ── Compact attendee header ── */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={scannedData.avatar} alt={scannedData.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p style={{ color: t.text, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }} className="truncate">
                        {scannedData.name}
                      </p>
                      {(scannedData.company || scannedData.title) && (
                        <p style={{ color: t.textMuted, fontSize: 11, lineHeight: 1.3 }} className="truncate">
                          {[scannedData.title, scannedData.company].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {autoCheckedIn && (
                      <div className="px-2 py-1 rounded-lg inline-flex items-center gap-1"
                        style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                        <CheckCircle2 style={{ width: 11, height: 11, color: '#22c55e' }} />
                        <span style={{ color: '#22c55e', fontSize: 10, fontWeight: 700 }}>Checked in</span>
                      </div>
                    )}
                    <button
                      onClick={resetScanner}
                      className="p-1.5 rounded-full active:scale-95 transition-transform"
                      style={{ background: t.surface2, color: t.textMuted }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Unrecognized badge warning */}
                {scannedData.unrecognized && (
                  <div className="px-3 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }}>
                    <AlertTriangle style={{ width: 13, height: 13, color: '#f59e0b', flexShrink: 0 }} />
                    <p style={{ color: '#b45309', fontSize: 11.5, lineHeight: 1.4 }}>
                      Badge not recognized — saving as manual entry.
                    </p>
                  </div>
                )}

                {/* Priority */}
                <div>
                  <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Priority
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(priorityConfig) as [Priority, typeof priorityConfig.hot][]).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      const isActive = priority === key;
                      return (
                        <button key={key} onClick={() => setPriority(key)}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-[0.97]"
                          style={{ background: isActive ? cfg.bg : t.surface, border: `1.5px solid ${isActive ? cfg.color : t.border}` }}>
                          <Icon style={{ width: 13, height: 13, color: isActive ? cfg.color : t.textMuted }} />
                          <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 600, color: isActive ? cfg.color : t.textSec }}>
                            {cfg.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick tags */}
                <div>
                  <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TAGS.map(tag => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button key={tag} onClick={() => toggleTag(tag)}
                          className="px-2.5 py-1 rounded-full transition-all active:scale-[0.96]"
                          style={{
                            background: active ? t.accentBg : t.surface,
                            color: active ? t.accentSoft : t.textSec,
                            fontSize: 11.5, fontWeight: active ? 700 : 500,
                            border: `1px solid ${active ? t.borderAcc : t.border}`,
                          }}>
                          {active && <span className="mr-0.5">✓</span>}{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Notes
                  </p>
                  {isInherited && (
                    <div
                      data-testid="inherited-notes-banner"
                      className="mb-2 px-3 py-1.5 rounded-lg flex items-center gap-2"
                      style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.35)' }}
                    >
                      <History style={{ width: 12, height: 12, color: '#6366f1', flexShrink: 0 }} />
                      <span style={{ color: '#6366f1', fontSize: 11, fontWeight: 600 }}>
                        From a previous event — edit to update.
                      </span>
                    </div>
                  )}
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Key points, interests, follow-ups…"
                    rows={3}
                    className="w-full p-3 rounded-xl resize-none outline-none transition-all"
                    style={{
                      background: t.inputBg,
                      border: `1px solid ${t.inputBorder}`,
                      color: t.text,
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Save — redirects to My Leads via onSaved() */}
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-3.5 rounded-xl text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-70"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Saving Lead…</span>
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      <span style={{ fontSize: 14, fontWeight: 700 }}>Save Lead</span>
                    </>
                  )}
                </button>

                {/* Badge code — subtle footer info */}
                <div className="flex justify-center">
                  <div className="px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5"
                    style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                    <ScanLine style={{ width: 11, height: 11, color: t.accentSoft }} />
                    <span style={{ color: t.textMuted, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em' }}>
                      {scannedData.code}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
