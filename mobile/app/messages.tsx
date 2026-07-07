import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useMessages, type Conversation, type ChatMessage } from '@/context/MessagesContext';
import { colors, spacing, radius } from '@/constants/theme';

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { conversations, markConversationRead } = useMessages();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()),
    [conversations],
  );

  const activeChat = conversations.find((c) => c.id === activeChatId) ?? null;

  const openChat = useCallback((id: string) => {
    setActiveChatId(id);
    markConversationRead(id);
  }, [markConversationRead]);

  if (activeChat) {
    return <ChatDetail conversation={activeChat} onBack={() => setActiveChatId(null)} />;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <ConversationRow conv={item} onOpen={openChat} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>Accept a connection request to start chatting securely</Text>
          </View>
        }
      />
    </View>
  );
}

function ConversationRow({ conv, onOpen }: { conv: Conversation; onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const myId = user?.id ? String(user.id) : 'current-user';
  const lastMsg = conv.messages[conv.messages.length - 1];
  const unread = conv.messages.filter((m) => !m.read && m.senderId !== myId).length;
  const initial = (conv.participant.name || '?')[0].toUpperCase();

  return (
    <TouchableOpacity style={styles.convRow} onPress={() => onOpen(conv.id)} activeOpacity={0.8}>
      <View style={[styles.avatar, { borderColor: unread > 0 ? colors.primary : colors.border }]}>
        <Text style={styles.avatarText}>{initial}</Text>
        {unread > 0 && (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadDotText}>{unread}</Text>
          </View>
        )}
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convTopLine}>
          <Text style={[styles.convName, unread > 0 && { fontWeight: '800' }]} numberOfLines={1}>{conv.participant.name}</Text>
          <Text style={styles.convTime}>{lastMsg ? formatTime(lastMsg.timestamp) : ''}</Text>
        </View>
        {lastMsg ? (
          <Text style={[styles.convPreview, unread > 0 && { color: colors.textPrimary }]} numberOfLines={1}>
            {lastMsg.deletedAt ? 'Message deleted' : `${lastMsg.senderId === myId ? 'You: ' : ''}${lastMsg.text}`}
          </Text>
        ) : (
          <Text style={styles.convPreview} numberOfLines={1}>No messages yet — say hello!</Text>
        )}
        <Text style={styles.convSub} numberOfLines={1}>
          {conv.participant.title}{conv.participant.company ? ` · ${conv.participant.company}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function ChatDetail({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sendMessage, undoSendMessage, editMessage, deleteMessage } = useMessages();
  const myId = user?.id ? String(user.id) : 'current-user';
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [, setTick] = useState(0);
  const listRef = useRef<FlatList>(null);

  // Re-render each second while any message is inside its undo window.
  useEffect(() => {
    const hasPending = conversation.messages.some(
      (m) => m.pendingSendUntil && m.pendingSendUntil > Date.now(),
    );
    if (!hasPending) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [conversation.messages]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [conversation.messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(conversation.id, trimmed);
    setInput('');
  };

  const handleLongPress = (msg: ChatMessage) => {
    if (msg.senderId !== myId || msg.deletedAt) return;
    if (msg.pendingSendUntil && msg.pendingSendUntil > Date.now()) return;
    Alert.alert('Message', undefined, [
      { text: 'Edit', onPress: () => { setEditingId(msg.id); setEditingText(msg.text); } },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(conversation.id, msg.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const id = editingId;
    const text = editingText;
    setEditingId(null);
    setEditingText('');
    editMessage(conversation.id, id, text);
  };

  const renderMessage = ({ item: msg }: { item: ChatMessage }) => {
    const isMine = msg.senderId === myId;
    const isDeleted = !!msg.deletedAt;
    const isEdited = !!msg.editedAt && !isDeleted;
    const undoSecondsLeft = msg.pendingSendUntil ? Math.max(0, Math.ceil((msg.pendingSendUntil - Date.now()) / 1000)) : 0;
    const isPendingSend = undoSecondsLeft > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => handleLongPress(msg)}
        style={[styles.msgRow, { justifyContent: isMine ? 'flex-end' : 'flex-start' }]}
      >
        <View style={[styles.bubbleWrap, { alignItems: isMine ? 'flex-end' : 'flex-start' }]}>
          {isMine && !isDeleted ? (
            <LinearGradient
              colors={colors.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.bubble, styles.bubbleMine, (msg.pendingSync || isPendingSend) && { opacity: 0.7 }]}
            >
              <Text style={styles.bubbleTextMine}>{msg.text}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, isDeleted && styles.bubbleDeleted]}>
              <Text style={isDeleted ? styles.bubbleDeletedText : styles.bubbleTextTheirs}>
                {isDeleted ? 'Message deleted' : msg.text}
              </Text>
            </View>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatTime(msg.timestamp)}</Text>
            {isEdited && <Text style={styles.metaText}>· edited</Text>}
            {isPendingSend && (
              <>
                <Text style={styles.metaText}>· Sending… {undoSecondsLeft}s</Text>
                <TouchableOpacity onPress={() => undoSendMessage(conversation.id, msg.id)}>
                  <Text style={styles.undoText}>Undo</Text>
                </TouchableOpacity>
              </>
            )}
            {msg.pendingSync && !isPendingSend && <Text style={styles.metaText}>· Syncing…</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.chatAvatar}>
          <Text style={styles.avatarText}>{(conversation.participant.name || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatName} numberOfLines={1}>{conversation.participant.name}</Text>
          <Text style={styles.chatSub} numberOfLines={1}>
            {conversation.participant.title}{conversation.participant.company ? ` · ${conversation.participant.company}` : ''}
          </Text>
        </View>
        <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <FlatList
          ref={listRef}
          data={conversation.messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.chatEmpty}>
              <Ionicons name="chatbubble-ellipses-outline" size={30} color={colors.textMuted} />
              <Text style={styles.chatEmptyText}>No messages yet — say hello!</Text>
              <Text style={styles.chatEmptySub}>Messages are encrypted on this device before they leave.</Text>
            </View>
          }
        />

        {editingId ? (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={styles.input}
              value={editingText}
              onChangeText={setEditingText}
              placeholder="Edit message…"
              placeholderTextColor={colors.textMuted}
              autoFocus
              multiline
            />
            <TouchableOpacity onPress={() => { setEditingId(null); setEditingText(''); }} style={styles.cancelBtn}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdit} disabled={!editingText.trim()} style={[styles.sendBtn, !editingText.trim() && { opacity: 0.5 }]}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity onPress={handleSend} disabled={!input.trim()} style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}>
              <Ionicons name="send" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  list: { padding: spacing.xl, paddingBottom: 100, gap: spacing.sm },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124,58,237,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: { color: colors.primaryLight, fontSize: 18, fontWeight: '700' },
  unreadDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  convInfo: { flex: 1 },
  convTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1, marginRight: spacing.sm },
  convTime: { color: colors.textMuted, fontSize: 11 },
  convPreview: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  convSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 64, gap: spacing.md },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.xl },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  chatSub: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },

  msgList: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  msgRow: { flexDirection: 'row', width: '100%' },
  bubbleWrap: { maxWidth: '80%' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleDeleted: { backgroundColor: colors.bgElevated, borderColor: colors.border },
  bubbleTextMine: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTextTheirs: { color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  bubbleDeletedText: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { color: colors.textMuted, fontSize: 10 },
  undoText: { color: colors.accent, fontSize: 10, fontWeight: '700', textDecorationLine: 'underline' },

  chatEmpty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: spacing.sm },
  chatEmptyText: { color: colors.textSecondary, fontSize: 13 },
  chatEmptySub: { color: colors.textMuted, fontSize: 11, textAlign: 'center', paddingHorizontal: spacing.xxl },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
