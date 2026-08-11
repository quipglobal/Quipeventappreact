import React, { useState, useRef } from 'react';
import {
  QrCode, Type, Save, X, ScanLine, Building2,
  Flame, ThermometerSun, Snowflake, CheckCircle2, AlertTriangle, History,
  Zap, Tag, Users,
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

  // ── Tip rows shown in the ready state ────────────────────────────────────
  const TIPS = [
    { icon: ScanLine,     color: '#4ade80', text: 'Point the QR code on the badge into the green frame above' },
    { icon: Users,        color: '#60a5fa', text: 'Attendees are automatically checked in when you scan their badge' },
    { icon: Zap,          color: '#fbbf24', text: 'Add notes, tags, and priority to capture the conversation' },
  ] as const;

  return (
    // Fixed-height screen so the camera + panel fill the viewport exactly.
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#07070f' }}>

      {/* ── TOP: Camera section ─────────────────────────────────────────── */}
      <div className="relative flex-shrink-0" style={{ height: '52%' }}>

        {/* Gradient header — floats over the camera, no background of its own */}
        <div
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pt-4 pb-8"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)' }}
        >
          <div>
            <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Scan Badge
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>
              {leads.length} badge{leads.length !== 1 ? 's' : ''} scanned
            </p>
          </div>
          {/* QR / Manual toggle — only shown when no lead is being reviewed */}
          {!scannedData && (
            <div
              className="flex rounded-xl p-1"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}
            >
              <button
                onClick={() => setMode('scan')}
                className="p-2 rounded-lg transition-all"
                style={{ background: mode === 'scan' ? 'rgba(124,58,237,0.85)' : 'transparent', color: '#fff' }}
              >
                <QrCode size={18} />
              </button>
              <button
                onClick={() => setMode('manual')}
                className="p-2 rounded-lg transition-all"
                style={{ background: mode === 'manual' ? 'rgba(124,58,237,0.85)' : 'transparent', color: '#fff' }}
              >
                <Type size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Camera — always mounted during QR mode; remounted via cameraKey on reset */}
        {mode === 'scan' && (
          <CameraScanner
            key={cameraKey}
            onCodeDetected={handleCodeDetected}
            onSwitchToManual={() => setMode('manual')}
          />
        )}

        {/* Manual-mode camera placeholder — keeps the top section filled */}
        {mode === 'manual' && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 60%,#0f172a 100%)' }}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.4)' }}
            >
              <Type size={34} color="rgba(167,139,250,0.7)" />
            </div>
          </div>
        )}

        {/* Resolving overlay — shows while the badge lookup is in-flight */}
        {resolving && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
          >
            <div className="w-10 h-10 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600 }}>
              Looking up attendee…
            </p>
          </div>
        )}

        {/* Bottom-edge gradient so the camera blends into the panel below */}
        <div
          className="absolute bottom-0 inset-x-0 h-12 pointer-events-none z-10"
          style={{ background: isDark
            ? 'linear-gradient(to top, #07070f, transparent)'
            : 'linear-gradient(to top, #f8f7ff, transparent)' }}
        />
      </div>

      {/* ── BOTTOM: Sliding context panel ───────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto z-10 rounded-t-3xl -mt-5"
        style={{
          background: t.bgPage,
          boxShadow: '0 -12px 40px rgba(0,0,0,0.45)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
        </div>

        <AnimatePresence mode="wait">
          {/* ── Lead form (post-scan) ─────────────────────────────────── */}
          {scannedData ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22 }}
              className="px-5 pb-28"
            >
              {/* Form header */}
              <div className="flex items-center justify-between py-3 mb-1">
                <h2 style={{ color: t.text, fontSize: 17, fontWeight: 800 }}>New Lead</h2>
                <button
                  onClick={resetScanner}
                  className="p-2 rounded-full active:scale-95 transition-transform"
                  style={{ background: t.surface2, color: t.textMuted }}
                >
                  <X size={17} />
                </button>
              </div>

              {/* Attendee card */}
              <div className="rounded-2xl p-4 mb-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
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
                      <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 700 }}>Auto checked-in</span>
                    </div>
                  )}
                </div>
                {scannedData.unrecognized && (
                  <div className="mt-3 px-3 py-2 rounded-lg flex items-start gap-2"
                    style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.35)' }}>
                    <AlertTriangle style={{ width: 14, height: 14, color: '#f59e0b', marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ color: '#b45309', fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>Badge not recognized</p>
                      <p style={{ color: t.textSec, fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>
                        This code didn't match anyone in the audience list. Saving as a manual entry — double-check the details before saving.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority */}
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
                        style={{ background: isActive ? cfg.bg : t.surface, border: `1.5px solid ${isActive ? cfg.color : t.border}` }}>
                        <Icon style={{ width: 15, height: 15, color: isActive ? cfg.color : t.textMuted }} />
                        <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? cfg.color : t.textSec }}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick tags */}
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
                          fontSize: 12, fontWeight: active ? 700 : 600,
                          border: `1px solid ${active ? t.borderAcc : t.border}`,
                        }}>
                        {active && <span className="mr-1">✓</span>}{tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-5">
                <label style={{ color: t.textSec, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
                  Conversation Notes
                </label>
                {isInherited && (
                  <div
                    data-testid="inherited-notes-banner"
                    className="mb-2 px-3 py-2 rounded-lg flex items-center gap-2"
                    style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.35)' }}
                  >
                    <History style={{ width: 13, height: 13, color: '#6366f1', flexShrink: 0 }} />
                    <span style={{ color: '#6366f1', fontSize: 11, fontWeight: 600 }}>
                      Notes from a previous event — edit to make them yours.
                    </span>
                  </div>
                )}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Capture key discussion points, pain points, interests, follow-up actions…"
                  rows={4}
                  className="w-full p-4 rounded-xl resize-none outline-none transition-all"
                  style={{
                    background: t.inputBg,
                    border: `1px solid ${t.inputBorder}`,
                    color: t.text,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                />
                <p className="mt-1.5 text-right" style={{ color: t.textMuted, fontSize: 10 }}>
                  {notes.length} characters
                </p>
              </div>

              {/* Save button */}
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
            /* ── Ready / manual-entry panel (pre-scan) ──────────────── */
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="px-5 pb-28"
            >
              {mode === 'scan' ? (
                /* ── Scan ready state ─────────────────────────────── */
                <div className="pt-3">
                  {/* Ready indicator */}
                  <div className="flex items-center gap-2.5 mb-5">
                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                    </span>
                    <span style={{ color: t.text, fontSize: 16, fontWeight: 800 }}>Ready to Scan</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                      <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Leads Captured
                      </p>
                      <p style={{ color: t.text, fontSize: 26, fontWeight: 800, marginTop: 4, lineHeight: 1 }}>
                        {leads.length}
                      </p>
                    </div>
                    <div className="rounded-2xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                      <p style={{ color: t.textMuted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Your Points
                      </p>
                      <p style={{ color: '#a78bfa', fontSize: 26, fontWeight: 800, marginTop: 4, lineHeight: 1 }}>
                        {user?.points?.toLocaleString() ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="space-y-2 mb-4">
                    {TIPS.map(({ icon: Icon, color, text }) => (
                      <div
                        key={text}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: t.surface, border: `1px solid ${t.border}` }}
                      >
                        <Icon size={16} style={{ color, flexShrink: 0 }} />
                        <span style={{ color: t.textSec, fontSize: 12.5, lineHeight: 1.4 }}>{text}</span>
                      </div>
                    ))}
                  </div>

                  {/* Manual entry fallback */}
                  <button
                    onClick={() => setMode('manual')}
                    className="w-full py-3 rounded-xl flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
                    style={{ background: t.surface2, border: `1px solid ${t.border}` }}
                  >
                    <Tag size={14} style={{ color: t.textMuted }} />
                    <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 600 }}>
                      Can't scan? Enter badge code manually
                    </span>
                  </button>
                </div>

              ) : (
                /* ── Manual entry form ────────────────────────────── */
                <div className="pt-3">
                  <h2 style={{ color: t.text, fontSize: 17, fontWeight: 800, marginBottom: 4 }}>Enter Badge Code</h2>
                  <p style={{ color: t.textSec, fontSize: 13, marginBottom: 20 }}>
                    Type the code printed on the attendee's badge.
                  </p>
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
                      <span style={{ fontSize: 14, fontWeight: 700 }}>
                        {resolving ? 'Looking up…' : 'Find Attendee'}
                      </span>
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
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
