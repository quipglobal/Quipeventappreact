import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Search, Users, Clock, Building2, ChevronRight,
  Flame, ThermometerSun, Snowflake, Tag, ScanLine, FileText,
  X, Edit3, Save, Trash2, Download, Filter, MoreVertical,
  MessageCircle, Sparkles, Briefcase, CheckCircle, Calendar, Gift,
} from 'lucide-react';
import { useApp, Lead } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Priority = 'hot' | 'warm' | 'cold';

const priorityConfig: Record<Priority, { label: string; icon: React.ElementType; color: string; bg: string; dotColor: string }> = {
  hot:  { label: 'Hot',  icon: Flame,         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  dotColor: '#f87171' },
  warm: { label: 'Warm', icon: ThermometerSun, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', dotColor: '#fbbf24' },
  cold: { label: 'Cold', icon: Snowflake,      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', dotColor: '#60a5fa' },
};

const QUICK_TAGS = [
  'Follow Up', 'Demo Requested', 'Send Pricing', 'Decision Maker',
  'Technical Lead', 'Budget Holder', 'Interested in Enterprise', 'Referral',
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `Today, ${formatTime(date)}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${formatTime(date)}`;
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Mock pre-populated leads ────────────────────────────────────────────────

const mockPrePopulatedLeads: Lead[] = [
  {
    id: 'pre-1',
    code: 'ATT-4419',
    name: 'Olivia Martinez',
    title: 'Head of Procurement',
    company: 'Global Logistics Corp',
    avatar: 'https://ui-avatars.com/api/?name=Olivia+Martinez&background=ec4899&color=fff',
    notes: 'Very interested in our enterprise plan. Manages $2M annual software budget. Wants a custom demo next week. Currently using competitor product but contract ends Q2.',
    tags: ['Decision Maker', 'Demo Requested', 'Send Pricing'],
    priority: 'hot',
    timestamp: new Date(Date.now() - 45 * 60000), // 45 min ago
  },
  {
    id: 'pre-2',
    code: 'ATT-2781',
    name: 'James Park',
    title: 'Senior DevOps Engineer',
    company: 'Fintech Innovations',
    avatar: 'https://ui-avatars.com/api/?name=James+Park&background=3b82f6&color=fff',
    notes: 'Technical evaluation phase. Needs API docs and sandbox access. Will loop in his team lead for a follow-up call.',
    tags: ['Technical Lead', 'Follow Up'],
    priority: 'warm',
    timestamp: new Date(Date.now() - 90 * 60000), // 1.5 hrs ago
  },
  {
    id: 'pre-3',
    code: 'ATT-6155',
    name: 'Amara Osei',
    title: 'Innovation Manager',
    company: 'Deloitte Digital',
    avatar: 'https://ui-avatars.com/api/?name=Amara+Osei&background=10b981&color=fff',
    notes: 'Exploring partnerships for client engagements. Gave her our partner program brochure.',
    tags: ['Referral'],
    priority: 'warm',
    timestamp: new Date(Date.now() - 150 * 60000), // 2.5 hrs ago
  },
  {
    id: 'pre-4',
    code: 'ATT-8830',
    name: 'Chen Wei',
    title: 'Staff Software Engineer',
    company: 'ByteScale',
    avatar: 'https://ui-avatars.com/api/?name=Chen+Wei&background=8b5cf6&color=fff',
    notes: 'Just browsing, picked up stickers. Might be relevant for their infrastructure team but no immediate need.',
    tags: [],
    priority: 'cold',
    timestamp: new Date(Date.now() - 200 * 60000), // 3+ hrs ago
  },
  {
    id: 'pre-5',
    code: 'ATT-3372',
    name: 'Fatima Al-Rashid',
    title: 'VP of Technology',
    company: 'Emirates Digital',
    avatar: 'https://ui-avatars.com/api/?name=Fatima+AlRashid&background=f59e0b&color=fff',
    notes: 'Enterprise buyer — managing digital transformation for a 5,000-person org. Wants a follow-up video call next Tuesday. Extremely high value.',
    tags: ['Decision Maker', 'Budget Holder', 'Interested in Enterprise', 'Follow Up'],
    priority: 'hot',
    timestamp: new Date(Date.now() - 25 * 60000), // 25 min ago
  },
];

// ─── Lead Detail Component ───────────────────────────────────────────────────

const LeadDetailView: React.FC<{
  lead: Lead;
  onBack: () => void;
  onUpdate: (id: string, updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>) => void;
}> = ({ lead, onBack, onUpdate }) => {
  const { t, isDark } = useTheme();
  const pc = priorityConfig[lead.priority];

  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(lead.notes);
  const [editTags, setEditTags] = useState<string[]>(lead.tags);
  const [editPriority, setEditPriority] = useState<Priority>(lead.priority);

  const handleSave = () => {
    onUpdate(lead.id, { notes: editNotes, tags: editTags, priority: editPriority });
    setIsEditing(false);
  };

  const toggleTag = (tag: string) => {
    setEditTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 z-50 min-h-screen overflow-y-auto"
      style={{ background: t.bgPage }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-6"
        style={{
          background: isDark
            ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)'
            : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 50%,#818cf8 100%)',
        }}>
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-5 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.75)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>All Leads</span>
          </button>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
              {lead.avatar ? (
                <img src={lead.avatar} alt={lead.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', fontSize: 22, fontWeight: 800 }}>
                  {lead.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 3 }}>
                {lead.name}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{lead.title}</p>
              <p className="flex items-center gap-1.5 mt-1" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                <Building2 style={{ width: 11, height: 11 }} /> {lead.company}
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2.5 mt-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ background: pc.bg, backdropFilter: 'blur(8px)' }}>
              {React.createElement(pc.icon, { style: { width: 13, height: 13, color: pc.color } })}
              <span style={{ color: pc.color, fontSize: 12, fontWeight: 700 }}>{pc.label} Lead</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <ScanLine style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.5)' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'monospace' }}>{lead.code}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Clock style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.5)' }} />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{timeAgo(lead.timestamp)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────── */}
      <div className="px-5 -mt-3 mb-5 relative z-10">
        <div className="rounded-2xl p-3.5 flex items-center gap-2.5"
          style={{ background: t.surface, boxShadow: t.shadowHov, border: `1px solid ${t.border}` }}>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all active:scale-[0.97]"
            style={{
              background: isEditing ? t.warningBg : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              border: isEditing ? `1px solid ${t.warningText}40` : 'none',
              color: isEditing ? t.warningText : '#fff',
            }}>
            <Edit3 style={{ width: 15, height: 15 }} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{isEditing ? 'Editing…' : 'Edit Lead'}</span>
          </button>
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl active:scale-[0.97]"
            style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
            <Download style={{ width: 15, height: 15, color: t.accentSoft }} />
            <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>Export</span>
          </button>
        </div>
      </div>

      {/* ── Notes Section ──────────────────────────────────── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-2.5">
          <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>Conversation Notes</h3>
          {isEditing && (
            <button onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
              <Save style={{ width: 12, height: 12, color: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>Save</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <textarea
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={6}
            className="w-full p-4 rounded-xl resize-none outline-none transition-all focus:ring-2"
            style={{
              background: t.inputBg,
              border: `1px solid ${t.inputFocus}`,
              color: t.text,
              fontSize: 13,
              lineHeight: 1.65,
              ringColor: t.inputFocus,
            }}
            autoFocus
          />
        ) : (
          <div className="rounded-xl p-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            {lead.notes ? (
              <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{lead.notes}</p>
            ) : (
              <p style={{ color: t.textMuted, fontSize: 13, fontStyle: 'italic' }}>No notes captured yet. Tap "Edit Lead" to add notes.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Tags ────────────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Tags</h3>
        {isEditing ? (
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map(tag => {
              const active = editTags.includes(tag);
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
                  {active ? '✓ ' : ''}{tag}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {lead.tags.length > 0 ? lead.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                style={{ background: t.accentBg, color: t.accentSoft, fontSize: 12, fontWeight: 600, border: `1px solid ${t.borderAcc}` }}>
                <Tag style={{ width: 10, height: 10 }} /> {tag}
              </span>
            )) : (
              <p style={{ color: t.textMuted, fontSize: 12 }}>No tags added</p>
            )}
          </div>
        )}
      </div>

      {/* ── Priority (edit mode) ────────────────────────────── */}
      {isEditing && (
        <div className="px-5 mb-5">
          <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Priority</h3>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(priorityConfig) as [Priority, typeof priorityConfig.hot][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = editPriority === key;
              return (
                <button key={key} onClick={() => setEditPriority(key)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all active:scale-[0.97]"
                  style={{
                    background: isActive ? cfg.bg : t.surface,
                    border: `1.5px solid ${isActive ? cfg.color : t.border}`,
                  }}>
                  <Icon style={{ width: 14, height: 14, color: isActive ? cfg.color : t.textMuted }} />
                  <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? cfg.color : t.textSec }}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Scan Details ────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Scan Details</h3>
        <div className="rounded-xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.1)' }}>
              <ScanLine style={{ width: 14, height: 14, color: '#7c3aed' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textMuted, fontSize: 11 }}>Badge Code</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{lead.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${t.divider}` }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.1)' }}>
              <Clock style={{ width: 14, height: 14, color: '#10b981' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textMuted, fontSize: 11 }}>Scanned at</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{formatDate(lead.timestamp)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.1)' }}>
              <Calendar style={{ width: 14, height: 14, color: '#6366f1' }} />
            </div>
            <div className="flex-1">
              <p style={{ color: t.textMuted, fontSize: 11 }}>Event</p>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>Tech Summit 2026</p>
            </div>
          </div>
        </div>
      </div>

      <div className="h-8" />
    </motion.div>
  );
};

// ─── Leads Page Component ────────────────────────────────────────────────────

interface LeadsPageProps {
  onBack: () => void;
  onNavigateToScan: () => void;
  onNavigateToDraw?: () => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ onBack, onNavigateToScan, onNavigateToDraw }) => {
  const { leads, updateLead } = useApp();
  const { t, isDark } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Combine real leads with pre-populated ones
  const allLeads = useMemo(() => {
    const realLeadCodes = leads.map(l => l.code);
    const uniqueMocks = mockPrePopulatedLeads.filter(m => !realLeadCodes.includes(m.code));
    return [...leads, ...uniqueMocks];
  }, [leads]);

  // Filter
  const filteredLeads = useMemo(() => {
    return allLeads.filter(lead => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        lead.name.toLowerCase().includes(q) ||
        lead.company.toLowerCase().includes(q) ||
        lead.title.toLowerCase().includes(q) ||
        lead.notes.toLowerCase().includes(q) ||
        lead.tags.some(t => t.toLowerCase().includes(q));
      const matchesPriority = filterPriority === 'all' || lead.priority === filterPriority;
      return matchesSearch && matchesPriority;
    });
  }, [allLeads, searchQuery, filterPriority]);

  // Stats
  const hotCount  = allLeads.filter(l => l.priority === 'hot').length;
  const warmCount = allLeads.filter(l => l.priority === 'warm').length;
  const coldCount = allLeads.filter(l => l.priority === 'cold').length;

  const handleUpdateLead = (id: string, updates: Partial<Pick<Lead, 'notes' | 'tags' | 'priority'>>) => {
    // For mock leads, update in the selected view only
    updateLead(id, updates);
    // Also update selectedLead in place
    if (selectedLead && selectedLead.id === id) {
      setSelectedLead({ ...selectedLead, ...updates });
    }
  };

  return (
    <div className="min-h-screen relative" style={{ background: t.bgPage }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 pt-12 pb-5"
        style={{
          background: isDark
            ? 'linear-gradient(160deg,#1e1b4b 0%,#312e81 40%,#4f46e5 100%)'
            : 'linear-gradient(160deg,#7c3aed 0%,#6366f1 60%,#818cf8 100%)',
        }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-12"
          style={{ background: 'radial-gradient(circle, #c4b5fd, transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-4 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.7)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
          </button>

          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users style={{ width: 20, height: 20, color: '#c4b5fd' }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Lead Retrieval
                </span>
              </div>
              <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>
                My Leads
              </h1>
            </div>
            <button onClick={onNavigateToScan}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ScanLine style={{ width: 16, height: 16, color: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Scan</span>
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2.5 mt-4 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Users style={{ width: 13, height: 13, color: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{allLeads.length}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>total</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.15)' }}>
              <Flame style={{ width: 12, height: 12, color: '#f87171' }} />
              <span style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>{hotCount}</span>
              <span style={{ color: 'rgba(248,113,113,0.7)', fontSize: 11 }}>hot</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.15)' }}>
              <ThermometerSun style={{ width: 12, height: 12, color: '#fbbf24' }} />
              <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>{warmCount}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Snowflake style={{ width: 12, height: 12, color: '#60a5fa' }} />
              <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700 }}>{coldCount}</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.4)' }} />
            <input
              type="text"
              placeholder="Search leads by name, company, notes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl outline-none transition-colors"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontSize: 13,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 active:opacity-60">
                <X style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Priority Filter Chips ──────────────────────────── */}
      <div className="px-5 py-3 flex gap-2">
        {(['all', 'hot', 'warm', 'cold'] as const).map(p => {
          const isAll = p === 'all';
          const cfg = isAll ? null : priorityConfig[p];
          const count = isAll ? allLeads.length : allLeads.filter(l => l.priority === p).length;
          return (
            <button key={p}
              onClick={() => setFilterPriority(p)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full flex-shrink-0 transition-all"
              style={{
                background: filterPriority === p ? (cfg ? cfg.bg : t.accent) : t.surface,
                color: filterPriority === p ? (cfg ? cfg.color : '#fff') : t.textSec,
                fontSize: 12,
                fontWeight: filterPriority === p ? 700 : 600,
                border: `1px solid ${filterPriority === p ? (cfg ? cfg.color + '40' : t.accent) : t.border}`,
              }}>
              {cfg && React.createElement(cfg.icon, { style: { width: 12, height: 12 } })}
              <span>{isAll ? 'All' : cfg!.label}</span>
              <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ── Lead Cards ─────────────────────────────────────── */}
      <div className="px-5 pb-24 space-y-2.5">
        {/* Lucky Draw CTA */}
        {onNavigateToDraw && allLeads.length > 0 && (
          <button onClick={onNavigateToDraw}
            className="w-full rounded-2xl p-4 text-left active:scale-[0.98] transition-all relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 20px rgba(245,158,11,0.2)' }}>
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
            <div className="relative z-10 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.2)' }}>
                <Gift style={{ width: 20, height: 20, color: '#fff' }} />
              </div>
              <div className="flex-1">
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>Lucky Draw</p>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                  Pick a random winner from {allLeads.length} leads
                </p>
              </div>
              <ChevronRight style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.6)' }} />
            </div>
          </button>
        )}

        {filteredLeads.map((lead, index) => {
          const pc = priorityConfig[lead.priority];
          const PIcon = pc.icon;
          return (
            <motion.button
              key={lead.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.3 }}
              onClick={() => setSelectedLead(lead)}
              className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
              style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}
            >
              <div className="flex items-start gap-3.5">
                {/* Avatar with priority ring */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden" style={{ border: `2px solid ${pc.color}40` }}>
                    {lead.avatar ? (
                      <img src={lead.avatar} alt={lead.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', color: '#fff', fontSize: 18, fontWeight: 800 }}>
                        {lead.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: pc.bg, border: `1.5px solid ${pc.color}` }}>
                    <PIcon style={{ width: 10, height: 10, color: pc.color }} />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="truncate" style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{lead.name}</h3>
                  </div>
                  <p className="truncate" style={{ color: t.textSec, fontSize: 12, marginBottom: 2 }}>{lead.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 truncate" style={{ color: t.textMuted, fontSize: 11 }}>
                      <Building2 style={{ width: 10, height: 10 }} /> {lead.company}
                    </span>
                    <span className="w-px h-3" style={{ background: t.divider }} />
                    <span className="flex items-center gap-1" style={{ color: t.textMuted, fontSize: 11 }}>
                      <Clock style={{ width: 10, height: 10 }} /> {timeAgo(lead.timestamp)}
                    </span>
                  </div>
                </div>

                <ChevronRight style={{ width: 14, height: 14, color: t.textMuted, flexShrink: 0, marginTop: 4 }} />
              </div>

              {/* Notes preview */}
              {lead.notes && (
                <div className="mt-3 px-3 py-2 rounded-lg" style={{ background: t.surface2 }}>
                  <p className="line-clamp-2" style={{ color: t.textSec, fontSize: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {lead.notes}
                  </p>
                </div>
              )}

              {/* Tags */}
              {lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {lead.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                      style={{ background: t.accentBg, color: t.accentSoft, fontSize: 10, fontWeight: 600 }}>
                      <Tag style={{ width: 8, height: 8 }} /> {tag}
                    </span>
                  ))}
                  {lead.tags.length > 3 && (
                    <span style={{ color: t.textMuted, fontSize: 10, fontWeight: 600, alignSelf: 'center' }}>
                      +{lead.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}

        {/* Empty state */}
        {filteredLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ background: t.surface2 }}>
              <ScanLine style={{ width: 28, height: 28, color: t.emptyIcon }} />
            </div>
            <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {searchQuery || filterPriority !== 'all' ? 'No matching leads' : 'No leads yet'}
            </h3>
            <p style={{ color: t.textMuted, fontSize: 13, marginBottom: 20 }}>
              {searchQuery || filterPriority !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Start scanning attendee badges to capture leads'}
            </p>
            {!searchQuery && filterPriority === 'all' && (
              <button onClick={onNavigateToScan}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                <ScanLine style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Scan First Lead</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {selectedLead && (
          <LeadDetailView
            lead={selectedLead}
            onBack={() => setSelectedLead(null)}
            onUpdate={handleUpdateLead}
          />
        )}
      </AnimatePresence>
    </div>
  );
};