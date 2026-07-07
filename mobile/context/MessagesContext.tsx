import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { useMeetings } from '@/hooks/useMeetings';
import {
  listConversations,
  listMessages,
  sendMessageApi,
  editMessageApi,
  deleteMessageApi,
  resetMessagesEndpointMissing,
} from '@/lib/api/messages';
import {
  getOrDeriveConversationKey,
  encryptMessage,
  decryptMessage,
  clearMessageCryptoCache,
  MESSAGE_CRYPTO_SCHEME,
  type EncryptedPayload,
} from '@/lib/messageCrypto';
import {
  loadCachedConversations,
  saveCachedConversations,
  type StoredConversation,
} from '@/lib/messagesStorage';

export interface ChatMessage {
  id: string;
  senderId: string;
  /** Plaintext (decrypted in-memory only — never sent to the server). */
  text: string;
  timestamp: Date;
  read: boolean;
  /** Set to a future epoch ms while the message is in its 5-second
   *  "Undo" window. The actual POST hasn't fired yet. */
  pendingSendUntil?: number;
  /** Optimistic edit/delete in flight until the backend acknowledges. */
  pendingSync?: boolean;
  editedAt?: Date;
  deletedAt?: Date;
}

export interface Conversation {
  id: string;
  connectionId: string;
  participant: { id: string; name: string; title: string; company: string; avatar: string };
  messages: ChatMessage[];
  lastActivity: Date;
}

interface MessagesContextValue {
  conversations: Conversation[];
  unreadTotal: number;
  sendMessage: (conversationId: string, text: string) => void;
  undoSendMessage: (conversationId: string, messageId: string) => void;
  editMessage: (conversationId: string, messageId: string, newText: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  markConversationRead: (conversationId: string) => void;
}

const MessagesContext = createContext<MessagesContextValue | undefined>(undefined);

export function useMessages(): MessagesContextValue {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error('useMessages must be used within MessagesProvider');
  return ctx;
}

const MESSAGE_UNDO_WINDOW_MS = 5_000;

function toStored(conversations: Conversation[]): StoredConversation[] {
  return conversations.map((c) => ({
    id: c.id,
    connectionId: c.connectionId,
    participant: c.participant,
    lastActivity: c.lastActivity.toISOString(),
    messages: c.messages
      // Never persist a message still inside its undo window — it hasn't
      // "really" been sent yet and could be undone after a reload.
      .filter((m) => !m.pendingSendUntil)
      .map((m) => ({
        id: m.id,
        senderId: m.senderId,
        text: m.text,
        timestamp: m.timestamp.toISOString(),
        read: m.read,
        editedAt: m.editedAt ? m.editedAt.toISOString() : undefined,
        deletedAt: m.deletedAt ? m.deletedAt.toISOString() : undefined,
        pendingSync: m.pendingSync,
      })),
  }));
}

function fromStored(stored: StoredConversation[]): Conversation[] {
  return stored.map((c) => ({
    id: c.id,
    connectionId: c.connectionId,
    participant: c.participant,
    lastActivity: new Date(c.lastActivity),
    messages: c.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      text: m.text,
      timestamp: new Date(m.timestamp),
      read: m.read,
      editedAt: m.editedAt ? new Date(m.editedAt) : undefined,
      deletedAt: m.deletedAt ? new Date(m.deletedAt) : undefined,
      pendingSync: m.pendingSync,
    })),
  }));
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, showToast } = useAuth();
  const { currentEventId } = useEvent();
  const { data: meetingsData = [] } = useMeetings();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  const setConversationsTracked = useCallback(
    (updater: React.SetStateAction<Conversation[]>) => {
      setConversations((prev) => {
        const next = typeof updater === 'function'
          ? (updater as (p: Conversation[]) => Conversation[])(prev)
          : updater;
        conversationsRef.current = next;
        return next;
      });
    },
    [],
  );

  const userId = user?.id ? String(user.id) : undefined;
  const pendingSendTimersRef = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; conversationId: string }>>(new Map());
  const hydratedKeyRef = useRef<string | null>(null);

  // ── Persist local conversations to AsyncStorage whenever they change ──────
  useEffect(() => {
    if (!userId || !currentEventId) return;
    saveCachedConversations(userId, currentEventId, toStored(conversations));
  }, [conversations, userId, currentEventId]);

  // ── Load cached conversations on (user, event) change ─────────────────────
  useEffect(() => {
    let cancelled = false;
    const key = userId && currentEventId ? `${userId}:${currentEventId}` : null;
    // Cancel any pending (undo-window) sends from the previous (user, event)
    // context. If a timer from Event A fired after a switch to Event B, the
    // encrypted POST would resolve `getEventId()` to the NEW event and leak
    // the message into the wrong event scope.
    if (hydratedKeyRef.current !== key) {
      for (const { timer } of pendingSendTimersRef.current.values()) clearTimeout(timer);
      pendingSendTimersRef.current.clear();
    }
    // Reset the NOT_IMPLEMENTED short-circuit for the new event so the
    // hydration probe below actually hits the network.
    resetMessagesEndpointMissing();
    if (!key) {
      setConversationsTracked([]);
      hydratedKeyRef.current = null;
      return;
    }
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;
    (async () => {
      const cached = await loadCachedConversations(userId, currentEventId);
      if (cancelled) return;
      setConversationsTracked(fromStored(cached));
    })();
    return () => { cancelled = true; };
  }, [userId, currentEventId, setConversationsTracked]);

  // ── Seed conversations from accepted meeting connections ──────────────────
  // A confirmed/accepted meeting request is a connection; each gets a
  // conversation keyed deterministically off the meeting id so re-seeding
  // never duplicates. Only accepted connections may be messaged.
  useEffect(() => {
    if (!userId || !currentEventId) return;
    const accepted = meetingsData.filter(
      (m) => m.status === 'accepted' || (m.status as string) === 'confirmed',
    );
    if (accepted.length === 0) return;
    setConversationsTracked((prev) => {
      const existingByConn = new Map(prev.map((c) => [c.connectionId, c]));
      let changed = false;
      const next = [...prev];
      for (const m of accepted) {
        if (existingByConn.has(m.id)) continue;
        changed = true;
        next.unshift({
          id: `conv-${m.id}`,
          connectionId: m.id,
          participant: {
            id: m.attendee.id,
            name: m.attendee.name,
            title: m.attendee.title,
            company: m.attendee.company,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(m.attendee.name || 'A')}&background=7c3aed&color=fff`,
          },
          messages: [],
          lastActivity: new Date(m.createdAt),
        });
      }
      return changed ? next : prev;
    });
  }, [meetingsData, userId, currentEventId, setConversationsTracked]);

  // ── Hydrate from the backend (short-circuits on 404) ──────────────────────
  const hydrateFromServer = useCallback(async () => {
    if (!userId || !currentEventId) return;
    const convRes = await listConversations();
    if (!convRes.success || !convRes.data || convRes.data.length === 0) return;
    const hydrated: Conversation[] = [];
    for (const summary of convRes.data) {
      const msgRes = await listMessages(summary.id);
      if (!msgRes.success || !msgRes.data) continue;
      let convKey: Uint8Array | null = null;
      try {
        convKey = await getOrDeriveConversationKey(summary.connectionId, userId, summary.participantId);
      } catch {
        convKey = null;
      }
      const messages: ChatMessage[] = [];
      for (const m of msgRes.data) {
        const isDeleted = !!m.deletedAt || m.ciphertext === null;
        let text = '';
        if (!isDeleted && m.ciphertext && convKey) {
          try {
            text = await decryptMessage(
              { ciphertext: m.ciphertext, iv: m.iv, scheme: m.scheme as typeof MESSAGE_CRYPTO_SCHEME },
              convKey,
            );
          } catch {
            text = '[unable to decrypt]';
          }
        }
        messages.push({
          id: m.id,
          senderId: m.senderId,
          text,
          timestamp: new Date(m.timestamp),
          read: m.senderId !== userId,
          editedAt: m.editedAt ? new Date(m.editedAt) : undefined,
          deletedAt: m.deletedAt ? new Date(m.deletedAt) : undefined,
        });
      }
      hydrated.push({
        id: summary.id,
        connectionId: summary.connectionId,
        participant: {
          id: summary.participantId,
          name: summary.participantName,
          title: summary.participantTitle,
          company: summary.participantCompany,
          avatar: summary.participantAvatar,
        },
        messages,
        lastActivity: new Date(summary.lastActivityAt),
      });
    }
    if (hydrated.length === 0) return;
    // Prefer server rows; keep purely local conversations the backend
    // hasn't indexed yet (they converge on the next hydration tick).
    setConversationsTracked((prev) => {
      const serverIds = new Set(hydrated.map((c) => c.id));
      const serverConns = new Set(hydrated.map((c) => c.connectionId));
      const localOnly = prev.filter((c) => !serverIds.has(c.id) && !serverConns.has(c.connectionId));
      return [...localOnly, ...hydrated];
    });
  }, [userId, currentEventId, setConversationsTracked]);

  useEffect(() => {
    hydrateFromServer();
  }, [hydrateFromServer]);

  // Refresh on foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') hydrateFromServer();
    });
    return () => sub.remove();
  }, [hydrateFromServer]);

  // ── Sign-out cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (userId) return;
    for (const { timer } of pendingSendTimersRef.current.values()) clearTimeout(timer);
    pendingSendTimersRef.current.clear();
    setConversationsTracked([]);
    clearMessageCryptoCache();
    resetMessagesEndpointMissing();
    hydratedKeyRef.current = null;
  }, [userId, setConversationsTracked]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resolveContext = useCallback(
    (conversationId: string): Conversation | null => {
      if (!currentEventId) return null;
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      return conv ?? null;
    },
    [currentEventId],
  );

  const encryptForConversation = useCallback(
    async (conv: Conversation, plaintext: string): Promise<EncryptedPayload | null> => {
      const me = userId || 'current-user';
      const key = await getOrDeriveConversationKey(conv.connectionId, me, conv.participant.id);
      return encryptMessage(plaintext, key);
    },
    [userId],
  );

  const markConversationRead = useCallback((conversationId: string) => {
    setConversationsTracked((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, messages: c.messages.map((m) => ({ ...m, read: true })) }
          : c,
      ),
    );
  }, [setConversationsTracked]);

  const sendMessage = useCallback((conversationId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const conv = resolveContext(conversationId);
    if (!conv) {
      showToast('You can only message accepted connections.');
      return;
    }
    const tempId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const sentAt = new Date();
    const newMsg: ChatMessage = {
      id: tempId,
      senderId: userId || 'current-user',
      text: trimmed,
      timestamp: sentAt,
      read: true,
      pendingSendUntil: Date.now() + MESSAGE_UNDO_WINDOW_MS,
    };
    setConversationsTracked((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, newMsg], lastActivity: sentAt }
          : c,
      ),
    );

    const timer = setTimeout(async () => {
      pendingSendTimersRef.current.delete(tempId);
      const enc = await encryptForConversation(conv, trimmed).catch(() => null);
      if (!enc) {
        setConversationsTracked((prev) =>
          prev.map((c) =>
            c.id !== conversationId
              ? c
              : { ...c, messages: c.messages.map((m) => (m.id === tempId ? { ...m, pendingSendUntil: undefined, pendingSync: true } : m)) },
          ),
        );
        showToast('Could not encrypt your message. Try again.');
        return;
      }
      const res = await sendMessageApi(conv.id, enc);
      if (res.success && res.data) {
        const serverId = res.data.id;
        setConversationsTracked((prev) =>
          prev.map((c) =>
            c.id !== conversationId
              ? c
              : { ...c, messages: c.messages.map((m) => (m.id === tempId ? { ...m, id: serverId, pendingSendUntil: undefined, timestamp: new Date(res.data!.timestamp) } : m)) },
          ),
        );
      } else if (res.error?.code === 'NOT_IMPLEMENTED') {
        // Backend not deployed — keep the local message; drop pending flag.
        setConversationsTracked((prev) =>
          prev.map((c) =>
            c.id !== conversationId
              ? c
              : { ...c, messages: c.messages.map((m) => (m.id === tempId ? { ...m, pendingSendUntil: undefined } : m)) },
          ),
        );
      } else {
        setConversationsTracked((prev) =>
          prev.map((c) =>
            c.id !== conversationId
              ? c
              : { ...c, messages: c.messages.map((m) => (m.id === tempId ? { ...m, pendingSendUntil: undefined, pendingSync: true } : m)) },
          ),
        );
        showToast(res.error?.message ?? 'Could not deliver your message.');
      }
    }, MESSAGE_UNDO_WINDOW_MS);
    pendingSendTimersRef.current.set(tempId, { timer, conversationId });
  }, [resolveContext, userId, showToast, encryptForConversation, setConversationsTracked]);

  const undoSendMessage = useCallback((conversationId: string, messageId: string) => {
    const entry = pendingSendTimersRef.current.get(messageId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingSendTimersRef.current.delete(messageId);
    setConversationsTracked((prev) =>
      prev.map((c) =>
        c.id !== conversationId ? c : { ...c, messages: c.messages.filter((m) => m.id !== messageId) },
      ),
    );
  }, [setConversationsTracked]);

  const editMessage = useCallback(async (conversationId: string, messageId: string, newText: string): Promise<void> => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const conv = resolveContext(conversationId);
    if (!conv) {
      showToast('You can only edit messages on accepted connections.');
      return;
    }
    const original = conv.messages.find((m) => m.id === messageId);
    if (!original || original.senderId !== (userId || 'current-user') || original.deletedAt) return;
    if (original.text === trimmed) return;
    const editedAt = new Date();
    setConversationsTracked((prev) =>
      prev.map((c) =>
        c.id !== conversationId
          ? c
          : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, text: trimmed, editedAt, pendingSync: true } : m)) },
      ),
    );
    const enc = await encryptForConversation(conv, trimmed).catch(() => null);
    if (!enc) {
      setConversationsTracked((prev) =>
        prev.map((c) =>
          c.id !== conversationId
            ? c
            : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, text: original.text, editedAt: original.editedAt, pendingSync: false } : m)) },
        ),
      );
      showToast('Could not re-encrypt your edit. Try again.');
      return;
    }
    const res = await editMessageApi(conv.id, messageId, enc);
    if (res.success || res.error?.code === 'NOT_IMPLEMENTED') {
      setConversationsTracked((prev) =>
        prev.map((c) =>
          c.id !== conversationId ? c : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, pendingSync: false } : m)) },
        ),
      );
    } else {
      setConversationsTracked((prev) =>
        prev.map((c) =>
          c.id !== conversationId
            ? c
            : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, text: original.text, editedAt: original.editedAt, pendingSync: false } : m)) },
        ),
      );
      showToast(res.error?.message ?? 'Could not save your edit.');
    }
  }, [resolveContext, userId, showToast, encryptForConversation, setConversationsTracked]);

  const deleteMessage = useCallback(async (conversationId: string, messageId: string): Promise<void> => {
    const conv = resolveContext(conversationId);
    if (!conv) return;
    const original = conv.messages.find((m) => m.id === messageId);
    if (!original || original.senderId !== (userId || 'current-user') || original.deletedAt) return;
    // Still in the undo window → treat delete as an immediate undo.
    if (pendingSendTimersRef.current.get(messageId)) {
      undoSendMessage(conversationId, messageId);
      return;
    }
    const deletedAt = new Date();
    setConversationsTracked((prev) =>
      prev.map((c) =>
        c.id !== conversationId
          ? c
          : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, deletedAt, pendingSync: true } : m)) },
      ),
    );
    const res = await deleteMessageApi(conv.id, messageId);
    if (res.success || res.error?.code === 'NOT_IMPLEMENTED') {
      setConversationsTracked((prev) =>
        prev.map((c) =>
          c.id !== conversationId ? c : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, pendingSync: false } : m)) },
        ),
      );
    } else {
      setConversationsTracked((prev) =>
        prev.map((c) =>
          c.id !== conversationId
            ? c
            : { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, deletedAt: undefined, pendingSync: false } : m)) },
        ),
      );
      showToast(res.error?.message ?? 'Could not delete the message.');
    }
  }, [resolveContext, userId, showToast, undoSendMessage, setConversationsTracked]);

  const myId = userId || 'current-user';
  const unreadTotal = conversations.reduce(
    (sum, c) => sum + c.messages.filter((m) => !m.read && m.senderId !== myId).length,
    0,
  );

  return (
    <MessagesContext.Provider
      value={{
        conversations,
        unreadTotal,
        sendMessage,
        undoSendMessage,
        editMessage,
        deleteMessage,
        markConversationRead,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}
