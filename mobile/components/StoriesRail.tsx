import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radius } from '@/constants/theme';

interface Story {
  id: string;
  name: string;
  avatar: string;
  isLive?: boolean;
  hasUnseen?: boolean;
}

/**
 * Story-style rail shown at the top of the feed. Mirrors the web
 * `src/app/components/feed/StoriesRail.tsx` look. The backend does not expose
 * a stories endpoint yet, so the rail is seeded with the same sample data the
 * web reference uses; it is display-only until a stories API ships.
 */
const STORIES: Story[] = [
  {
    id: 's1',
    name: 'Sarah Chen',
    avatar:
      'https://images.unsplash.com/photo-1655249481446-25d575f1c054?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200&q=80',
    isLive: true,
    hasUnseen: true,
  },
  {
    id: 's2',
    name: 'Tech Summit',
    avatar:
      'https://images.unsplash.com/photo-1644088379091-d574269d422f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200&q=80',
    hasUnseen: true,
  },
  {
    id: 's3',
    name: 'David Kim',
    avatar:
      'https://images.unsplash.com/photo-1649433658557-54cf58577c68?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200&q=80',
    hasUnseen: false,
  },
  {
    id: 's4',
    name: 'Elena Rodriguez',
    avatar:
      'https://images.unsplash.com/photo-1760611656007-f767a8082758?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200&q=80',
    hasUnseen: true,
  },
  {
    id: 's5',
    name: 'Mark Johnson',
    avatar:
      'https://images.unsplash.com/photo-1560439514-4e9645039924?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=200&q=80',
    hasUnseen: false,
  },
];

export function StoriesRail() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {/* My Story / Add Story */}
      <TouchableOpacity style={styles.storyItem} activeOpacity={0.8}>
        <View style={styles.ring}>
          <View style={[styles.avatarWrap, styles.addAvatar]}>
            <Ionicons name="add" size={24} color={colors.primary} />
          </View>
          <View style={styles.addBadge}>
            <Ionicons name="add" size={12} color="#fff" />
          </View>
        </View>
        <Text style={styles.name} numberOfLines={1}>My Story</Text>
      </TouchableOpacity>

      {STORIES.map((story) => (
        <TouchableOpacity key={story.id} style={styles.storyItem} activeOpacity={0.8}>
          {story.hasUnseen ? (
            <LinearGradient
              colors={[colors.accent, '#ec4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ring}
            >
              <View style={styles.avatarWrap}>
                <Image source={{ uri: story.avatar }} style={styles.avatar} />
              </View>
              {story.isLive && (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </LinearGradient>
          ) : (
            <View style={[styles.ring, styles.ringSeen]}>
              <View style={styles.avatarWrap}>
                <Image source={{ uri: story.avatar }} style={styles.avatar} />
              </View>
            </View>
          )}
          <Text
            style={[styles.name, story.hasUnseen && styles.nameUnseen]}
            numberOfLines={1}
          >
            {story.name.split(' ')[0]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const RING = 68;
const AVATAR = RING - 6;

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    gap: 6,
    width: 72,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  ringSeen: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 2,
    borderColor: colors.bg,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
  },
  addAvatar: {
    borderWidth: 2,
    borderColor: colors.borderMid,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: '#ef4444',
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.bg,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  name: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 72,
  },
  nameUnseen: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
