import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import {
  fetchFullProfile, updateProfileFull, listIndustries, listTopics,
  listCompanies, searchCompanies,
  type Lookup, type FullProfile, type ProfileUpdatePayload,
} from '@/lib/api/users';
import { colors, spacing, radius } from '@/constants/theme';

const SOCIAL_KEYS = [
  { key: 'twitter',  label: 'Twitter / X',  icon: 'logo-twitter',  placeholder: 'https://twitter.com/yourhandle' },
  { key: 'github',   label: 'GitHub',        icon: 'logo-github',   placeholder: 'https://github.com/yourhandle' },
  { key: 'website',  label: 'Website',       icon: 'globe-outline', placeholder: 'https://your-site.com' },
] as const;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();

  // ── Form state ────────────────────────────────────────────────────────────
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [title, setTitle]           = useState('');
  const [bio, setBio]               = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyId, setCompanyId]   = useState<number | null>(null);
  const [industryId, setIndustryId] = useState<number | null>(null);
  const [topicIds, setTopicIds]     = useState<number[]>([]);

  // ── Lookup data ───────────────────────────────────────────────────────────
  const [industries, setIndustries]       = useState<Lookup[]>([]);
  const [topics, setTopics]               = useState<Lookup[]>([]);
  const [companies, setCompanies]         = useState<Lookup[]>([]);
  const [searchResults, setSearchResults] = useState<Lookup[]>([]);
  const [companyNameHint, setCompanyNameHint] = useState('');
  const [topicNameHints, setTopicNameHints]   = useState<string[]>([]);
  const [industryNameHint, setIndustryNameHint] = useState('');

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [companyDropOpen, setCompanyDropOpen] = useState(false);
  const [industryDropOpen, setIndustryDropOpen] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Seed form from context immediately (no blank flash) ──────────────────
  useEffect(() => {
    if (user) {
      const nameParts = user.name?.split(' ') ?? [];
      setFirstName(nameParts[0] ?? '');
      setLastName(nameParts.slice(1).join(' '));
      setEmail(user.email ?? '');
      setPhone(user.phone ?? '');
      setTitle(user.title ?? '');
      setCompanyQuery(user.company ?? '');
    }
  }, []);

  // ── Load full profile + lookups concurrently ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchFullProfile(),
      listIndustries(),
      listTopics(),
      listCompanies(500),
    ]).then(([profileR, industriesR, topicsR, companiesR]) => {
      if (cancelled) return;

      if (profileR.status === 'fulfilled' && profileR.value.success && profileR.value.data) {
        applyProfile(profileR.value.data);
      }

      const loadedCompanies =
        companiesR.status === 'fulfilled' && companiesR.value.success
          ? companiesR.value.data ?? []
          : [];
      const loadedIndustries =
        industriesR.status === 'fulfilled' && industriesR.value.success
          ? industriesR.value.data ?? []
          : [];
      const loadedTopics =
        topicsR.status === 'fulfilled' && topicsR.value.success
          ? topicsR.value.data ?? []
          : [];

      setCompanies(loadedCompanies);
      setIndustries(loadedIndustries);
      setTopics(loadedTopics);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  function applyProfile(p: FullProfile) {
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setEmail(p.email);
    setPhone(p.phone);
    setTitle(p.title);
    setBio(p.bio);

    setCompanyId(p.companyId ?? null);
    setCompanyQuery(p.company ?? '');
    if (!p.companyId && p.company) setCompanyNameHint(p.company);

    setIndustryId(p.industryId ?? null);
    if (!p.industryId && p.industry) setIndustryNameHint(p.industry);

    // Promote linkedin from social_links if not in linkedin_url
    const rawSocial = { ...(p.socialLinks ?? {}) };
    const promotedLinkedIn = (rawSocial.linkedin as string | undefined) ?? '';
    delete rawSocial.linkedin;
    setLinkedinUrl(p.linkedinUrl || promotedLinkedIn);
    setSocialLinks(rawSocial);

    const withIds = (p.interestedTopics ?? []).filter(t => t.id > 0);
    const nameOnly = (p.interestedTopics ?? []).filter(t => t.id <= 0).map(t => t.name);
    setTopicIds(withIds.map(t => t.id));
    setTopicNameHints(nameOnly);
  }

  // Auto-match industry by name once list arrives
  useEffect(() => {
    if (!industryNameHint || industryId !== null || !industries.length) return;
    const m = industries.find(i => i.name.toLowerCase() === industryNameHint.toLowerCase());
    if (m) setIndustryId(m.id);
  }, [industries, industryNameHint]);

  // Auto-match company by name once list arrives
  useEffect(() => {
    if (!companyNameHint || companyId !== null || !companies.length) return;
    const m = companies.find(c => c.name.toLowerCase() === companyNameHint.toLowerCase());
    if (m) { setCompanyId(m.id); setCompanyQuery(m.name); }
  }, [companies, companyNameHint]);

  // Match string-only topics by name once topic list arrives
  useEffect(() => {
    if (!topicNameHints.length || !topics.length) return;
    const matched = topicNameHints
      .map(n => topics.find(t => t.name.toLowerCase() === n.toLowerCase()))
      .filter((t): t is Lookup => t !== undefined)
      .map(t => t.id);
    setTopicNameHints([]);
    if (matched.length) setTopicIds(prev => [...prev, ...matched.filter(id => !prev.includes(id))]);
  }, [topics, topicNameHints]);

  // ── Server-side company search ────────────────────────────────────────────
  const triggerCompanySearch = useCallback((q: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await searchCompanies(q.trim(), 30);
      if (res.success && res.data) setSearchResults(res.data);
    }, 300);
  }, []);

  const displayedCompanies = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    const local = !q ? companies.slice(0, 50)
      : companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 50);
    if (!searchResults.length) return local;
    const serverIds = new Set(searchResults.map(c => c.id));
    return [...searchResults, ...local.filter(c => !serverIds.has(c.id))].slice(0, 60);
  }, [companies, companyQuery, searchResults]);

  const selectedCompanyName = useMemo(() => {
    if (companyId == null) return '';
    return companies.find(c => c.id === companyId)?.name ?? companyQuery;
  }, [companies, companyId, companyQuery]);

  const selectedIndustryName = useMemo(
    () => industries.find(i => i.id === industryId)?.name ?? '',
    [industries, industryId],
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const companyText = (companyId != null
      ? (companies.find(c => c.id === companyId)?.name ?? companyQuery)
      : companyQuery
    ).trim();

    const cleanSocial: Record<string, string> = {};
    for (const [k, v] of Object.entries(socialLinks)) if (v?.trim()) cleanSocial[k] = v.trim();

    const selectedTopicNames = topicIds
      .map(id => topics.find(t => t.id === id)?.name)
      .filter((n): n is string => Boolean(n));

    const payload: ProfileUpdatePayload = {
      first_name: firstName.trim() || undefined,
      last_name:  lastName.trim()  || undefined,
      name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
      email:    email.trim()    || undefined,
      phone:    phone.trim()    || undefined,
      title:    title.trim()    || undefined,
      bio:      bio.trim()      || undefined,
      linkedin_url:  linkedinUrl.trim() || undefined,
      company_id:    companyId,
      company:       companyText || undefined,
      company_name:  companyText || undefined,
      industry_id:   industryId,
      social_links:  Object.keys(cleanSocial).length ? cleanSocial : undefined,
      interested_topic_ids: topicIds.length ? topicIds : undefined,
      topic_ids:     topicIds.length ? topicIds : undefined,
      interests:     selectedTopicNames.length ? selectedTopicNames : undefined,
    };

    const res = await updateProfileFull(payload);
    setSaving(false);

    if (!res.success) {
      setError(res.error?.message ?? 'Could not save your profile. Please try again.');
      return;
    }

    // Update auth context with the newly saved basic fields
    if (user) {
      setUser({
        ...user,
        name:    `${firstName.trim()} ${lastName.trim()}`.trim() || user.name,
        email:   email.trim()  || user.email,
        phone:   phone.trim()  || user.phone,
        title:   title.trim()  || user.title,
        company: companyText   || user.company,
        interests: selectedTopicNames,
      });
    }

    router.back();
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Personal Info ─────────────────────────────────────────────── */}
        <Section title="Personal Information" icon="person-outline">
          <Row>
            <FieldBox label="First Name" style={{ flex: 1, marginRight: spacing.sm }}>
              <StyledInput value={firstName} onChangeText={setFirstName} placeholder="First name" />
            </FieldBox>
            <FieldBox label="Last Name" style={{ flex: 1 }}>
              <StyledInput value={lastName} onChangeText={setLastName} placeholder="Last name" />
            </FieldBox>
          </Row>
          <FieldBox label="Email" icon="mail-outline">
            <StyledInput value={email} onChangeText={setEmail} placeholder="your@email.com"
              keyboardType="email-address" autoCapitalize="none" />
          </FieldBox>
          <FieldBox label="Phone" icon="call-outline">
            <StyledInput value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000"
              keyboardType="phone-pad" />
          </FieldBox>
          <FieldBox label="Job Title" icon="briefcase-outline">
            <StyledInput value={title} onChangeText={setTitle} placeholder="e.g. Chief Information Officer" />
          </FieldBox>
          <FieldBox label="Bio">
            <StyledInput value={bio} onChangeText={setBio}
              placeholder="Tell others a bit about yourself"
              multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} />
          </FieldBox>
        </Section>

        {/* ── Company & Industry ────────────────────────────────────────── */}
        <Section title="Company & Industry" icon="business-outline">
          {/* Company typeahead */}
          <FieldBox label="Company">
            <TouchableOpacity
              style={styles.dropTrigger}
              activeOpacity={0.8}
              onPress={() => { setCompanyDropOpen(true); triggerCompanySearch(companyQuery); }}
            >
              <Text style={[styles.dropTriggerText, !selectedCompanyName && styles.placeholder]}>
                {selectedCompanyName || 'Search for your company'}
              </Text>
              {companyId != null
                ? <TouchableOpacity onPress={() => { setCompanyId(null); setCompanyQuery(''); }}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                : <Ionicons name="search-outline" size={16} color={colors.textMuted} />}
            </TouchableOpacity>
          </FieldBox>

          {/* Industry dropdown */}
          <FieldBox label="Industry">
            <TouchableOpacity
              style={styles.dropTrigger}
              activeOpacity={0.8}
              onPress={() => setIndustryDropOpen(true)}
            >
              <Text style={[styles.dropTriggerText, !selectedIndustryName && styles.placeholder]}>
                {selectedIndustryName || 'Select an industry…'}
              </Text>
              <Ionicons name="chevron-down-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </FieldBox>
        </Section>

        {/* ── Social Links ──────────────────────────────────────────────── */}
        <Section title="Social Links" icon="share-social-outline">
          <FieldBox label="LinkedIn URL" icon="logo-linkedin">
            <StyledInput
              value={linkedinUrl}
              onChangeText={setLinkedinUrl}
              placeholder="https://linkedin.com/in/yourname"
              keyboardType="url"
              autoCapitalize="none"
            />
          </FieldBox>
          {SOCIAL_KEYS.map(({ key, label, icon, placeholder }) => (
            <FieldBox key={key} label={label} icon={icon as any}>
              <StyledInput
                value={socialLinks[key] ?? ''}
                onChangeText={v => setSocialLinks(prev => {
                  const n = { ...prev };
                  if (v.trim()) n[key] = v; else delete n[key];
                  return n;
                })}
                placeholder={placeholder}
                keyboardType="url"
                autoCapitalize="none"
              />
            </FieldBox>
          ))}
        </Section>

        {/* ── Interested Topics ─────────────────────────────────────────── */}
        <Section title="Interested Topics" icon="pricetag-outline">
          <Text style={styles.sectionHint}>
            Pick the topics you'd like recommendations and matches around.
          </Text>
          {topics.length === 0
            ? <Text style={styles.emptyText}>Topics loading…</Text>
            : (
              <View style={styles.chipGrid}>
                {topics.map(topic => {
                  const selected = topicIds.includes(topic.id);
                  return (
                    <TouchableOpacity
                      key={topic.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setTopicIds(prev =>
                        prev.includes(topic.id)
                          ? prev.filter(x => x !== topic.id)
                          : [...prev, topic.id]
                      )}
                      activeOpacity={0.75}
                    >
                      {selected && <Ionicons name="checkmark" size={12} color="#fff" style={{ marginRight: 4 }} />}
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {topic.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
        </Section>
      </ScrollView>

      {/* ── Sticky bottom bar ────────────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={saving}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.65 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="checkmark-outline" size={18} color="#fff" />}
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Company picker modal ──────────────────────────────────────────── */}
      <Modal
        visible={companyDropOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCompanyDropOpen(false)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top || spacing.xl }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Company</Text>
            <TouchableOpacity onPress={() => setCompanyDropOpen(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearchRow}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
            <TextInput
              style={styles.modalSearchInput}
              value={companyQuery}
              onChangeText={v => { setCompanyQuery(v); setCompanyId(null); triggerCompanySearch(v); }}
              placeholder="Search for your company…"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            {companyQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setCompanyQuery(''); setCompanyId(null); setSearchResults([]); }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={displayedCompanies}
            keyExtractor={item => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => { setCompanyId(item.id); setCompanyQuery(item.name); setCompanyDropOpen(false); setSearchResults([]); }}
              >
                <Text style={styles.listRowText}>{item.name}</Text>
                {companyId === item.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>
                  {companyQuery.length >= 2 ? 'No companies found — try a different name.' : 'Start typing to search…'}
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>

      {/* ── Industry picker modal ─────────────────────────────────────────── */}
      <Modal
        visible={industryDropOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIndustryDropOpen(false)}
      >
        <View style={[styles.modalRoot, { paddingTop: insets.top || spacing.xl }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Industry</Text>
            <TouchableOpacity onPress={() => setIndustryDropOpen(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={industries}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => { setIndustryId(item.id); setIndustryDropOpen(false); }}
              >
                <Text style={styles.listRowText}>{item.name}</Text>
                {industryId === item.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<View style={styles.center}><Text style={styles.emptyText}>No industries loaded.</Text></View>}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function FieldBox({ label, icon, style, children }: {
  label: string; icon?: string; style?: object; children: React.ReactNode;
}) {
  return (
    <View style={[styles.fieldBox, style]}>
      <View style={styles.fieldLabelRow}>
        {icon && <Ionicons name={icon as any} size={11} color={colors.textMuted} style={{ marginRight: 4 }} />}
        <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row' }}>{children}</View>;
}

function StyledInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bg },
  center:  { alignItems: 'center', justifyContent: 'center', flex: 1 },
  loadingText: { color: colors.textMuted, marginTop: spacing.md, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  scroll: { padding: spacing.xl },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg,
  },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },

  section: {
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle:  { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  sectionHint:   { color: colors.textMuted,   fontSize: 12, marginBottom: spacing.md },

  fieldBox:      { marginBottom: spacing.md },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  fieldLabel: {
    color: colors.textMuted, fontSize: 10, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: 14,
  },

  dropTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 3,
  },
  dropTriggerText: { color: colors.textPrimary, fontSize: 14, flex: 1 },
  placeholder:     { color: colors.textMuted },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:     { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },

  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', padding: spacing.lg },

  bottomBar: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Modal ──
  modalRoot:   { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  modalSearchRow: {
    flexDirection: 'row', alignItems: 'center',
    margin: spacing.xl, marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  modalSearchInput: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listRowText: { color: colors.textPrimary, fontSize: 15, flex: 1 },
});
