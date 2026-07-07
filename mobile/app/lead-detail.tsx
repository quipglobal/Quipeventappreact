import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useLeads, useUpdateLead } from '@/hooks/useLeads';
import { colors, spacing, radius } from '@/constants/theme';
import type { Lead } from '@/lib/api/types';

type Priority = 'hot' | 'warm' | 'cold';

const PRIORITY_CONFIG: Record<
  Priority,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  hot: { label: 'Hot', icon: 'flame', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  warm: { label: 'Warm', icon: 'sunny', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  cold: { label: 'Cold', icon: 'snow', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

const QUICK_TAGS = [
  'Follow Up',
  'Demo Requested',
  'Send Pricing',
  'Decision Maker',
  'Technical Lead',
  'Budget Holder',
  'Interested in Enterprise',
  'Referral',
];

function priorityOf(lead: Lead): Priority {
  const p = lead.priority ?? lead.status;
  return p === 'hot' || p === 'warm' || p === 'cold' ? p : 'warm';
}

export default function LeadDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useAuth();
  const { data: leads = [] } = useLeads();
  const updateLead = useUpdateLead();

  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id]);

  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(lead?.notes ?? '');
  const [editTags, setEditTags] = useState<string[]>(lead?.tags ?? []);
  const [editPriority, setEditPriority] = useState<Priority>(lead ? priorityOf(lead) : 'warm');

  if (!lead) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.notFoundHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Ionicons name="person-outline" size={48} color={colors.textMuted} />
          <Text style={styles.notFoundText}>Lead not found</Text>
        </View>
      </View>
    );
  }

  const pc = PRIORITY_CONFIG[priorityOf(lead)];

  const startEdit = () => {
    setEditNotes(lead.notes ?? '');
    setEditTags(lead.tags ?? []);
    setEditPriority(priorityOf(lead));
    setIsEditing(true);
  };

  const handleSave = () => {
    updateLead.mutate({
      leadId: lead.id,
      updates: { notes: editNotes, tags: editTags, priority: editPriority },
      code: lead.code ?? null,
    });
    setIsEditing(false);
    showToast?.('Lead updated');
  };

  const toggleTag = (tag: string) => {
    setEditTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#1e1b4b', '#312e81', '#4338ca']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + spacing.md }]}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.75)" />
            <Text style={styles.backText}>All Leads</Text>
          </TouchableOpacity>

          <View style={styles.headerMain}>
            <View style={[styles.avatar, { backgroundColor: (lead.color ?? colors.primary) + '33', borderColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={styles.avatarText}>{lead.name?.[0] ?? '?'}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name} numberOfLines={2}>{lead.name}</Text>
              {!!lead.title && <Text style={styles.title} numberOfLines={1}>{lead.title}</Text>}
              {!!lead.company && (
                <View style={styles.companyRow}>
                  <Ionicons name="business-outline" size={11} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.company} numberOfLines={1}>{lead.company}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: pc.bg }]}>
              <Ionicons name={pc.icon} size={12} color={pc.color} />
              <Text style={[styles.metaChipText, { color: pc.color }]}>{pc.label} Lead</Text>
            </View>
            {!!lead.code && (
              <View style={styles.metaChip}>
                <Ionicons name="scan-outline" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.metaChipTextMuted}>{lead.code}</Text>
              </View>
            )}
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={styles.metaChipTextMuted}>{lead.scannedAt}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Actions */}
        <View style={styles.actionsCard}>
          <TouchableOpacity
            onPress={() => (isEditing ? handleSave() : startEdit())}
            activeOpacity={0.85}
            style={styles.actionMain}
          >
            {isEditing ? (
              <View style={styles.saveInner}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.actionMainText}>Save Changes</Text>
              </View>
            ) : (
              <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.saveInner}>
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.actionMainText}>Edit Lead</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
          {isEditing && (
            <TouchableOpacity onPress={() => setIsEditing(false)} activeOpacity={0.8} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conversation Notes</Text>
          {isEditing ? (
            <TextInput
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              placeholder="Add notes about your conversation…"
              placeholderTextColor={colors.textMuted}
              style={styles.notesInput}
            />
          ) : (
            <View style={styles.notesBox}>
              {lead.notes ? (
                <Text style={styles.notesText}>{lead.notes}</Text>
              ) : (
                <Text style={styles.notesEmpty}>No notes captured yet. Tap "Edit Lead" to add notes.</Text>
              )}
            </View>
          )}
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          {isEditing ? (
            <View style={styles.tagsWrap}>
              {QUICK_TAGS.map((tag) => {
                const active = editTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.8}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                      {active ? '✓ ' : ''}{tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.tagsWrap}>
              {lead.tags && lead.tags.length > 0 ? (
                lead.tags.map((tag) => (
                  <View key={tag} style={styles.tagChipStatic}>
                    <Ionicons name="pricetag-outline" size={11} color={colors.primaryLight} />
                    <Text style={styles.tagChipStaticText}>{tag}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.notesEmpty}>No tags added</Text>
              )}
            </View>
          )}
        </View>

        {/* Priority (edit only) */}
        {isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Priority</Text>
            <View style={styles.priorityRow}>
              {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((key) => {
                const cfg = PRIORITY_CONFIG[key];
                const active = editPriority === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setEditPriority(key)}
                    activeOpacity={0.8}
                    style={[
                      styles.priorityBtn,
                      { borderColor: active ? cfg.color : colors.border, backgroundColor: active ? cfg.bg : 'rgba(255,255,255,0.04)' },
                    ]}
                  >
                    <Ionicons name={cfg.icon} size={15} color={active ? cfg.color : colors.textMuted} />
                    <Text style={[styles.priorityText, { color: active ? cfg.color : colors.textSecondary }]}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Scan details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scan Details</Text>
          <View style={styles.detailsCard}>
            {!!lead.code && (
              <View style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: 'rgba(124,58,237,0.14)' }]}>
                  <Ionicons name="scan-outline" size={15} color={colors.primary} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Badge Code</Text>
                  <Text style={styles.detailValue}>{lead.code}</Text>
                </View>
              </View>
            )}
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <View style={[styles.detailIcon, { backgroundColor: 'rgba(16,185,129,0.14)' }]}>
                <Ionicons name="time-outline" size={15} color={colors.success} />
              </View>
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Scanned at</Text>
                <Text style={styles.detailValue}>{lead.scannedAt}</Text>
              </View>
            </View>
            {!!lead.email && (
              <View style={[styles.detailRow, styles.detailRowLast]}>
                <View style={[styles.detailIcon, { backgroundColor: 'rgba(79,70,229,0.14)' }]}>
                  <Ionicons name="mail-outline" size={15} color={colors.secondary} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{lead.email}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {lead.pendingSync && (
          <View style={styles.pendingBar}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
            <Text style={styles.pendingText}>Saved on this device — not yet synced to the server.</Text>
          </View>
        )}
      </ScrollView>

      {updateLead.isPending && (
        <View style={styles.savingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  notFoundHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  notFoundText: { color: colors.textSecondary, fontSize: 15 },

  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  backText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },
  headerMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerInfo: { flex: 1, paddingTop: 2 },
  name: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  title: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 3 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  company: { color: 'rgba(255,255,255,0.5)', fontSize: 12, flex: 1 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  metaChipText: { fontSize: 12, fontWeight: '700' },
  metaChipTextMuted: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },

  actionsCard: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: -spacing.md },
  actionMain: { flex: 1, borderRadius: radius.md, overflow: 'hidden' },
  saveInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, backgroundColor: colors.success },
  actionMainText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, backgroundColor: colors.bgCard },
  cancelText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  section: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: spacing.md },
  notesInput: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderMid, color: colors.textPrimary, fontSize: 13, lineHeight: 20, padding: spacing.md, minHeight: 120, textAlignVertical: 'top' },
  notesBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md },
  notesText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  notesEmpty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  tagChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(124,58,237,0.15)' },
  tagChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tagChipTextActive: { color: colors.primaryLight, fontWeight: '700' },
  tagChipStatic: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', backgroundColor: 'rgba(124,58,237,0.12)' },
  tagChipStaticText: { color: colors.primaryLight, fontSize: 12, fontWeight: '600' },

  priorityRow: { flexDirection: 'row', gap: spacing.sm },
  priorityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5 },
  priorityText: { fontSize: 13, fontWeight: '700' },

  detailsCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  detailRowLast: { borderBottomWidth: 0 },
  detailIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  detailInfo: { flex: 1 },
  detailLabel: { color: colors.textMuted, fontSize: 11 },
  detailValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 2 },

  pendingBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.xl, marginTop: spacing.xl, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: radius.md, padding: spacing.md },
  pendingText: { flex: 1, color: colors.warning, fontSize: 12 },

  savingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
});
