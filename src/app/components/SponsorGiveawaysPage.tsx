import React, { useEffect, useRef, useState } from 'react';
import {
  Gift, Plus, Upload, X, Package, Clock, Trash2, Sparkles, Pencil, Check,
} from 'lucide-react';
import { useApp, SponsorGiveaway } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Add Giveaway Form ───────────────────────────────────────────────────────

const GiveawayForm: React.FC<{
  onAdd: (giveaway: { title: string; numberOfItems: number; image: string; sponsorName: string; sponsorId: string }) => void;
}> = ({ onAdd }) => {
  const { t } = useTheme();
  const [title, setTitle] = useState('');
  const [numberOfItems, setNumberOfItems] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!title.trim() || !numberOfItems) return;
    onAdd({
      title: title.trim(),
      numberOfItems: parseInt(numberOfItems, 10),
      image: imagePreview,
      sponsorName: '',
      sponsorId: '',
    });
    setTitle(''); setNumberOfItems(''); setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isValid = title.trim().length > 0 && parseInt(numberOfItems, 10) > 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${t.border}` }}>
        <Plus style={{ width: 16, height: 16, color: '#7c3aed' }} />
        <span style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>Add Giveaway</span>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label style={{ color: t.textSec, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
            Giveaway Title
          </label>
          <input type="text" placeholder="e.g., Win a MacBook Pro"
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl outline-none transition-colors"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ color: t.textSec, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
            Number of Items
          </label>
          <input type="number" placeholder="e.g., 50" min="1"
            value={numberOfItems} onChange={e => setNumberOfItems(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl outline-none transition-colors"
            style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, fontSize: 14 }} />
        </div>

        <div>
          <label style={{ color: t.textSec, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
            Upload Picture
          </label>
          <input ref={fileInputRef} type="file" accept="image/*"
            onChange={handleImageUpload} className="hidden" />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
              <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
              <button
                onClick={() => { setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style={{ background: 'rgba(0,0,0,0.6)' }}>
                <X style={{ width: 14, height: 14, color: '#fff' }} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl active:scale-[0.98] transition-transform"
              style={{ background: t.surface2, border: `2px dashed ${t.border}` }}>
              <Upload style={{ width: 24, height: 24, color: t.textMuted }} />
              <span style={{ color: t.textSec, fontSize: 13, fontWeight: 600 }}>Tap to upload image</span>
              <span style={{ color: t.textMuted, fontSize: 11 }}>JPG, PNG up to 5MB</span>
            </button>
          )}
        </div>

        <button onClick={handleSubmit} disabled={!isValid}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white active:scale-[0.97] transition-all"
          style={{
            background: isValid ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(124,58,237,0.3)',
            opacity: isValid ? 1 : 0.6, fontWeight: 700, fontSize: 14,
          }}>
          <Plus style={{ width: 16, height: 16 }} />
          Add Giveaway
        </button>
      </div>
    </div>
  );
};

// ─── Edit Giveaway Modal ─────────────────────────────────────────────────────

const EditGiveawayModal: React.FC<{
  giveaway: SponsorGiveaway;
  onSave: (updates: { title: string; numberOfItems: number; image: string }) => void;
  onClose: () => void;
}> = ({ giveaway, onSave, onClose }) => {
  const { t } = useTheme();
  const [title, setTitle] = useState(giveaway.title);
  const [numberOfItems, setNumberOfItems] = useState(String(giveaway.numberOfItems));
  const [imagePreview, setImagePreview] = useState(giveaway.image);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock body scroll while the modal is open so the underlying page
  // can't be scrolled behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isValid = title.trim().length > 0 && parseInt(numberOfItems, 10) > 0;

  const handleSave = () => {
    if (!isValid) return;
    onSave({
      title: title.trim(),
      numberOfItems: parseInt(numberOfItems, 10),
      image: imagePreview,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="rounded-2xl overflow-hidden w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-2">
            <Pencil style={{ width: 16, height: 16, color: '#7c3aed' }} />
            <span style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>Edit Giveaway</span>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg active:scale-90 transition-transform"
            style={{ background: t.surface2 }}>
            <X style={{ width: 14, height: 14, color: t.textMuted }} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label style={{ color: t.textSec, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Giveaway Title
            </label>
            <input type="text" placeholder="e.g., Win a MacBook Pro"
              value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl outline-none transition-colors"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, fontSize: 14 }} />
          </div>

          <div>
            <label style={{ color: t.textSec, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Number of Items
            </label>
            <input type="number" placeholder="e.g., 50" min="1"
              value={numberOfItems} onChange={e => setNumberOfItems(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl outline-none transition-colors"
              style={{ background: t.surface2, border: `1px solid ${t.border}`, color: t.text, fontSize: 14 }} />
          </div>

          <div>
            <label style={{ color: t.textSec, fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Picture
            </label>
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={handleImageUpload} className="hidden" />
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${t.border}` }}>
                <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                <button
                  onClick={() => { setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <X style={{ width: 14, height: 14, color: '#fff' }} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl active:scale-[0.98] transition-transform"
                style={{ background: t.surface2, border: `2px dashed ${t.border}` }}>
                <Upload style={{ width: 24, height: 24, color: t.textMuted }} />
                <span style={{ color: t.textSec, fontSize: 13, fontWeight: 600 }}>Tap to upload image</span>
                <span style={{ color: t.textMuted, fontSize: 11 }}>JPG, PNG up to 5MB</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl active:scale-[0.97] transition-transform"
              style={{ background: t.surface2, color: t.textSec, fontWeight: 700, fontSize: 14 }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={!isValid}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white active:scale-[0.97] transition-all"
              style={{
                background: isValid ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(124,58,237,0.3)',
                opacity: isValid ? 1 : 0.6, fontWeight: 700, fontSize: 14,
              }}>
              <Check style={{ width: 16, height: 16 }} />
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Giveaway Card ───────────────────────────────────────────────────────────

const GiveawayCard: React.FC<{
  giveaway: SponsorGiveaway;
  isMine: boolean;
  byline?: string;
  onEdit: (giveaway: SponsorGiveaway) => void;
  onRemove: (id: string) => void;
}> = ({ giveaway, isMine, byline, onEdit, onRemove }) => {
  const { t } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}>
      {giveaway.image && (
        <div className="relative h-36 overflow-hidden">
          <img src={giveaway.image} alt={giveaway.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)' }} />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="truncate" style={{ color: t.text, fontSize: 15, fontWeight: 700 }}>{giveaway.title}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Package style={{ width: 12, height: 12, color: '#7c3aed' }} />
              <span style={{ color: t.textSec, fontSize: 12, fontWeight: 600 }}>
                {giveaway.numberOfItems} item{giveaway.numberOfItems !== 1 ? 's' : ''} available
              </span>
            </div>
            {byline && (
              <div className="mt-1.5">
                <span style={{ color: t.textMuted, fontSize: 11 }}>{byline}</span>
              </div>
            )}
          </div>
          {isMine && (
            showConfirm ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => { onRemove(giveaway.id); setShowConfirm(false); }}
                  className="px-2.5 py-1 rounded-lg text-white active:scale-95 transition-transform"
                  style={{ background: '#ef4444', fontSize: 11, fontWeight: 700 }}>Delete</button>
                <button onClick={() => setShowConfirm(false)}
                  className="px-2.5 py-1 rounded-lg active:scale-95 transition-transform"
                  style={{ background: t.surface2, color: t.textSec, fontSize: 11, fontWeight: 700 }}>Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button onClick={() => onEdit(giveaway)}
                  className="p-1.5 rounded-lg active:scale-90 transition-transform"
                  style={{ background: t.surface2 }}
                  aria-label="Edit giveaway">
                  <Pencil style={{ width: 14, height: 14, color: t.textMuted }} />
                </button>
                <button onClick={() => setShowConfirm(true)}
                  className="p-1.5 rounded-lg active:scale-90 transition-transform"
                  style={{ background: t.surface2 }}
                  aria-label="Delete giveaway">
                  <Trash2 style={{ width: 14, height: 14, color: t.textMuted }} />
                </button>
              </div>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <Clock style={{ width: 11, height: 11, color: t.textMuted }} />
          <span style={{ color: t.textMuted, fontSize: 11 }}>Added {timeAgo(giveaway.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const SponsorGiveawaysPage: React.FC = () => {
  const {
    sponsorGiveaways,
    addSponsorGiveaway,
    updateSponsorGiveaway,
    removeSponsorGiveaway,
    isMyGiveaway,
    user,
    eventConfig,
  } = useApp();
  const { t, isDark } = useTheme();
  const [editing, setEditing] = useState<SponsorGiveaway | null>(null);

  const isSponsor = user?.role === 'sponsor';
  // Show every giveaway the event-scoped backend list returned.
  // Filtering by `isMyGiveaway` here was hiding the rep's own
  // freshly-added prize whenever the backend re-stamped sponsor_id
  // with a foreign-key value that didn't equal `user.id` (the bug
  // that surfaced as "added giveaway not appearing"). The list is
  // already authorized + event-scoped server-side. Edit/delete
  // affordances on each card are still gated by `isMyGiveaway`
  // below, so a rep from a different company can see a card but
  // can't mutate it.
  const visibleGiveaways = sponsorGiveaways;

  const headerBg = eventConfig?.backgroundURL
    ? `linear-gradient(160deg,rgba(10,5,30,0.82) 0%,rgba(30,10,60,0.72) 100%),url(${eventConfig.backgroundURL}) center/cover no-repeat`
    : isDark
      ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 100%)'
      : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 60%,#818cf8 100%)';

  if (!isSponsor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: t.bgPage }}>
        <div className="rounded-2xl p-6 text-center max-w-sm w-full"
          style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
            style={{ background: t.surface2 }}>
            <Gift size={26} color={t.emptyIcon} />
          </div>
          <h2 style={{ color: t.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Sponsors Only
          </h2>
          <p style={{ color: t.textMuted, fontSize: 13 }}>
            Adding giveaways and draws is available to sponsor representatives.
            Browse all live giveaways from the More menu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: t.bgPage }}>
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-5" style={{ background: headerBg }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Gift style={{ width: 20, height: 20, color: '#c4b5fd' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Sponsor Tools
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Manage Giveaways
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>
            Add prizes for attendees to enter at your booth.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Sparkles style={{ width: 12, height: 12, color: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{visibleGiveaways.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>active</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        <GiveawayForm
          onAdd={(data) => {
            addSponsorGiveaway({
              ...data,
              sponsorName: user?.company || user?.name || 'Sponsor',
              sponsorId: user?.id || 'sponsor',
            });
          }}
        />

        {visibleGiveaways.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Gift style={{ width: 14, height: 14, color: '#7c3aed' }} />
              <span style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>
                Your Giveaways ({visibleGiveaways.length})
              </span>
            </div>
            <div className="space-y-3">
              <AnimatePresence>
                {visibleGiveaways.map(g => {
                  // "Mine" here just controls whether edit/delete
                  // buttons are visible. Per product: any same-company
                  // rep can manage the booth's prizes, so isMyGiveaway
                  // already includes them.
                  const mine = isMyGiveaway(g);
                  // Show a "Added by Co-worker" hint for prizes the
                  // current rep didn't personally create — helps the
                  // team avoid accidentally duplicating an item.
                  const byline =
                    mine && g.sponsorId !== user?.id && g.sponsorName
                      ? `Added by ${g.sponsorName}`
                      : undefined;
                  return (
                    <GiveawayCard
                      key={g.id}
                      giveaway={g}
                      isMine={mine}
                      byline={byline}
                      onEdit={setEditing}
                      onRemove={removeSponsorGiveaway}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: t.surface2 }}>
              <Gift style={{ width: 28, height: 28, color: t.emptyIcon }} />
            </div>
            <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              No giveaways yet
            </h3>
            <p style={{ color: t.textMuted, fontSize: 13 }}>
              Add giveaways above to attract attendees to your booth
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editing && (
          <EditGiveawayModal
            giveaway={editing}
            onClose={() => setEditing(null)}
            onSave={async (updates) => {
              const id = editing.id;
              setEditing(null);
              await updateSponsorGiveaway(id, updates);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
