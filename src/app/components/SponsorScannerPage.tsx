import React, { useState, useRef } from 'react';
import {
  QrCode, Type, Save, X, ScanLine, Building2,
  Flame, ThermometerSun, Snowflake, CheckCircle2, AlertTriangle, History,
} from 'lucide-react';
import { useTheme } from '@/app/context/ThemeContext';
import { useApp } from '@/app/context/AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { scanBadgeLead, updateLeadApi } from '@/app/api/leadsClient';
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

      // 2. Backend could not resolve the code — fall back to the audience
      //    members list and (if found) call the check-in endpoint directly.
      //
      // When the scan-time request timed out (TIMEOUT error code), the server
      // MAY have already processed it and credited attendee points. The
      // Path B scanBadgeLead retry in handleSave is idempotent by badge
      // code — if the server processed the first request it returns
      // `attendeePointsAwarded: 0` on the duplicate, preventing double toasts.
      const scanTimedOut = scan.error?.code === 'TIMEOUT';

      const member = await findMemberByBadgeCodeApi(eventId, badgeCode);
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
