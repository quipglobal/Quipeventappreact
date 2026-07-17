import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import {
  listSponsorReviews,
  submitSponsorReview,
} from '@/lib/api/sponsorReviews';
import {
  loadSponsorReviews,
  saveSponsorReviews,
  type SponsorReview,
} from '@/lib/sponsorReviewsStorage';
import { colors, spacing, radius } from '@/constants/theme';

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function StarRating({
  value,
  onChange,
  size = 22,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <TouchableOpacity
            key={n}
            disabled={readOnly}
            onPress={() => !readOnly && onChange?.(n)}
            activeOpacity={readOnly ? 1 : 0.6}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={size}
              color={filled ? '#f59e0b' : colors.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Attendee-only sponsor review form + list. Mirrors the web
 * `SponsorReviewsSection` behavior:
 *   - optimistic submit with AsyncStorage overlay (survives reload/logout)
 *   - POST attempted every submit; NOT_IMPLEMENTED short-circuit is silent
 *   - sponsor reps don't see this section (can't review their own company)
 *   - write form is locked once the event's endDate has passed
 */
export function SponsorReviews({
  companyId,
  companyName,
  eventEndDate,
}: {
  companyId: string;
  companyName: string;
  /** ISO 8601 date string (e.g. "2026-07-18") for the event's last day.
   *  When provided and in the past, the write/edit form is locked. */
  eventEndDate?: string;
}) {
  const { user, showToast } = useAuth();
  const { currentEventId } = useEvent();

  // Lock write/edit once the event has concluded.
  const isEventPast = eventEndDate
    ? new Date(eventEndDate) < new Date(new Date().toDateString())
    : false;

  const [reviews, setReviews] = useState<SponsorReview[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const myEmail = user?.email?.toLowerCase() ?? '';
  const isSponsorRep = user?.role === 'sponsor';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const cached = await loadSponsorReviews(currentEventId, companyId);
      if (cancelled) return;
      setReviews(cached);
      const mineCached = cached.find((r) => r.authorEmail.toLowerCase() === myEmail);
      setRating(mineCached?.rating ?? 0);
      setComment(mineCached?.comment ?? '');

      const res = await listSponsorReviews(companyId);
      if (cancelled) return;
      if (res.success && res.data) {
        setReviews(res.data.reviews);
        await saveSponsorReviews(currentEventId, companyId, res.data.reviews);
        const mine = res.data.reviews.find((r) => r.authorEmail.toLowerCase() === myEmail);
        if (mine) {
          setRating(mine.rating);
          setComment(mine.comment);
        }
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId, myEmail, currentEventId]);

  const myReview = reviews.find((r) => r.authorEmail.toLowerCase() === myEmail);
  const otherReviews = reviews.filter((r) => r.authorEmail.toLowerCase() !== myEmail);
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  const handleSubmit = useCallback(async () => {
    if (!rating || !user?.email) return;
    setSubmitting(true);

    const optimistic: SponsorReview = {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      authorName: user.name || user.email.split('@')[0],
      authorEmail: user.email,
      rating,
      comment: comment.trim(),
      createdAt: Date.now(),
    };
    const optimisticList = [
      optimistic,
      ...reviews.filter((r) => r.authorEmail.toLowerCase() !== myEmail),
    ];
    setReviews(optimisticList);
    await saveSponsorReviews(currentEventId, companyId, optimisticList);

    const res = await submitSponsorReview(companyId, {
      rating: optimistic.rating,
      comment: optimistic.comment,
    });
    if (res.success && res.data) {
      const finalList = [
        res.data,
        ...reviews.filter((r) => r.authorEmail.toLowerCase() !== myEmail),
      ];
      setReviews(finalList);
      await saveSponsorReviews(currentEventId, companyId, finalList);
      if (typeof res.data.pointsAwarded === 'number' && res.data.pointsAwarded > 0) {
        showToast('Thanks for your feedback!', res.data.pointsAwarded);
      } else {
        showToast('Thanks for your feedback!');
      }
    } else {
      // NOT_IMPLEMENTED / network — the review is kept locally.
      showToast('Review saved on this device.');
    }
    setSubmitting(false);
  }, [rating, comment, user, reviews, myEmail, companyId, currentEventId, showToast]);

  const handleDeleteMine = useCallback(async () => {
    const next = reviews.filter((r) => r.authorEmail.toLowerCase() !== myEmail);
    setReviews(next);
    setRating(0);
    setComment('');
    await saveSponsorReviews(currentEventId, companyId, next);
  }, [reviews, myEmail, companyId, currentEventId]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {reviews.length > 0 && (
          <View style={styles.avgRow}>
            <Ionicons name="star" size={13} color="#f59e0b" />
            <Text style={styles.avgValue}>{avgRating.toFixed(1)}</Text>
            <Text style={styles.avgCount}>
              · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </View>

      {/* Write / edit review — hidden for sponsor reps, locked once event has ended */}
      {!isSponsorRep && (isEventPast ? (
        <View style={styles.signInCard}>
          <Ionicons name="star" size={14} color="#f59e0b" />
          <Text style={styles.signInText}>Reviews are closed — the event has ended.</Text>
        </View>
      ) : user?.email ? (
        <View style={styles.formCard}>
          <Text style={styles.formPrompt}>
            {myReview ? 'Update your review' : `How was your experience with ${companyName}?`}
          </Text>
          <View style={styles.ratingRow}>
            <StarRating value={rating} onChange={setRating} size={28} />
            <Text style={styles.ratingHint}>{rating > 0 ? `${rating} / 5` : 'Tap to rate'}</Text>
          </View>
          <TextInput
            value={comment}
            onChangeText={(v) => setComment(v.slice(0, 500))}
            placeholder="Share your feedback (optional)…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
          />
          <View style={styles.formFooter}>
            <Text style={styles.charCount}>{comment.length}/500</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!rating || submitting}
              style={[styles.submitBtn, (!rating || submitting) && styles.submitBtnDisabled]}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={13} color="#fff" />
                  <Text style={styles.submitText}>
                    {myReview ? 'Update Review' : 'Submit Review'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.signInCard}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
          <Text style={styles.signInText}>Sign in to leave a review.</Text>
        </View>
      ))}

      {/* My current review — only visible to the reviewer, not sponsor reps */}
      {!isSponsorRep && myReview && (
        <View style={styles.myReviewCard}>
          <View style={styles.myReviewHeader}>
            <View style={styles.myReviewBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#f97316" />
              <Text style={styles.myReviewBadgeText}>YOUR REVIEW</Text>
            </View>
            {!isEventPast && (
              <TouchableOpacity onPress={handleDeleteMine} style={styles.deleteBtn} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={12} color={colors.textMuted} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.reviewMetaRow}>
            <StarRating value={myReview.rating} readOnly size={14} />
            <Text style={styles.reviewTime}>{timeAgo(myReview.createdAt)}</Text>
          </View>
          {!!myReview.comment && <Text style={styles.reviewComment}>{myReview.comment}</Text>}
        </View>
      )}

      {/* Loading */}
      {loading && reviews.length === 0 && (
        <View style={styles.emptyCard}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* Other reviews / empty */}
      {!loading && otherReviews.length === 0 && !myReview && (
        <View style={styles.emptyCard}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
          <Text style={styles.emptyText}>No reviews yet — be the first to share your feedback.</Text>
        </View>
      )}

      {otherReviews.map((r) => (
        <View key={r.id} style={styles.reviewCard}>
          <View style={styles.reviewCardHeader}>
            <Text style={styles.reviewAuthor}>{r.authorName || 'Attendee'}</Text>
            <Text style={styles.reviewTime}>{timeAgo(r.createdAt)}</Text>
          </View>
          <View style={styles.reviewMetaRow}>
            <StarRating value={r.rating} readOnly size={14} />
          </View>
          {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  avgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avgValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  avgCount: { color: colors.textMuted, fontSize: 12 },

  formCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formPrompt: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ratingHint: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    padding: spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  formFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  charCount: { color: colors.textMuted, fontSize: 11 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f97316',
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.lg,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  signInText: { color: colors.textMuted, fontSize: 12 },

  myReviewCard: {
    borderRadius: radius.xl,
    backgroundColor: 'rgba(249,115,22,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
    padding: spacing.lg,
    gap: 6,
  },
  myReviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  myReviewBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  myReviewBadgeText: { color: '#f97316', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },

  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  emptyText: { color: colors.textMuted, fontSize: 13, flex: 1 },

  reviewCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 6,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewAuthor: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  reviewMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewTime: { color: colors.textMuted, fontSize: 11 },
  reviewComment: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
});
