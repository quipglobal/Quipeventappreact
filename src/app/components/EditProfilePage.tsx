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
  getMemberDetailApi, getMeProfileApi,
} from '@/app/api/audienceClient';
import {
  listIndustriesApi, listTagsApi, listCompaniesApi, searchCompaniesApi, type Lookup,
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
  const { user, setUser, showToast, eventConfig } = useApp();
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
  const [companySearchResults, setCompanySearchResults] = useState<Lookup[]>([]);
  const companySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Name hints: used to match industry/topics/company by name when the backend
  // returns strings or objects without IDs. Cleared once matched to lookup lists.
  const [industryNameHint, setIndustryNameHint] = useState('');
  const [topicNameHints, setTopicNameHints] = useState<string[]>([]);
  const [companyNameHint, setCompanyNameHint] = useState('');

  // Load profile first so the form renders immediately — no waiting on lookups.
  // Lookups (industries, tags, companies) load concurrently in the background
  // and update the dropdowns/chip-pickers as they arrive.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getUserProfileApi().then(profileR => {
      if (cancelled) return;

      // Track what the primary /me fetch gave us so we know what to backfill
      // from the richer audience profile endpoint without overwriting real data.
      let primaryCompanyId: number | null = null;
      let primaryHasLinkedin = false;
      let primaryHasSocial = false;
      let primaryHasTopics = false;

      if (profileR.success && profileR.data) {
        const p = profileR.data;
        applyProfile(p);
        primaryCompanyId = p.companyId ?? null;
        primaryHasLinkedin = !!(p.linkedinUrl || (p.socialLinks ?? {}).linkedin);
        primaryHasSocial   = Object.keys(p.socialLinks ?? {}).some(k => k !== 'linkedin' && (p.socialLinks as Record<string,string>)[k]);
        primaryHasTopics   = (p.interestedTopics ?? []).length > 0;
      } else if (user) {
        // Fallback: use whatever the auth context already has so the form is never blank.
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
        primaryCompanyId   = user.companyId ?? null;
        primaryHasLinkedin = !!(user.linkedinUrl);
        primaryHasSocial   = Object.keys(user.socialLinks ?? {}).length > 0;
        primaryHasTopics   = (user.interestedTopics ?? []).length > 0;
        setError("Couldn't load your latest profile. Showing cached data — you can still edit and save.");
      }

      // Form is ready — show it while lookups continue loading in the background.
      setLoading(false);

      // Fire lookups + audience enrichment concurrently so the form fills in as
      // fast as possible without blocking the initial render.
      const eventId = eventConfig?.eventId;
      const userId  = user?.id ? Number(user.id) : null;

      const partialErrors: string[] = [];
      Promise.allSettled([
        listIndustriesApi(),
        listTagsApi(),
        listCompaniesApi(500),
        // Audience attendee detail — richest source for company/social/topics.
        eventId && userId ? getMemberDetailApi(eventId, userId) : Promise.resolve(null),
        // /api/v1/me/profile may return social_links / interested_topics even
        // when /api/v1/me doesn't (different serialiser on some backends).
        getMeProfileApi(),
      ]).then(([industriesR, tagsR, companiesR, audienceR, meProfileR]) => {
        if (cancelled) return;
        if (industriesR.status === 'fulfilled' && industriesR.value.success && industriesR.value.data) {
          setIndustries(industriesR.value.data);
        } else partialErrors.push('industries');
        if (tagsR.status === 'fulfilled' && tagsR.value.success && tagsR.value.data) {
          setTopics(tagsR.value.data);
        } else partialErrors.push('topics');

        const loadedCompanies =
          companiesR.status === 'fulfilled' && companiesR.value.success && companiesR.value.data
            ? companiesR.value.data
            : null;
        if (loadedCompanies) {
          setCompanies(loadedCompanies);
        } else {
          partialErrors.push('companies');
        }

        // ── Enrich from /api/v1/me/profile if /me was incomplete ───────────
        if (meProfileR.status === 'fulfilled' && meProfileR.value?.success && meProfileR.value.data) {
          const mp = meProfileR.value.data;

          if (!primaryHasLinkedin && mp.linkedin_url) {
            setLinkedinUrl(mp.linkedin_url);
            primaryHasLinkedin = true;
          }

          if (!primaryHasSocial && mp.social_links) {
            const sl: Record<string, string> = {};
            for (const [k, v] of Object.entries(mp.social_links)) {
              if (k !== 'linkedin' && typeof v === 'string' && v) sl[k] = v;
            }
            if (Object.keys(sl).length) {
              setSocialLinks(sl);
              primaryHasSocial = true;
            }
            // Also promote linkedin from social_links if still missing
            if (!primaryHasLinkedin && typeof mp.social_links.linkedin === 'string' && mp.social_links.linkedin) {
              setLinkedinUrl(mp.social_links.linkedin as string);
              primaryHasLinkedin = true;
            }
          }

          if (!primaryHasTopics && mp.interested_topics?.length) {
            // These are strings — let the name-hint matcher resolve them to IDs
            setTopicNameHints(mp.interested_topics);
            primaryHasTopics = true;
          }
        }

        // ── Enrich from audience attendee profile (richest source) ──────────
        if (audienceR.status === 'fulfilled' && audienceR.value?.success && audienceR.value.data) {
          const aud = audienceR.value.data;

          // Company: backfill from audience if /me gave us no companyId
          if (primaryCompanyId === null && aud.company) {
            const companies = loadedCompanies ?? [];
            const match = companies.find(
              c => c.name.toLowerCase() === aud.company.toLowerCase(),
            );
            if (match) {
              setCompanyId(match.id);
              setCompanyQuery(match.name);
            } else {
              // No exact match — store as free-text; the companyNameHint effect
              // will resolve it when the companies list is available.
              setCompanyQuery(aud.company);
              setCompanyNameHint(aud.company);
            }
          }

          // LinkedIn
          if (!primaryHasLinkedin && aud.linkedinUrl) {
            setLinkedinUrl(aud.linkedinUrl);
            primaryHasLinkedin = true;
          }

          // Other social links
          if (!primaryHasSocial && Object.keys(aud.socialLinks ?? {}).length) {
            const sl: Record<string, string> = {};
            for (const [k, v] of Object.entries(aud.socialLinks ?? {})) {
              if (k !== 'linkedin' && v) sl[k] = v;
            }
            if (Object.keys(sl).length) setSocialLinks(sl);
          }

          // Interested topics (strings — name-hint matcher will resolve IDs)
          if (!primaryHasTopics && aud.interestedTopics?.length) {
            setTopicNameHints(aud.interestedTopics);
          }
        }

        if (partialErrors.length) {
          setError(prev =>
            prev
              ? prev
              : `Some dropdowns couldn't load (${partialErrors.join(', ')}). You can still edit and save.`
          );
        }
      });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After industries arrive: if we only have a name (no ID), find the matching entry.
  useEffect(() => {
    if (!industryNameHint || industryId !== null || !industries.length) return;
    const match = industries.find(i => i.name.toLowerCase() === industryNameHint.toLowerCase());
    if (match) setIndustryId(match.id);
  }, [industries, industryId, industryNameHint]);

  // After companies arrive: if we only have a name (no ID), find the matching entry.
  useEffect(() => {
    if (!companyNameHint || companyId !== null || !companies.length) return;
    const match = companies.find(c => c.name.toLowerCase() === companyNameHint.toLowerCase());
    if (match) { setCompanyId(match.id); setCompanyQuery(match.name); }
  }, [companies, companyId, companyNameHint]);

  // After tags arrive: match any string-only topics (id=0) by name.
  useEffect(() => {
    if (!topicNameHints.length || !topics.length) return;
    const matchedIds = topicNameHints
      .map(name => topics.find(t => t.name.toLowerCase() === name.toLowerCase()))
      .filter((t): t is Lookup => t !== undefined)
      .map(t => t.id);
    setTopicNameHints([]); // clear so this effect doesn't re-run
    if (matchedIds.length) {
      setTopicIds(prev => [...prev, ...matchedIds.filter(id => !prev.includes(id))]);
    }
  }, [topics, topicNameHints]);

  function applyProfile(p: UserProfile) {
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setEmail(p.email);
    setPhone(p.phone);
    setTitle(p.title);
    setBio(p.bio);
    setCompanyId(p.companyId ?? null);
    // Keep the company name as a hint so we can match it to the companies list
    // by name if the backend doesn't return a numeric companyId.
    if ((p.companyId ?? null) == null && p.company) setCompanyNameHint(p.company);
    setIndustryId(p.industryId ?? null);
    // Keep the industry name as a hint so we can match it to the lookup list by
    // name if the backend doesn't return a numeric industryId.
    setIndustryNameHint(p.industry ?? '');

    // If LinkedIn came in via social_links.linkedin instead of linkedin_url,
    // promote it so the dedicated field shows it correctly and it doesn't get
    // left behind in the generic social-links map.
    const rawSocial = { ...(p.socialLinks ?? {}) };
    const promotedLinkedIn = rawSocial.linkedin ?? '';
    delete rawSocial.linkedin;
    setLinkedinUrl(p.linkedinUrl || promotedLinkedIn);
    setSocialLinks(rawSocial);

    setAvatarUrl(p.avatar || p.profileImage || '');
    // Fix: filter(id => id > 0) instead of filter(Boolean) — 0 is falsy but valid
    // as a sentinel meaning "string-only topic"; we collect those names separately.
    const withIds = (p.interestedTopics ?? []).filter(t => t.id > 0);
    const nameOnly = (p.interestedTopics ?? []).filter(t => t.id <= 0).map(t => t.name);
    setTopicIds(withIds.map(t => t.id));
    setTopicNameHints(nameOnly); // will be matched once the tags list loads
    setCompanyQuery(p.company ?? '');
  }

  // Server-side company search — fires when the user types 2+ chars in the
  // company field. Runs alongside the immediate local filter so the dropdown
  // shows local matches right away and expands as server results arrive.
  useEffect(() => {
    if (!companyOpen) return;
    const q = companyQuery.trim();
    if (q.length < 2) { setCompanySearchResults([]); return; }
    if (companySearchTimer.current) clearTimeout(companySearchTimer.current);
    companySearchTimer.current = setTimeout(async () => {
      const res = await searchCompaniesApi(q, 30);
      if (res.success && res.data) setCompanySearchResults(res.data);
    }, 300);
    return () => { if (companySearchTimer.current) clearTimeout(companySearchTimer.current); };
  }, [companyQuery, companyOpen]);

  const filteredCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    const local = !q ? companies.slice(0, 50)
      : companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50);
    if (!companySearchResults.length) return local;
    // Merge: server results first, then local results not already included.
    const serverIds = new Set(companySearchResults.map(c => c.id));
    return [...companySearchResults, ...local.filter(c => !serverIds.has(c.id))].slice(0, 60);
  }, [companies, companyQuery, companySearchResults]);

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

    // Company: prefer the chosen typeahead id, but always send the
    // typed text too. The typeahead requires a click on a suggestion
    // to set `companyId`; without this fallback, free-text company
    // names entered by the user would silently never reach the
    // backend (the original bug behind "company isn't saving").
    const companyText = (companyId != null
      ? (companies.find(c => c.id === companyId)?.name ?? companyQuery)
      : companyQuery
    ).trim();

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
      // Send the visible name on both keys so whichever the backend
      // looks at (controllers in this codebase have used `company`
      // in /auth/register and `company_name` on the leads API) wins.
      company: companyText || undefined,
      company_name: companyText || undefined,
      industry_id: industryId,
      social_links: Object.keys(cleanedSocial).length ? cleanedSocial : undefined,
      // Send avatar on all three field names the backend may look at.
      avatar_url: avatarUrl || undefined,
      profile_image: avatarUrl || undefined,
      photo: avatarUrl || undefined,
      // Send topic IDs on all three aliases the backend may accept.
      interested_topic_ids: topicIds.length ? topicIds : undefined,
      topic_ids: topicIds.length ? topicIds : undefined,
      // Also send names for backward-compat with backends that store interests as strings.
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
      // The form state is the source of truth at save time — the
      // user just submitted exactly these values. We use those for
      // the local AppContext snapshot (so cleared fields stay
      // cleared instead of silently bouncing back to the old
      // value), and only adopt server-side updates that the form
      // doesn't carry (canonical id mappings, server-normalized
      // URLs, etc.). Avoids the "I cleared my company but it
      // re-appeared" trap that `||` fallbacks would create.
      const submittedFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const submittedFirst = firstName.trim();
      const submittedLast = lastName.trim();
      const submittedIndustry = industries.find(i => i.id === industryId)?.name ?? '';
      const submittedTopics = topicIds
        .map(id => topics.find(x => x.id === id))
        .filter((x): x is Lookup => x !== undefined)
        .map(x => ({ id: x.id, name: x.name, slug: x.slug }));

      setUser({
        ...user,
        name: submittedFullName || p.name || user.name,
        email: email.trim(),
        title: title.trim(),
        company: companyText,
        // Avatar is special: the user may not have changed it, so
        // we still want a server-fresh URL when available.
        avatar: p.avatar ?? p.profileImage ?? avatarUrl ?? user.avatar,
        interests: selectedTopicNames,
        firstName: submittedFirst,
        lastName: submittedLast,
        phone: phone.trim(),
        bio: bio.trim(),
        linkedinUrl: linkedinUrl.trim(),
        socialLinks: cleanedSocial,
        // Server-issued ids take precedence (they may have been
        // newly created from a free-text company name); otherwise
        // keep the id we already had.
        companyId: p.companyId ?? companyId,
        industry: submittedIndustry,
        industryId,
        profileImage: p.profileImage ?? avatarUrl ?? user.profileImage,
        interestedTopics: submittedTopics,
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
