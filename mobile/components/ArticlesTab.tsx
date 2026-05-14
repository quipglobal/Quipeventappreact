import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useArticleCategories, useArticles } from '@/hooks/useReader';
import { colors, spacing, radius } from '@/constants/theme';
import type { Article, ArticleCategory } from '@/lib/api/types';

const ACCENT_COLORS = ['#7c3aed', '#06b6d4', '#ec4899', '#10b981', '#f59e0b'];

function getCategoryColor(category: ArticleCategory, index: number): string {
  return category.color && category.color !== '#7c3aed'
    ? category.color
    : ACCENT_COLORS[index % ACCENT_COLORS.length];
}

function formatPublishedDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function ArticleCard({ item }: { item: Article }) {
  const accent = item.categoryColor || '#7c3aed';
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.82}
      onPress={() =>
        router.push({ pathname: '/article-reader', params: { id: item.id } } as any)
      }
    >
      {item.thumbnailUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={styles.cardThumb}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[accent + '40', accent + '10']}
          style={styles.cardThumbPlaceholder}
        >
          <Ionicons name="document-text" size={30} color={accent} />
        </LinearGradient>
      )}

      <View style={styles.cardBody}>
        {item.categoryName ? (
          <View style={[styles.catPill, { backgroundColor: accent + '20' }]}>
            <Text style={[styles.catPillText, { color: accent }]}>
              {item.categoryName.toUpperCase()}
            </Text>
          </View>
        ) : null}

        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>

        {item.excerpt ? (
          <Text style={styles.cardExcerpt} numberOfLines={2}>
            {item.excerpt}
          </Text>
        ) : null}

        <View style={styles.cardMeta}>
          {item.authorName ? (
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={11} color={colors.textMuted} />
              <Text style={styles.metaText}>{item.authorName}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
            <Text style={styles.metaText}>{item.estimatedReadMinutes} min read</Text>
          </View>
          {item.publishedAt ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
              <Text style={styles.metaText}>{formatPublishedDate(item.publishedAt)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.cardChevron}>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function CategoryPill({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.categoryPill,
        active
          ? { backgroundColor: color, borderColor: color }
          : { backgroundColor: color + '15', borderColor: color + '40' },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text
        style={[
          styles.categoryPillText,
          { color: active ? '#fff' : color },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ArticlesTab() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);

  const {
    data: categories = [],
    isLoading: catsLoading,
  } = useArticleCategories();

  const {
    data: articles = [],
    isLoading: articlesLoading,
    isError: articlesError,
    isRefetching,
    refetch,
  } = useArticles(selectedCategoryId);

  const isLoading = catsLoading || articlesLoading;

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const renderArticle = useCallback(
    ({ item }: { item: Article }) => <ArticleCard item={item} />,
    [],
  );

  const listHeader = (
    <View>
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <CategoryPill
            label="All"
            color="#7c3aed"
            active={!selectedCategoryId}
            onPress={() => setSelectedCategoryId(undefined)}
          />
          {categories.map((cat, i) => {
            const color = getCategoryColor(cat, i);
            return (
              <CategoryPill
                key={cat.id}
                label={cat.name}
                color={color}
                active={selectedCategoryId === cat.id}
                onPress={() =>
                  setSelectedCategoryId(
                    selectedCategoryId === cat.id ? undefined : cat.id,
                  )
                }
              />
            );
          })}
        </ScrollView>
      )}
      {selectedCategoryId && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>
            {categories.find((c) => c.id === selectedCategoryId)?.name ?? 'Filtered'}
          </Text>
          <TouchableOpacity onPress={() => setSelectedCategoryId(undefined)}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading articles…</Text>
      </View>
    );
  }

  if (articlesError) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.error} />
        </View>
        <Text style={styles.errorTitle}>Couldn't load articles</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Ionicons name="refresh" size={15} color="#fff" />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={articles}
      keyExtractor={(item) => item.id}
      renderItem={renderArticle}
      ListHeaderComponent={listHeader}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="library-outline" size={36} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No articles yet</Text>
          <Text style={styles.emptySub}>
            {selectedCategoryId
              ? 'No articles in this category. Try "All" above.'
              : 'Articles will appear here once published.'}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.md,
  },

  categoryScroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  filterLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },

  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardThumb: {
    width: 88,
    height: 88,
  },
  cardThumbPlaceholder: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    padding: spacing.md,
    gap: 4,
  },
  catPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: 2,
  },
  catPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  cardExcerpt: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 10,
  },
  cardChevron: {
    paddingRight: spacing.md,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    marginTop: 80,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.md,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  errorTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing.xxl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
});
