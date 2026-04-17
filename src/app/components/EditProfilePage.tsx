import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Camera, Check, Loader2, Mail, Phone, Briefcase,
  Building2, Linkedin, Globe, Twitter, Github, X, Plus, ChevronDown,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import {
  getUserProfileApi, updateUserProfileApi, uploadAvatarApi,
  type UserProfile, type ProfileUpdatePayload, type SocialLinks,
} from '@/app/api/userClient';
import {
  listIndustriesApi, listTagsApi, listCompaniesApi, type Lookup,
} from '@/app/api/lookupsClient';

interface EditProfilePageProps {
  onBack: () => void;
}

const SOCIAL_KEYS: { key: keyof SocialLinks; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }>; placeholder: string }[] = [
  { key: 'linkedin', label: 'LinkedIn',  icon: Linkedin, placeholder: 'https://linkedin.com/in/yourname' },
  { key: 'twitter',  label: 'Twitter / X', icon: Twitter,  placeholder: 'https://twitter.com/yourhandle' },
  { key: 'github',   label: 'GitHub',    icon: Github,   placeholder: 'https://github.com/yourhandle' },
  { key: 'website',  label: 'Website',   icon: Globe,    placeholder: 'https://your-site.com' },
];

export const EditProfilePage: React.FC<EditProfilePageProps> = ({ onBack }) => {
  const { user, setUser, showToast } = useApp();
  const { t } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [industryId, setIndustryId] = useState<number | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [avatarUrl, setAvatarUrl] = useState('');
  const [topicIds, setTopicIds] = useState<number[]>([]);

  const [industries, setIndustries] = useState<Lookup[]>([]);
  const [companies, setCompanies] = useState<Lookup[]>([]);
  const [topics, setTopics] = useState<Lookup[]>([]);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyOpen, setCompanyOpen] = useState(false);

  // Load current profile + lookups in parallel.
  // Use allSettled so a single rejection can't strand the UI in "loading".
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([
      getUserProfileApi(),
      listIndustriesApi(),
      listTagsApi(),
      listCompaniesApi(500),
    ]).then(([profileR, industriesR, tagsR, companiesR]) => {
      if (cancelled) return;
      const partialErrors: string[] = [];

      if (industriesR.status === 'fulfilled' && industriesR.value.success && industriesR.value.data) {
        setIndustries(industriesR.value.data);
      } else partialErrors.push('industries');

      if (tagsR.status === 'fulfilled' && tagsR.value.success && tagsR.value.data) {
        setTopics(tagsR.value.data);
      } else partialErrors.push('topics');

      if (companiesR.status === 'fulfilled' && companiesR.value.success && companiesR.value.data) {
        setCompanies(companiesR.value.data);
      } else partialErrors.push('companies');

      const liveProfile = profileR.status === 'fulfilled' && profileR.value.success
        ? profileR.value.data
        : null;

      if (liveProfile) {
        applyProfile(liveProfile);
      } else if (user) {
        // Fallback to whatever we already have on the user object so the form
        // is never blank.
        applyProfile({
          id: user.id, name: user.name, firstName: user.firstName ?? '', lastName: user.lastName ?? '',
          email: user.email, phone: user.phone ?? '', company: user.company,
          companyId: user.companyId ?? null, industry: user.industry ?? '', industryId: user.industryId ?? null,
          title: user.title, bio: user.bio ?? '', avatar: user.avatar, profileImage: user.profileImage ?? '',
          linkedinUrl: user.linkedinUrl ?? '', socialLinks: user.socialLinks ?? {},
          interestedTopics: user.interestedTopics ?? [],
          points: user.points, tier: user.tier, role: user.role,
          interests: user.interests, profileComplete: user.profileComplete,
        });
        partialErrors.unshift('profile');
      }

      if (partialErrors.length) {
        setError(`Couldn't load ${partialErrors.join(', ')}. You can still edit and save.`);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyProfile(p: UserProfile) {
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setEmail(p.email);
    setPhone(p.phone);
    setTitle(p.title);
    setBio(p.bio);
    setCompanyId(p.companyId);
    setIndustryId(p.industryId);
    setLinkedinUrl(p.linkedinUrl);
    setSocialLinks(p.socialLinks ?? {});
    setAvatarUrl(p.avatar || p.profileImage || '');
    setTopicIds((p.interestedTopics ?? []).map(t => t.id).filter(Boolean));
    setCompanyQuery(p.company);
  }

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (!q) return companies.slice(0, 50);
    return companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [companies, companyQuery]);

  const selectedCompanyName = useMemo(() => {
    if (companyId == null) return '';
    return companies.find(c => c.id === companyId)?.name ?? companyQuery;
  }, [companies, companyId, companyQuery]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2 MB.');
      return;
    }

    setError(null);
    setUploadingAvatar(true);
    const res = await uploadAvatarApi(file);
    setUploadingAvatar(false);

    if (!res.success || !res.data) {
      setError(res.error?.message ?? 'Could not upload image.');
      return;
    }
    setAvatarUrl(res.data.avatarUrl);
  };

  const toggleTopic = (id: number) => {
    setTopicIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const setSocial = (k: string, v: string) => {
    setSocialLinks(prev => {
      const next = { ...prev };
      if (v) next[k] = v; else delete next[k];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const cleanedSocial: SocialLinks = {};
    for (const [k, v] of Object.entries(socialLinks)) if (v) cleanedSocial[k] = v;

    const selectedTopicNames = topicIds
      .map(id => topics.find(t => t.id === id)?.name)
      .filter((n): n is string => Boolean(n));

    const payload: ProfileUpdatePayload = {
      first_name: firstName.trim() || undefined,
      last_name: lastName.trim() || undefined,
      name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      title: title.trim() || undefined,
      bio: bio.trim() || undefined,
      linkedin_url: linkedinUrl.trim() || undefined,
      company_id: companyId,
      industry_id: industryId,
      social_links: Object.keys(cleanedSocial).length ? cleanedSocial : undefined,
      avatar_url: avatarUrl || undefined,
      interests: selectedTopicNames.length ? selectedTopicNames : undefined,
    };

    const res = await updateUserProfileApi(payload);
    setSaving(false);

    if (!res.success || !res.data) {
      setError(res.error?.message ?? 'Could not save your profile. Please try again.');
      return;
    }

    const p = res.data;
    if (user) {
      setUser({
        ...user,
        name: p.name || user.name,
        email: p.email || user.email,
        title: p.title || user.title,
        company: p.company || user.company,
        avatar: p.avatar || p.profileImage || user.avatar,
        interests: p.interests,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        bio: p.bio,
        linkedinUrl: p.linkedinUrl,
        socialLinks: p.socialLinks,
        companyId: p.companyId,
        industry: p.industry,
        industryId: p.industryId,
        profileImage: p.profileImage,
        interestedTopics: p.interestedTopics,
      });
    }
    showToast('Profile updated');
    onBack();
  };

  // ─── Reusable styles ───────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    background: t.surface2,
    border: `1px solid ${t.border}`,
    color: t.text,
    borderRadius: 12,
    padding: '12px 14px',
    width: '100%',
    fontSize: 14,
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    color: t.textMuted, fontSize: 12, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    display: 'block', marginBottom: 6,
  };
  const sectionStyle: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    boxShadow: t.shadow,
    borderRadius: 16,
    padding: 16,
  };
  const headingStyle: React.CSSProperties = {
    color: t.text, fontSize: 14, fontWeight: 700,
    marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: t.bgPage }}>
        <Loader2 style={{ width: 28, height: 28, color: t.accent }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-32 min-h-screen" style={{ background: t.bgPage }}>
      {/* Header */}
      <div
        className="px-5 pt-12 pb-6 text-white sticky top-0 z-10"
        style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#9333ea 100%)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>Edit Profile</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Update your details and how others see you</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5">
        {/* Avatar */}
        <div style={sectionStyle}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${firstName} ${lastName}` || 'User')}&background=7c3aed&color=fff`}
                alt="Avatar preview"
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: `3px solid ${t.border}` }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change profile photo"
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-white"
                style={{ background: '#7c3aed', border: `2px solid ${t.surface}`, opacity: uploadingAvatar ? 0.7 : 1 }}
              >
                {uploadingAvatar
                  ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
                  : <Camera style={{ width: 14, height: 14 }} />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Profile Photo</p>
              <p style={{ color: t.textMuted, fontSize: 12, marginBottom: 8 }}>
                {uploadingAvatar ? 'Uploading…' : 'JPG or PNG, up to 2 MB'}
              </p>
              <input
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="…or paste an image URL"
                style={{ ...inputStyle, padding: '8px 10px', fontSize: 12 }}
              />
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Personal Information</h2>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={labelStyle}>First Name</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div className="mb-3">
            <label style={labelStyle}><Mail style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          </div>

          <div className="mb-3">
            <label style={labelStyle}><Phone style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
          </div>

          <div className="mb-3">
            <label style={labelStyle}><Briefcase style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />Job Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} placeholder="e.g. Chief Information Officer" />
          </div>

          <div>
            <label style={labelStyle}>Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder="Tell others a bit about yourself"
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {/* Company & Industry */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}><Building2 style={{ width: 14, height: 14 }} />Company & Industry</h2>

          <div className="mb-3 relative">
            <label style={labelStyle}>Company</label>
            <div className="relative">
              <input
                value={companyOpen ? companyQuery : selectedCompanyName}
                onChange={e => { setCompanyQuery(e.target.value); setCompanyOpen(true); }}
                onFocus={() => { setCompanyQuery(selectedCompanyName); setCompanyOpen(true); }}
                placeholder="Search for your company"
                style={inputStyle}
              />
              {companyId != null && (
                <button
                  onClick={() => { setCompanyId(null); setCompanyQuery(''); }}
                  aria-label="Clear company"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: t.divider }}
                >
                  <X style={{ width: 12, height: 12, color: t.textMuted }} />
                </button>
              )}
            </div>
            {companyOpen && filteredCompanies.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 max-h-60 overflow-y-auto"
                style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.shadow }}
              >
                {filteredCompanies.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCompanyId(c.id); setCompanyQuery(c.name); setCompanyOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:opacity-80"
                    style={{ color: t.text, fontSize: 13, borderBottom: `1px solid ${t.divider}` }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {companyOpen && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setCompanyOpen(false)}
              />
            )}
          </div>

          <div>
            <label style={labelStyle}>Industry</label>
            <div className="relative">
              <select
                value={industryId ?? ''}
                onChange={e => setIndustryId(e.target.value ? Number(e.target.value) : null)}
                style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}
              >
                <option value="">Select an industry…</option>
                {industries.map(i => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <ChevronDown
                style={{ width: 16, height: 16, color: t.textMuted, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}><Linkedin style={{ width: 14, height: 14 }} />Social Links</h2>

          <div className="mb-3">
            <label style={labelStyle}>LinkedIn URL</label>
            <input
              value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              style={inputStyle}
            />
          </div>

          {SOCIAL_KEYS.filter(s => s.key !== 'linkedin').map(({ key, label, icon: Icon, placeholder }) => (
            <div key={String(key)} className="mb-3 last:mb-0">
              <label style={labelStyle}>
                <Icon style={{ width: 12, height: 12, display: 'inline', marginRight: 4 }} />
                {label}
              </label>
              <input
                value={socialLinks[key] ?? ''}
                onChange={e => setSocial(String(key), e.target.value)}
                placeholder={placeholder}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        {/* Interested Topics */}
        <div style={sectionStyle}>
          <h2 style={headingStyle}>Interested Topics</h2>
          <p style={{ color: t.textMuted, fontSize: 12, marginBottom: 12 }}>
            Pick the topics you'd like recommendations and matches around.
          </p>
          <div className="flex flex-wrap gap-2">
            {topics.map(topic => {
              const selected = topicIds.includes(topic.id);
              return (
                <button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: selected ? '#7c3aed' : t.surface2,
                    border: `1px solid ${selected ? '#7c3aed' : t.border}`,
                    color: selected ? '#fff' : t.text,
                  }}
                >
                  {selected
                    ? <Check style={{ width: 12, height: 12 }} />
                    : <Plus  style={{ width: 12, height: 12 }} />}
                  {topic.name}
                </button>
              );
            })}
            {topics.length === 0 && (
              <p style={{ color: t.textMuted, fontSize: 13 }}>No topics available right now.</p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl p-3" style={{ background: t.errorBg, border: `1px solid ${t.errorText}33`, color: t.errorText, fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 py-4 flex gap-3"
        style={{ background: t.surface, borderTop: `1px solid ${t.border}`, paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={onBack}
          disabled={saving}
          className="flex-1 py-3 rounded-xl font-semibold"
          style={{ background: t.surface2, color: t.text, border: `1px solid ${t.border}` }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-[2] py-3 rounded-xl font-semibold text-white inline-flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving
            ? <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} />Saving…</>
            : <><Check style={{ width: 16, height: 16 }} />Save Changes</>}
        </button>
      </div>
    </div>
  );
};
