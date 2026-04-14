import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Building2, Users, Globe, ChevronRight,
  ExternalLink, Loader2, RefreshCw, Search, X,
  Mail, Phone, BadgeCheck, Briefcase,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import {
  getEventCompaniesApi,
  getCompanyDetailApi,
  type Company,
  type CompanyRep,
} from '@/app/api/companiesClient';

interface SponsorsListPageProps { onBack?: () => void; }

// ─── Company logo / initials ──────────────────────────────────────────────────

const LOGO_COLORS = [
  '#7c3aed','#4f46e5','#0284c7','#059669',
  '#d97706','#dc2626','#9333ea','#0891b2',
];
function logoColor(id: number) { return LOGO_COLORS[id % LOGO_COLORS.length]; }

const CompanyLogo: React.FC<{ company: Company; size?: number }> = ({ company, size = 56 }) => {
  const [err, setErr] = useState(false);
  const initials = company.name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const bg = logoColor(company.companyId);

  if (company.logoUrl && !err) {
    return (
      <img src={company.logoUrl} alt={company.name} onError={() => setErr(true)}
        className="rounded-2xl object-contain"
        style={{ width: size, height: size }} />
    );
  }
  return (
    <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg,${bg},${bg}bb)` }}>
      <span style={{ color: '#fff', fontSize: size * 0.3, fontWeight: 800, letterSpacing: '-0.02em' }}>{initials}</span>
    </div>
  );
};

// ─── Rep Avatar ───────────────────────────────────────────────────────────────

const RepAvatar: React.FC<{ rep: CompanyRep; size?: number }> = ({ rep, size = 40 }) => {
  const [err, setErr] = useState(false);
  const initials = rep.fullName.split(' ').slice(0,2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const bg = logoColor(rep.id);
  if (rep.avatarUrl && !err) {
    return <img src={rep.avatarUrl} alt={rep.fullName} onError={()=>setErr(true)}
      className="rounded-xl object-cover flex-shrink-0" style={{ width:size, height:size }} />;
  }
  return (
    <div className="rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ width:size, height:size, background:`linear-gradient(135deg,${bg},${bg}aa)` }}>
      <span style={{ color:'#fff', fontSize:size*0.33, fontWeight:800 }}>{initials}</span>
    </div>
  );
};

// ─── Company Detail Page ──────────────────────────────────────────────────────

const CompanyDetailPage: React.FC<{
  company: Company;
  onBack: () => void;
}> = ({ company, onBack }) => {
  const { t, isDark } = useTheme();
  const [detail, setDetail] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getCompanyDetailApi(company.companyId).then(res => {
      if (!mounted) return;
      if (res.success && res.data) setDetail(res.data);
      else setError(res.error?.message ?? 'Failed to load company');
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [company.companyId]);

  const data = detail ?? company;
  const reps = detail?.reps ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 z-50 overflow-y-auto"
      style={{ background: t.bgPage }}
    >
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-8"
        style={{
          background: isDark
            ? 'linear-gradient(155deg,#1c1917 0%,#292524 40%,#44403c 100%)'
            : 'linear-gradient(155deg,#f97316 0%,#ef4444 60%,#ec4899 100%)',
        }}>
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#fff,transparent 70%)' }} />

        <div className="relative z-10">
          <button onClick={onBack}
            className="flex items-center gap-1.5 mb-5 active:opacity-70 transition-opacity"
            style={{ color: 'rgba(255,255,255,0.72)' }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Partners</span>
          </button>

          <div className="flex items-start gap-4">
            <div className="rounded-2xl overflow-hidden border-2 flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
              <CompanyLogo company={data} size={72} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
                {data.name}
              </h1>
              {data.headquarters && (
                <p className="mt-1" style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                  {data.headquarters}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {data.employeeCount && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
                    <Users style={{ width: 10, height: 10 }} /> {data.employeeCount} employees
                  </span>
                )}
                {reps.length > 0 && !loading && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600 }}>
                    <Briefcase style={{ width: 10, height: 10 }} /> {reps.length} rep{reps.length !== 1 ? 's' : ''} at event
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Website */}
      {data.website && (
        <div className="mx-5 -mt-4 mb-5 relative z-10">
          <a href={data.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl w-full"
            style={{ background: t.surface, boxShadow: t.shadowHov, border: `1px solid ${t.border}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.12)' }}>
              <Globe style={{ width: 16, height: 16, color: '#6366f1' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: t.textSec, fontSize: 11, fontWeight: 600 }}>Website</p>
              <p className="truncate" style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{data.website}</p>
            </div>
            <ExternalLink style={{ width: 14, height: 14, color: t.textMuted }} />
          </a>
        </div>
      )}

      {/* About */}
      {data.description && (
        <div className="px-5 mb-5">
          <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>About</h3>
          <div className="rounded-2xl px-4 py-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.65 }}>{data.description}</p>
          </div>
        </div>
      )}

      {/* Company Details */}
      <div className="px-5 mb-5">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Company Details</h3>
        <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
          {[
            { label: 'Company Size', value: data.employeeCount },
            { label: 'Type', value: data.companyType },
            { label: 'Domain', value: data.domain },
            { label: 'Founded', value: data.foundedYear ? String(data.foundedYear) : null },
            { label: 'Revenue', value: data.revenueRange },
            { label: 'Industries', value: data.industries.length ? data.industries.join(', ') : null },
          ].filter(row => row.value).map((row, i, arr) => (
            <div key={row.label}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.divider}` : undefined }}>
              <span style={{ color: t.textSec, fontSize: 13 }}>{row.label}</span>
              <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>{row.value}</span>
            </div>
          ))}
          {!data.employeeCount && !data.companyType && !data.domain && !data.foundedYear && (
            <div className="px-4 py-4">
              <p style={{ color: t.textMuted, fontSize: 13 }}>No additional details available.</p>
            </div>
          )}
        </div>
      </div>

      {/* Representatives */}
      <div className="px-5 mb-8">
        <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          Event Representatives
        </h3>

        {loading && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 style={{ width: 18, height: 18, color: '#7c3aed', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: t.textMuted, fontSize: 13 }}>Loading representatives…</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl px-4 py-4" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <p style={{ color: t.textMuted, fontSize: 13 }}>{error}</p>
          </div>
        )}

        {!loading && !error && reps.length === 0 && (
          <div className="rounded-2xl px-4 py-4 flex items-center gap-3"
            style={{ background: t.surface, border: `1px solid ${t.border}` }}>
            <Users style={{ width: 18, height: 18, color: t.emptyIcon }} />
            <p style={{ color: t.textMuted, fontSize: 13 }}>No representatives listed for this event.</p>
          </div>
        )}

        {!loading && reps.length > 0 && (
          <div className="space-y-2.5">
            {reps.map(rep => (
              <div key={rep.id}
                className="rounded-2xl px-4 py-4"
                style={{ background: t.surface, border: `1px solid ${t.border}` }}>
                <div className="flex items-start gap-3 mb-3">
                  <RepAvatar rep={rep} size={44} />
                  <div className="flex-1 min-w-0">
                    <p style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{rep.fullName}</p>
                    {rep.title && (
                      <p style={{ color: t.textSec, fontSize: 12, marginTop: 1 }}>{rep.title}</p>
                    )}
                    {rep.roles.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {Array.from(new Set(rep.roles)).map(r => (
                          <span key={r}
                            className="px-2 py-0.5 rounded-md text-xs font-bold"
                            style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                            {r.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact rows */}
                <div className="space-y-2 mt-1">
                  {rep.email && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <Mail style={{ width: 11, height: 11, color: '#6366f1' }} />
                      </div>
                      <span style={{ color: t.textSec, fontSize: 12 }}>
                        {rep.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)}
                      </span>
                    </div>
                  )}
                  {rep.phone && (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: 'rgba(16,185,129,0.1)' }}>
                        <Phone style={{ width: 11, height: 11, color: '#10b981' }} />
                      </div>
                      <span style={{ color: t.textSec, fontSize: 12 }}>
                        {'••••' + rep.phone.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Company Card ─────────────────────────────────────────────────────────────

const CompanyCard: React.FC<{
  company: Company;
  index: number;
  onClick: () => void;
}> = ({ company, index, onClick }) => {
  const { t } = useTheme();

  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.3 }}
      onClick={onClick}
      className="w-full rounded-2xl p-4 text-left active:scale-[0.99] transition-all"
      style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}
    >
      <div className="flex items-center gap-3.5">
        <CompanyLogo company={company} size={52} />

        <div className="flex-1 min-w-0">
          <h3 className="truncate" style={{ color: t.text, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 2 }}>
            {company.name}
          </h3>

          <div className="flex items-center gap-3 flex-wrap">
            {company.website && (
              <span className="flex items-center gap-1 truncate" style={{ color: t.textSec, fontSize: 11 }}>
                <Globe style={{ width: 10, height: 10, color: t.textMuted, flexShrink: 0 }} />
                {company.website.replace(/^https?:\/\//i, '')}
              </span>
            )}
            {company.headquarters && (
              <span style={{ color: t.textMuted, fontSize: 11 }}>{company.headquarters}</span>
            )}
          </div>
        </div>

        <ChevronRight style={{ width: 14, height: 14, color: t.textMuted, flexShrink: 0 }} />
      </div>
    </motion.button>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const SponsorsListPage: React.FC<SponsorsListPageProps> = ({ onBack }) => {
  const { eventConfig } = useApp();
  const { t, isDark } = useTheme();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Company | null>(null);

  const fetchCompanies = useCallback(async () => {
    if (!eventConfig?.eventId) { setLoading(false); return; }
    setError(null);
    const res = await getEventCompaniesApi(eventConfig.eventId);
    if (res.success && res.data) {
      setCompanies(res.data);
    } else {
      setError(res.error?.message ?? 'Failed to load companies');
    }
    setLoading(false);
  }, [eventConfig?.eventId]);

  useEffect(() => {
    setLoading(true);
    fetchCompanies();
  }, [fetchCompanies]);

  const filtered = companies.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen relative" style={{ background: t.bgPage }}>

      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-12 pb-6"
        style={{
          background: isDark
            ? 'linear-gradient(155deg,#1c1917 0%,#292524 40%,#44403c 100%)'
            : 'linear-gradient(155deg,#f97316 0%,#ef4444 65%,#ec4899 100%)',
        }}>
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle,#fff,transparent 70%)' }} />

        <div className="relative z-10">
          {onBack && (
            <button onClick={onBack}
              className="flex items-center gap-1.5 mb-4 active:opacity-70 transition-opacity"
              style={{ color: 'rgba(255,255,255,0.7)' }}>
              <ArrowLeft style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Back</span>
            </button>
          )}

          <div className="flex items-center gap-2 mb-1">
            <Building2 style={{ width: 20, height: 20, color: 'rgba(255,255,255,0.7)' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Partners & Companies
            </span>
          </div>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 2 }}>
            {eventConfig?.name ?? 'Event'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, marginBottom: 12 }}>
            {loading ? '…' : `${companies.length} compan${companies.length !== 1 ? 'ies' : 'y'} attending`}
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.4)' }} />
            <input type="text"
              placeholder="Search companies…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl outline-none"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 13,
              }} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 active:opacity-60">
                <X style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.5)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-4 pb-28">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 style={{ width: 32, height: 32, color: '#f97316', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: t.textMuted, fontSize: 13 }}>Loading partners…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Building2 style={{ width: 28, height: 28, color: '#ef4444' }} />
            </div>
            <div>
              <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                Couldn't load companies
              </h3>
              <p style={{ color: t.textMuted, fontSize: 13, marginBottom: 16 }}>{error}</p>
              <button onClick={() => { setLoading(true); fetchCompanies(); }}
                className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl"
                style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                <RefreshCw style={{ width: 14, height: 14 }} /> Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && companies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: t.surface2 }}>
              <Building2 style={{ width: 28, height: 28, color: t.emptyIcon }} />
            </div>
            <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>No companies yet</h3>
            <p style={{ color: t.textMuted, fontSize: 13, maxWidth: 240 }}>
              Companies attending this event will appear here.
            </p>
          </div>
        )}

        {/* Results label */}
        {!loading && !error && filtered.length > 0 && (
          <div className="mb-3">
            <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
              {filtered.length} compan{filtered.length !== 1 ? 'ies' : 'y'}
              {search ? ' found' : ' attending'}
            </p>
          </div>
        )}

        {/* List */}
        <div className="space-y-2.5">
          {filtered.map((company, index) => (
            <CompanyCard
              key={company.id}
              company={company}
              index={index}
              onClick={() => setSelected(company)}
            />
          ))}

          {/* No search results */}
          {!loading && !error && companies.length > 0 && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ background: t.surface2 }}>
                <Search style={{ width: 24, height: 24, color: t.emptyIcon }} />
              </div>
              <h3 style={{ color: t.text, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>No results</h3>
              <p style={{ color: t.textMuted, fontSize: 13 }}>No companies match "{search}"</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail overlay */}
      <AnimatePresence>
        {selected && (
          <CompanyDetailPage
            company={selected}
            onBack={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
