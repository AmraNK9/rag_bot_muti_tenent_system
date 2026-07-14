import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { Message } from '../types';

const DB_NAME = 'chatbot-admin-cache';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';

/**
 * MessageCache — IndexedDB-backed local message store
 *
 * Strategy:
 *   1. On chat open → instantly display cached messages (zero latency)
 *   2. Background delta sync: send `since=<maxCachedId>` to server
 *   3. Server returns only NEW messages since that ID
 *   4. Merge into cache + update UI
 *   5. WebSocket real-time messages also get cached
 *
 * Stores:
 *   - messages: { id, sender_id, chatbot_id, message, sender_type, sent_date }
 *     Indexes: by_sender (sender_id), by_date (sent_date)
 */

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const store = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          store.createIndex('by_sender', 'sender_id');
          store.createIndex('by_date', 'sent_date');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get cached messages for a sender, ordered by sent_date ASC (chronological).
 * Optionally limit to most recent N messages.
 */
export async function getCachedMessages(senderId: string, limit?: number): Promise<Message[]> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, 'readonly');
  const index = tx.store.index('by_sender');
  const all = await index.getAll(senderId);
  await tx.done;

  // Sort ASC by sent_date (chronological — oldest first, newest at bottom)
  all.sort((a, b) => new Date(a.sent_date).getTime() - new Date(b.sent_date).getTime());

  if (limit && all.length > limit) {
    // Return only the most recent `limit` messages
    return all.slice(-limit);
  }
  return all;
}

/**
 * Get the highest cached message ID for a given sender.
 * Used for delta sync: "give me everything since this ID".
 */
export async function getMaxCachedId(senderId: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, 'readonly');
  const index = tx.store.index('by_sender');
  const all = await index.getAll(senderId);
  await tx.done;

  if (all.length === 0) return 0;
  return Math.max(...all.map((m: Message) => m.id));
}

/**
 * Get total count of cached messages for a sender.
 */
export async function getCachedCount(senderId: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, 'readonly');
  const index = tx.store.index('by_sender');
  const count = await index.count(senderId);
  await tx.done;
  return count;
}

/**
 * Save (upsert) a batch of messages into the cache.
 * Uses put() so duplicates are safely overwritten.
 */
export async function cacheMessages(messages: Message[]): Promise<void> {
  if (messages.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, 'readwrite');
  for (const msg of messages) {
    await tx.store.put(msg);
  }
  await tx.done;
}

/**
 * Save a single message into the cache (used for real-time WebSocket messages).
 */
export async function cacheSingleMessage(msg: Message): Promise<void> {
  const db = await getDB();
  await db.put(MESSAGES_STORE, msg);
}

/**
 * Get older messages from cache for infinite scroll up.
 * Returns messages BEFORE the oldest currently displayed message.
 */
export async function getOlderCachedMessages(
  senderId: string,
  beforeId: number,
  limit: number
): Promise<Message[]> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, 'readonly');
  const index = tx.store.index('by_sender');
  const all = await index.getAll(senderId);
  await tx.done;

  // Filter messages with id < beforeId, sort ASC, take last `limit`
  const older = all
    .filter((m: Message) => m.id < beforeId)
    .sort((a: Message, b: Message) => new Date(a.sent_date).getTime() - new Date(b.sent_date).getTime());

  if (older.length > limit) {
    return older.slice(-limit);
  }
  return older;
}

/**
 * Clear all cached messages (e.g., on logout).
 */
export async function clearMessageCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;
}
