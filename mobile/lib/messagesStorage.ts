import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-(user, event) overlay for encrypted-messaging conversations.
 *
 * The backend conversations/messages routes are not deployed yet (they
 * 404 → the client short-circuits to NOT_IMPLEMENTED). Until then the
 * mobile app runs messaging local-only: conversations are seeded from
 * accepted meeting connections and messages live on-device. This
 * overlay persists that local state so a reload doesn't wipe a
 * conversation the user just had. Mirrors `leadsStorage.ts`.
 *
 * Message bodies are the user's own plaintext and never leave the
 * device (the wire format is ciphertext produced by `messageCrypto`),
 * so storing plaintext locally in the app's private AsyncStorage is
 * acceptable and matches the web build's in-memory posture.
 */

export interface StoredMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  read: boolean;
  editedAt?: string;
  deletedAt?: string;
  pendingSync?: boolean;
}

export interface StoredConversation {
  id: string;
  connectionId: string;
  participant: { id: string; name: string; title: string; company: string; avatar: string };
  messages: StoredMessage[];
  lastActivity: string;
}

const KEY_PREFIX = 'cxo:conversations:v1';

function keyFor(userId: string, eventId: string): string {
  return `${KEY_PREFIX}:${userId}:${eventId}`;
}

export async function loadCachedConversations(
  userId: string | null | undefined,
  eventId: string | null | undefined,
): Promise<StoredConversation[]> {
  if (!userId || !eventId) return [];
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, eventId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is StoredConversation =>
        c != null && typeof c === 'object' && typeof (c as StoredConversation).id === 'string' &&
        Array.isArray((c as StoredConversation).messages),
    );
  } catch {
    return [];
  }
}

export async function saveCachedConversations(
  userId: string | null | undefined,
  eventId: string | null | undefined,
  conversations: StoredConversation[],
): Promise<void> {
  if (!userId || !eventId) return;
  try {
    await AsyncStorage.setItem(keyFor(userId, eventId), JSON.stringify(conversations));
  } catch {
    // ignore
  }
}
