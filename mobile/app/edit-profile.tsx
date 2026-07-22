import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';
import { request } from '@/lib/apiClient';
import { listAllCompanies } from '@/lib/api/companies';
import type { CompanyLookup } from '@/lib/api/companies';
import {
  listIndustriesApi,
  listTagsApi,
  getMyProfileApi,
} from '@/lib/api/lookups';
import type { LookupItem } from '@/lib/api/lookups';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuth();

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const [company, setCompany] = useState('');
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [industryId, setIndustryId] = useState<number | null>(null);
  const [topicIds, setTopicIds] = useState<number[]>([]);

  const [companies, setCompanies] = useState<CompanyLookup[]>([]);
  const [industries, setIndustries] = useState<LookupItem[]>([]);
  const [topics, setTopics] = useState<LookupItem[]>([]);

  const [companyOpen, setCompanyOpen] = useState(false);
  const [industryOpen, setIndustryOpen] = useState(false);

  const filteredCompanies = useMemo(
    () => company.trim()
      ? companies.filter(c => c.name.toLowerCase().includes(company.toLowerCase())).slice(0, 10)
      : companies.slice(0, 10),
    [companies, company],
  );

  const selectedIndustryName = useMemo(
    () => industries.find(i => i.id === industryId)?.name ?? '',
    [industries, industryId],
  );

  const toggleTopic = useCallback((id: number) => {
    setTopicIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  useEffect(() => {
    setProfileLoading(true);

    Promise.allSettled([
      getMyProfileApi(),
      listAllCompanies(),
      listIndustriesApi(),
      listTagsApi(),
    ]).then(([profileR, companiesR, industriesR, tagsR]) => {
      if (companiesR.status === 'fulfilled' && companiesR.value.success && companiesR.value.data) {
        setCompanies(companiesR.value.data);
      }
      if (industriesR.status === 'fulfilled' && industriesR.value.success && industriesR.value.data) {
        setIndustries(industriesR.value.data);
      }
      if (tagsR.status === 'fulfilled' && tagsR.value.success && tagsR.value.data) {
        setTopics(tagsR.value.data);
      }

      const profile = profileR.status === 'fulfilled' && profileR.value.success
        ? profileR.value.data
        : null;

      if (profile) {
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setPhone(profile.phone);
        setTitle(profile.title);
        setBio(profile.bio);
        setLinkedinUrl(profile.linkedinUrl);
        setCompany(profile.company);
        setCompanyId(profile.companyId);
        setIndustryId(profile.industryId);
        setTopicIds(profile.interestedTopics.map(t => t.id).filter(Boolean));
      } else if (user) {
        const nameParts = (user.name ?? '').trim().split(/\s+/);
        setFirstName(nameParts[0] ?? '');
        setLastName(nameParts.slice(1).join(' '));
        setPhone(user.phone ?? '');
        setTitle(user.title ?? '');
        setCompany(user.company ?? '');
      }

      setProfileLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const selectedTopicNames = topicIds
        .map(id => topics.find(t => t.id === id)?.name)
        .filter((n): n is string => Boolean(n));

      const companyText = (companyId != null
        ? (companies.find(c => c.id === companyId)?.name ?? company)
        : company
      ).trim();

      const body: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        title: title.trim(),
        bio: bio.trim(),
        phone: phone.trim(),
        linkedin_url: linkedinUrl.trim(),
        company: companyText || undefined,
        company_name: companyText || undefined,
        company_id: companyId ?? undefined,
        industry_id: industryId ?? undefined,
        interested_topic_ids: topicIds.length ? topicIds : undefined,
        interests: selectedTopicNames.length ? selectedTopicNames : undefined,
      };

      const res = await request<any>('/api/v1/me/profile', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.success) {
        setError(res.error?.message ?? 'Failed to save profile.');
        return;
      }

      if (user && setUser) {
        setUser({
          ...user,
          name: `${firstName.trim()} ${lastName.trim()}`.trim(),
          title: title.trim(),
          company: companyText,
          phone: phone.trim(),
          interests: selectedTopicNames,
        });
      }

      Alert.alert('Profile Updated', 'Your profile has been saved successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={[styles.backBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* Avatar */}
      <LinearGradient colors={['#1a0d2e', '#0d1a2e']} style={styles.avatarCard}>
        <View style={[styles.avatarRing, { borderColor: colors.primary }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(firstName[0] ?? user?.name?.[0] ?? '?').toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.avatarHint}>Tap Save to update your profile</Text>
      </LinearGradient>

      {/* Error */}
      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={14} color="#f87171" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ── PERSONAL INFO ─────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>PERSONAL INFO</Text>
      <View style={styles.card}>
        <View style={styles.fieldRow}>
          <Ionicons name="person-outline" size={16} color={colors.textMuted} style={styles.fieldIcon} />
          <View style={styles.fieldInner}>
            <Text style={styles.fieldLabel}>First name</Text>
            <TextInput style={styles.fieldInput} value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
          </View>
        </View>
        <View style={styles.divider} />

        <View style={styles.fieldRow}>
          <Ionicons name="person-outline" size={16} color="transparent" style={styles.fieldIcon} />
          <View style={styles.fieldInner}>
            <Text style={styles.fieldLabel}>Last name</Text>
            <TextInput style={styles.fieldInput} value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
          </View>
        </View>
        <View style={styles.divider} />

        <View style={styles.fieldRow}>
          <Ionicons name="call-outline" size={16} color={colors.textMuted} style={styles.fieldIcon} />
          <View style={styles.fieldInner}>
            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput style={styles.fieldInput} value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
          </View>
        </View>
        <View style={styles.divider} />

        <View style={styles.fieldRow}>
          <Ionicons name="link-outline" size={16} color={colors.textMuted} style={styles.fieldIcon} />
          <View style={styles.fieldInner}>
            <Text style={styles.fieldLabel}>LinkedIn URL</Text>
            <TextInput style={styles.fieldInput} value={linkedinUrl} onChangeText={setLinkedinUrl} placeholder="https://linkedin.com/in/you" placeholderTextColor={colors.textMuted} autoCapitalize="none" keyboardType="url" />
          </View>
        </View>
        <View style={styles.divider} />

        <View style={styles.fieldRow}>
          <Ionicons name="document-text-outline" size={16} color={colors.textMuted} style={styles.fieldIcon} />
          <View style={styles.fieldInner}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput style={[styles.fieldInput, { minHeight: 60 }]} value={bio} onChangeText={setBio} placeholder="Tell others about yourself" placeholderTextColor={colors.textMuted} multiline autoCapitalize="sentences" />
          </View>
        </View>
      </View>

      {/* ── WORK ──────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>WORK</Text>
      <View style={styles.card}>
        {/* Job title */}
        <View style={styles.fieldRow}>
          <Ionicons name="briefcase-outline" size={16} color={colors.textMuted} style={styles.fieldIcon} />
          <View style={styles.fieldInner}>
            <Text style={styles.fieldLabel}>Job title</Text>
            <TextInput style={styles.fieldInput} value={title} onChangeText={setTitle} placeholder="Your job title" placeholderTextColor={colors.textMuted} autoCapitalize="words" />
          </View>
        </View>
        <View style={styles.divider} />

        {/* Company autocomplete */}
        <View style={[styles.fieldRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Ionicons name="business-outline" size={16} color={colors.textMuted} style={styles.fieldIcon} />
            <View style={[styles.fieldInner, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Company</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1 }]}
                  value={company}
                  onChangeText={v => { setCompany(v); setCompanyId(null); setCompanyOpen(true); setIndustryOpen(false); }}
                  onFocus={() => { setCompanyOpen(true); setIndustryOpen(false); }}
                  placeholder="Search or type company"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
                {companyId != null && (
                  <TouchableOpacity onPress={() => { setCompany(''); setCompanyId(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 8 }}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          {companyOpen && filteredCompanies.length > 0 && (
            <View style={[styles.suggestionsBox, { marginLeft: 32, marginTop: 4 }]}>
              {filteredCompanies.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setCompany(c.name); setCompanyId(c.id); setCompanyOpen(false); Keyboard.dismiss(); }}
                  style={[styles.suggestionRow, i < filteredCompanies.length - 1 && styles.suggestionBorder]}
                >
                  <Ionicons name="business" size={13} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={styles.suggestionText}>{c.name}</Text>
                  {companyId === c.id && <Ionicons name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={styles.divider} />

        {/* Industry picker */}
        <View style={[styles.fieldRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'flex-start' }}
            onPress={() => { setIndustryOpen(v => !v); setCompanyOpen(false); Keyboard.dismiss(); }}
          >
            <Ionicons name="layers-outline" size={16} color={colors.textMuted} style={styles.fieldIcon} />
            <View style={[styles.fieldInner, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Industry</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.fieldInput, { flex: 1, color: industryId ? colors.textPrimary : colors.textMuted }]}>
                  {selectedIndustryName || 'Select industry…'}
                </Text>
                <Ionicons
                  name={industryOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textMuted}
                />
              </View>
            </View>
          </TouchableOpacity>
          {industryOpen && industries.length > 0 && (
            <View style={[styles.suggestionsBox, { marginLeft: 32, marginTop: 4 }]}>
              <TouchableOpacity
                onPress={() => { setIndustryId(null); setIndustryOpen(false); }}
                style={[styles.suggestionRow, styles.suggestionBorder]}
              >
                <Text style={[styles.suggestionText, { color: colors.textMuted }]}>— None —</Text>
              </TouchableOpacity>
              {industries.map((ind, i) => (
                <TouchableOpacity
                  key={ind.id}
                  onPress={() => { setIndustryId(ind.id); setIndustryOpen(false); }}
                  style={[styles.suggestionRow, i < industries.length - 1 && styles.suggestionBorder]}
                >
                  <Text style={styles.suggestionText}>{ind.name}</Text>
                  {industryId === ind.id && <Ionicons name="checkmark" size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* ── INTERESTED TOPICS ─────────────────────────────────────────── */}
      {topics.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>INTERESTED TOPICS</Text>
          <View style={[styles.card, { padding: spacing.lg }]}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.md }}>
              Pick topics for better recommendations and connections.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {topics.map(topic => {
                const selected = topicIds.includes(topic.id);
                return (
                  <TouchableOpacity
                    key={topic.id}
                    onPress={() => toggleTopic(topic.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 100,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? 'rgba(124,58,237,0.2)' : 'transparent',
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                      size={13}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                    <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: selected ? '700' : '400' }}>
                      {topic.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </>
      )}

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <>
              <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </>
        }
      </TouchableOpacity>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 60 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  saveText: { color: colors.primary, fontSize: 15, fontWeight: '700' },

  avatarCard: { borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  avatarRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  avatarHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', marginBottom: spacing.md },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },

  sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },

  card: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  fieldIcon: { marginTop: 2, marginRight: spacing.md },
  fieldInner: { flex: 1 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput: { color: colors.textPrimary, fontSize: 15, paddingVertical: 0 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  suggestionsBox: { borderRadius: radius.md, backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', overflow: 'hidden', maxHeight: 220 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 10 },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  suggestionText: { color: colors.textPrimary, fontSize: 13, flex: 1 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 54, borderRadius: radius.xl, backgroundColor: colors.primary, marginTop: spacing.xl } as any,
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
