# PRD-07: In-Platform Messaging System

**Status:** Draft
**Version:** 1.0
**Date:** 2026-03-20
**Author:** Product
**Depends on:** PRD-08 (Notifications System — for message notification triggers)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Overview](#2-product-overview)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Database Schema](#5-database-schema)
6. [API Design](#6-api-design)
7. [Supabase Realtime Design](#7-supabase-realtime-design)
8. [Frontend Integration](#8-frontend-integration)
9. [User Stories and Acceptance Criteria](#9-user-stories-and-acceptance-criteria)
10. [Edge Cases and Error Handling](#10-edge-cases-and-error-handling)
11. [Security and Access Control](#11-security-and-access-control)
12. [Migration from Mock Data](#12-migration-from-mock-data)
13. [Out of Scope (v1)](#13-out-of-scope-v1)
14. [Open Questions](#14-open-questions)

---

## 1. Executive Summary

### Problem Statement

CostFinders has a complete messaging UI built on mock data. The UI covers conversation lists, message threads, unread counts, and the compose interface. This system has no persistence layer — messages are lost on page refresh, there is no real-time delivery between participants, and unread counts are not maintained across sessions. The backend team now needs a specification to implement the real system.

### Solution Overview

Replace the mock data layer with a Supabase-backed persistence and real-time messaging system. Conversations are created automatically when a consumer claims a deal. Both the business and the consumer can then exchange messages within that conversation thread. Supabase Realtime channels deliver new messages to both participants without requiring a page refresh. Unread counts are computed from the database and surfaced in the navigation badge.

### Business Context

Messaging is a retention and conversion mechanism. The faster a business can respond to a claim, the higher the booking rate. Keeping communication in-platform rather than in email or SMS gives CostFinders visibility into lead quality, creates a paper trail for dispute resolution, and provides future data for analytics. The post-claim-only constraint is intentional — it ensures the platform does not become a cold outreach tool that degrades lead quality.

### Key Constraint

**Messaging is gated behind a claim.** No claim, no conversation. No cold messaging. This is a business rule, not a technical limitation, and it must be enforced at the database level (FK constraint and RLS), not just in application code.

### Resource Estimate

| Work | Estimate |
|------|----------|
| Database migration (schema + RLS + indexes) | 0.5 days |
| Server Actions (send, read, archive) | 1 day |
| Supabase Realtime integration | 1 day |
| Frontend wiring (replace mock calls) | 1 day |
| Unread badge + notification hook | 0.5 days |
| QA and edge case validation | 0.5 days |
| **Total** | **4.5 days** |

---

## 2. Product Overview

### Product Vision

Every claim on CostFinders should create a direct, private communication channel between the consumer and the business. This channel persists for the lifetime of the claim and gives both parties a shared record of their conversation.

### Target Users

| User | Role in Messaging |
|------|------------------|
| Consumer | Initiates or replies to conversation after claiming a deal. Accesses thread from consumer dashboard (future) or notification link. |
| Business owner / staff | Receives new message notifications, replies to consumer inquiries, manages conversation status. Accesses thread from `/business/dashboard/messages` or the lead detail page. |

### Success Criteria

| Metric | Target |
|--------|--------|
| Message delivery latency (Realtime) | < 500ms p95 from send to recipient display |
| Read receipt accuracy | 100% — a message marked read in DB must not show as unread |
| Unread count accuracy | Matches DB state within one Realtime event |
| Zero data loss | No message lost due to network error — server action returns persisted record or throws |
| Business response rate lift | Measurable improvement vs. email-only contact (baseline to be set at launch) |

### Assumptions

1. Supabase Auth is the identity provider for both consumers and businesses. `auth.uid()` is available in RLS policies. This PRD does not specify the auth integration itself — it is assumed to be in place.
2. The existing `claims` table (or its equivalent) has a `consumer_id` and `business_id` column that can be used as foreign keys. The current mock type `Claim` defines these fields; the real table must match.
3. PRD-08 (Notifications) will read from the `messages` table or subscribe to a Supabase webhook/function to trigger push/email/SMS notifications. This PRD defines the trigger contract but does not implement the notification delivery.
4. The consumer-facing messaging UI (a dashboard page at `/dashboard/messages` or within the claim detail) is a separate UI deliverable and is not in scope for this PRD. This PRD covers the data layer and the business-side UI wiring. The data layer is shared.

---

## 3. Functional Requirements

### 3.1 Conversation Lifecycle

**F-01: Auto-creation on claim**

When a consumer successfully claims a deal, the system creates a `conversations` record with `status = 'active'`. This happens as part of the claim creation transaction, not lazily on first message. The conversation must exist even if no messages have been sent yet — this is what enables the empty state ("Start the conversation") in the existing UI.

**F-02: One conversation per claim**

Each claim has exactly one conversation. Attempting to create a second conversation for the same claim must fail at the database level (unique constraint on `claim_id`).

**F-03: Conversation archiving**

A business can mark a conversation as `archived`. Archived conversations are hidden from the default "All" tab but accessible via an "Archived" filter. The consumer is not notified when a conversation is archived. Only the business can archive — consumers cannot.

**F-04: Conversation status does not affect messaging**

A consumer or business can still send messages to an `archived` conversation. Archiving is a UI organization tool, not a communication lock. If a new message arrives in an archived conversation, it surfaces back in the "All" tab (the conversation status reverts to `active` on new message receipt).

### 3.2 Message Sending

**F-05: Send a message**

Any participant (business or consumer) can send a text message to the conversation associated with a claim they are part of. The message is persisted before the UI optimistically renders it. If the persist fails, the optimistic render is rolled back and an error toast is shown ("Message couldn't be sent. Try again.").

**F-06: Message content constraints**

- Minimum length: 1 character (after trimming whitespace)
- Maximum length: 2000 characters
- Allowed content: plain text only (v1). No HTML, no markdown rendering, no URLs are linkified automatically.
- The 2000-character limit is enforced at the database level (CHECK constraint) and validated in the Server Action before the insert.

**F-07: Sender identification**

Each message stores `sender_id` (the `auth.uid()` of the sender) and `sender_type` ('business' | 'consumer'). The `sender_type` is derived from the session context, not passed by the client — the client cannot lie about which type it is.

### 3.3 Message History

**F-08: Chronological display**

Messages in a thread are returned in ascending `created_at` order (oldest first, newest at bottom). The UI auto-scrolls to the latest message on load and on each new incoming message.

**F-09: Pagination**

Initial load fetches the most recent 50 messages. Scrolling to the top of the thread triggers a "load earlier" fetch for the previous page. Page size is 50. This prevents large threads from causing slow initial loads.

**F-10: Sender display**

The `messageThread.tsx` component already differentiates own messages (right-aligned, amber background) from the other party's messages (left-aligned, sand background). The real implementation maps `sender_id` against the current session user's ID to determine alignment. `sender_type` is used as a label ("Business" vs. first name or "You").

### 3.4 Read Receipts

**F-11: Mark messages as read**

When a participant opens a conversation thread and messages from the other party are present and unread (i.e., `read_at IS NULL`), those messages are marked as read immediately. The update is a batch `UPDATE messages SET read_at = NOW() WHERE conversation_id = $1 AND sender_id != $2 AND read_at IS NULL`.

**F-12: Read receipt display**

The `messageThread.tsx` component does not currently show read receipts visually (no "Seen" label). This remains out of scope for v1. The `read_at` field is stored and computed, but not displayed to the sender.

**F-13: Read-on-focus**

If the browser tab is already open with the conversation active and new messages arrive via Realtime, those messages are marked as read immediately (because the user is looking at the thread). This is handled by a `useEffect` that calls the mark-read action whenever the `messages` array updates and the thread is the active view.

### 3.5 Unread Count

**F-14: Per-conversation unread count**

The `conversations` list query includes a computed unread count: the number of messages in that conversation sent by the other party where `read_at IS NULL`. For the business dashboard, "other party" means `sender_type = 'consumer'`. For a consumer view, "other party" means `sender_type = 'business'`.

**F-15: Global unread badge**

The business navigation sidebar shows a badge on the "Messages" icon when any conversation has unread messages. The badge value is the total count of unread messages across all conversations for that business (capped at "99+" for display). This count is fetched on page load and updated via Realtime subscription.

**F-16: Badge reset on view**

Navigating to the messages page does not automatically mark all conversations as read. Only opening a specific conversation thread triggers the mark-read action. The badge reflects the actual database state, not a UI-only counter.

### 3.6 Real-Time Updates

**F-17: New message delivery**

When a message is inserted into the `messages` table, Supabase Realtime broadcasts the event to all subscribers of the relevant conversation channel. Both the sender's UI (confirmation) and the recipient's UI (new message) receive the event. The sender's UI uses this event to replace the optimistic message with the persisted one (with a real `id` and `created_at`).

**F-18: Unread count updates**

When a new message arrives via Realtime, the global unread badge updates without a page refresh. The conversation list also refreshes its "last message" preview and unread indicator.

**F-19: Conversation list refresh**

The `last_message_at` field on the `conversations` table is updated via a database trigger whenever a new message is inserted. The conversations list subscribes to changes on the `conversations` table filtered by `business_id` (or `consumer_id`), so new messages bubble the conversation to the top of the list in real time.

### 3.7 Message Notifications

**F-20: Notification trigger contract**

When a message is inserted, a Supabase Database Function (or Edge Function) is invoked to create a notification record in the `notifications` table (specified in PRD-08). The notification payload contains: `recipient_id`, `recipient_type`, `conversation_id`, `message_id`, `sender_display_name`, and `message_preview` (first 80 characters of content). The messaging system creates this record; PRD-08 handles delivery (email, push, SMS).

**F-21: No notification for own messages**

The notification trigger checks `sender_id != recipient_id` before creating a notification record. A user does not get notified of their own messages.

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Requirement | Target |
|-------------|--------|
| Conversation list query | < 100ms p95 |
| Message thread initial load (50 messages) | < 150ms p95 |
| Message insert (Server Action round-trip) | < 300ms p95 |
| Realtime delivery latency | < 500ms p95 |
| Unread count query | < 50ms p95 — served from indexed column |

### 4.2 Scalability

The indexes defined in Section 5 support these query patterns at the expected scale of CostFinders v1 (< 10,000 businesses, < 100,000 messages in the first 12 months). Message pagination (Section 3.3, F-09) prevents any single thread from degrading page load as it grows.

### 4.3 Security

- RLS enforces that only the two participants of a conversation can read or write messages. No business can see another business's conversations. No consumer can see another consumer's conversations.
- `sender_type` is server-derived, never client-supplied. The Server Action reads the session and looks up the actor's role from the database before inserting.
- Message content is stored as plain text. No XSS vectors from stored content since it is rendered via React's text nodes, not `dangerouslySetInnerHTML`.
- Content length is validated server-side before the insert attempt.

### 4.4 Reliability

- Server Actions use Supabase's transaction-safe insert. If the insert fails, the function throws and the client receives an error.
- There is no message queue or retry mechanism in v1. Failed sends require the user to manually retry.
- Realtime subscription errors are surfaced as a subtle "Reconnecting..." indicator in the thread header. Lost events are reconciled by a refetch of the last N messages when the connection is restored.

### 4.5 Compliance

- Messages are stored with timestamps and participant IDs. This record is sufficient for basic dispute resolution.
- No PII beyond user IDs is stored in the messages table itself. Display names and contact info are fetched from the users/businesses tables at query time.
- Message content is not currently encrypted at the column level (Supabase stores at-rest encryption at the infrastructure level). Column-level encryption is out of scope for v1.

---

## 5. Database Schema

### 5.1 Full Schema SQL

```sql
-- ============================================================
-- CONVERSATIONS TABLE
-- One row per claim. Created when a claim is made.
-- ============================================================

CREATE TABLE public.conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  consumer_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id     uuid NOT NULL,  -- references the platform business UUID, not master_business_info.business_id
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  last_message_at timestamptz,    -- NULL until first message; updated by trigger
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversations_claim_id_unique UNIQUE (claim_id)
);

COMMENT ON TABLE public.conversations IS
  'One conversation per claim. Auto-created on claim. Never deleted — archived instead.';

COMMENT ON COLUMN public.conversations.business_id IS
  'The platform UUID for the business owner account, not the master_business_info bigint PK.';

COMMENT ON COLUMN public.conversations.last_message_at IS
  'Denormalized for sort performance. Updated by trigger on message insert.';


-- ============================================================
-- MESSAGES TABLE
-- One row per message in a conversation.
-- ============================================================

CREATE TABLE public.messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type     text NOT NULL CHECK (sender_type IN ('business', 'consumer')),
  content         text NOT NULL CHECK (
                    char_length(content) >= 1 AND
                    char_length(content) <= 2000
                  ),
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz             -- NULL = unread by recipient
);

COMMENT ON TABLE public.messages IS
  'Immutable after insert. No UPDATE or DELETE by application code.';

COMMENT ON COLUMN public.messages.read_at IS
  'Set by the recipient when they open the thread. NULL means unread.';


-- ============================================================
-- INDEXES
-- ============================================================

-- Primary query: load all messages for a conversation, chronological
CREATE INDEX idx_messages_conversation_created
  ON public.messages (conversation_id, created_at ASC);

-- Unread count query: count unread per conversation for a given sender_type
CREATE INDEX idx_messages_unread
  ON public.messages (conversation_id, sender_type, read_at)
  WHERE read_at IS NULL;

-- Conversation list for a business (sorted by last activity)
CREATE INDEX idx_conversations_business_last
  ON public.conversations (business_id, last_message_at DESC NULLS LAST);

-- Conversation list for a consumer
CREATE INDEX idx_conversations_consumer_last
  ON public.conversations (consumer_id, last_message_at DESC NULLS LAST);

-- Look up conversation by claim (unique constraint covers this, but explicit index aids planner)
CREATE INDEX idx_conversations_claim
  ON public.conversations (claim_id);


-- ============================================================
-- TRIGGER: update last_message_at on insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_at = NEW.created_at,
    updated_at      = now(),
    -- Unarchive if a new message arrives in an archived conversation
    status          = CASE WHEN status = 'archived' THEN 'active' ELSE status END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_after_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();


-- ============================================================
-- TRIGGER: create conversation on claim insert
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_conversation_on_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.conversations (claim_id, consumer_id, business_id)
  VALUES (NEW.id, NEW.consumer_id, NEW.business_id)
  ON CONFLICT (claim_id) DO NOTHING;
  -- ON CONFLICT handles the unlikely case of a duplicate trigger fire

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_claims_after_insert
  AFTER INSERT ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.create_conversation_on_claim();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations: only participants can see their conversations
CREATE POLICY "conversations_participant_select"
  ON public.conversations
  FOR SELECT
  USING (
    auth.uid() = consumer_id
    OR auth.uid() = business_id
  );

-- Conversations: only participants can update (archive/unarchive)
-- Only the business can archive — enforced in application layer;
-- RLS here just ensures no third party can update.
CREATE POLICY "conversations_participant_update"
  ON public.conversations
  FOR UPDATE
  USING (
    auth.uid() = consumer_id
    OR auth.uid() = business_id
  )
  WITH CHECK (
    auth.uid() = consumer_id
    OR auth.uid() = business_id
  );

-- Conversations: system/trigger can insert (SECURITY DEFINER function handles this)
CREATE POLICY "conversations_system_insert"
  ON public.conversations
  FOR INSERT
  WITH CHECK (true);
  -- The trigger function uses SECURITY DEFINER, bypassing RLS.
  -- Direct inserts from the client are blocked by the application layer.

-- Messages: only participants of the parent conversation can read
CREATE POLICY "messages_participant_select"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.consumer_id = auth.uid() OR c.business_id = auth.uid())
    )
  );

-- Messages: only participants can insert, and only as themselves
CREATE POLICY "messages_participant_insert"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.consumer_id = auth.uid() OR c.business_id = auth.uid())
    )
  );

-- Messages: only participants can update read_at (mark as read)
-- They can only update messages sent by the other party.
CREATE POLICY "messages_participant_update_read"
  ON public.messages
  FOR UPDATE
  USING (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.consumer_id = auth.uid() OR c.business_id = auth.uid())
    )
  )
  WITH CHECK (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.consumer_id = auth.uid() OR c.business_id = auth.uid())
    )
  );

-- No DELETE policy — messages are immutable.
```

### 5.2 Schema Notes

**Why UUID for `business_id` in conversations, not the `master_business_info` bigint?**
The `master_business_info` table stores scraped business data. The messaging system needs to link to the authenticated _user_ who owns the business (the business owner account), not the raw scraped record. When a business claims their profile, their auth UID becomes the `business_id` in conversations. The relationship to `master_business_info` is maintained separately in the business profile table (out of scope here).

**Why no `DELETE` RLS policy?**
Messages are an immutable audit trail. If a user wants to "delete" a conversation, the business can archive it. No message content is ever purged in v1. This protects the platform in dispute scenarios.

**Why `ON DELETE CASCADE` on `conversations.claim_id`?**
If a claim is deleted (which should be rare and admin-initiated only), the associated conversation and all its messages should also be removed. Without cascade, orphaned conversations would accumulate. In practice, claims should be cancelled (status change), not deleted.

---

## 6. API Design

All data operations use Next.js Server Actions located in `src/lib/actions/messaging.ts`. There are no REST API routes for this feature — Server Actions provide type-safe RPC with built-in authentication context.

### 6.1 Server Action: `getConversations`

```typescript
// src/lib/actions/messaging.ts

'use server'

/**
 * Fetch all conversations for the current user.
 * Returns conversations with last message preview and unread count.
 * Ordered by last_message_at DESC.
 *
 * @param actorType - 'business' | 'consumer'. Determines which column to filter on
 *                    and which sender_type counts as "unread for me".
 */
export async function getConversations(
  actorType: 'business' | 'consumer'
): Promise<ConversationWithPreview[]>
```

**Query logic:**

```sql
SELECT
  c.id,
  c.claim_id,
  c.consumer_id,
  c.business_id,
  c.status,
  c.last_message_at,
  c.created_at,
  -- Last message preview
  (
    SELECT json_build_object(
      'id', m.id,
      'content', m.content,
      'sender_type', m.sender_type,
      'created_at', m.created_at
    )
    FROM public.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) AS last_message,
  -- Unread count (messages from the other party that are unread)
  (
    SELECT COUNT(*)::int
    FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.sender_type != $actorType   -- messages from the other side
      AND m.read_at IS NULL
  ) AS unread_count
FROM public.conversations c
WHERE
  CASE
    WHEN $actorType = 'business' THEN c.business_id = auth.uid()
    ELSE c.consumer_id = auth.uid()
  END
ORDER BY c.last_message_at DESC NULLS LAST
```

### 6.2 Server Action: `getMessages`

```typescript
/**
 * Fetch messages for a conversation with cursor-based pagination.
 *
 * @param conversationId - UUID of the conversation
 * @param cursor         - created_at of the oldest loaded message (for "load earlier")
 * @param limit          - page size, default 50
 */
export async function getMessages(
  conversationId: string,
  cursor?: string,
  limit?: number
): Promise<Message[]>
```

Returns messages ordered by `created_at ASC`. When `cursor` is provided (user scrolling up), fetches messages with `created_at < cursor`.

### 6.3 Server Action: `sendMessage`

```typescript
/**
 * Insert a new message. Derives sender_id and sender_type from the session.
 * Returns the persisted message record on success.
 * Throws if:
 *   - user is not a participant of the conversation
 *   - content is empty or > 2000 chars
 *   - conversation does not exist
 */
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<Message>
```

**Implementation steps:**
1. Get session user from `supabase.auth.getUser()`.
2. Look up the conversation — verify the caller is `consumer_id` or `business_id`.
3. Derive `sender_type` from which column matched the caller's `auth.uid()`.
4. Validate `content.trim().length` is between 1 and 2000.
5. Insert into `messages`. RLS enforces participant check redundantly.
6. Return the inserted row.

### 6.4 Server Action: `markMessagesRead`

```typescript
/**
 * Mark all unread messages from the other party as read in a conversation.
 * Called when the user opens a thread.
 *
 * @param conversationId - UUID of the conversation
 */
export async function markMessagesRead(
  conversationId: string
): Promise<void>
```

Executes: `UPDATE messages SET read_at = NOW() WHERE conversation_id = $1 AND sender_id != auth.uid() AND read_at IS NULL`

### 6.5 Server Action: `archiveConversation`

```typescript
/**
 * Set conversation status to 'archived'. Business-only operation.
 * Returns the updated conversation.
 * Throws if the caller is not the business_id of the conversation.
 */
export async function archiveConversation(
  conversationId: string
): Promise<Conversation>
```

### 6.6 Server Action: `unarchiveConversation`

```typescript
/**
 * Set conversation status back to 'active'. Business-only operation.
 * Returns the updated conversation.
 */
export async function unarchiveConversation(
  conversationId: string
): Promise<Conversation>
```

### 6.7 TypeScript Types

```typescript
// src/types/messaging.ts
// Replace the current src/types/message.ts once the real backend is wired

export type ConversationStatus = 'active' | 'archived'

export interface Conversation {
  id: string                     // uuid
  claimId: string                // uuid FK to claims
  consumerId: string             // uuid FK to auth.users
  businessId: string             // uuid FK to business owner account
  status: ConversationStatus
  lastMessageAt: string | null   // ISO 8601
  createdAt: string
  updatedAt: string
}

export interface ConversationWithPreview extends Conversation {
  lastMessage: MessagePreview | null
  unreadCount: number
}

export interface MessagePreview {
  id: string
  content: string
  senderType: 'business' | 'consumer'
  createdAt: string
}

export interface Message {
  id: string                     // uuid
  conversationId: string         // uuid FK to conversations
  senderId: string               // uuid FK to auth.users
  senderType: 'business' | 'consumer'
  content: string
  createdAt: string              // ISO 8601
  readAt: string | null          // ISO 8601, null = unread
}
```

**Note on the current `Message` type in `src/types/message.ts`:** The existing type uses `claimId` as the conversation identifier. The new type uses `conversationId`. The migration section (12.1) addresses this transition. The existing mock data functions in `src/lib/mock-data/messages.ts` are replaced entirely — they are not adapted.

---

## 7. Supabase Realtime Design

### 7.1 Channel Strategy

Supabase Realtime supports row-level filtering on `postgres_changes` subscriptions. Each conversation gets its own channel, keyed by `conversation_id`. Both participants subscribe to the same channel when they have that conversation's thread open.

**Channel naming convention:**
```
conversation:{conversation_id}
```

Example: `conversation:3a9f1b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c`

### 7.2 Client Subscription (in `messageThread.tsx`)

```typescript
// Conceptual — exact API follows @supabase/supabase-js docs at implementation time

useEffect(() => {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const newMessage = payload.new as Message
        setMessages((prev) => {
          // Replace optimistic message if it matches (same content + sender, no ID yet)
          // Or append as new incoming message
          const isOptimistic = prev.some(
            (m) => m.id.startsWith('optimistic-') && m.content === newMessage.content
          )
          if (isOptimistic) {
            return prev.map((m) =>
              m.id.startsWith('optimistic-') && m.content === newMessage.content
                ? newMessage
                : m
            )
          }
          return [...prev, newMessage]
        })
        // If this is a message from the other party, mark it read immediately
        if (newMessage.senderId !== currentUserId) {
          markMessagesRead(conversationId)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [conversationId, currentUserId])
```

### 7.3 Conversation List Subscription (in messages page)

The conversation list subscribes to changes on the `conversations` table filtered by the current user's business ID. This keeps the `last_message_at`, `unread_count`, and conversation ordering up to date without polling.

```typescript
// Conceptual

useEffect(() => {
  const channel = supabase
    .channel(`business-conversations:${businessId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `business_id=eq.${businessId}`,
      },
      () => {
        // Re-fetch the conversation list on any update
        // (last_message_at changed, status changed, etc.)
        refreshConversations()
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [businessId])
```

### 7.4 Global Unread Badge Subscription

The navigation sidebar subscribes to message inserts filtered to conversations where the current business is a participant. When a new message arrives from a consumer (`sender_type = 'consumer'`), the unread count increments. When `markMessagesRead` succeeds, the count decrements.

This can be implemented as a lightweight subscription on the `messages` table with a filter on `conversation_id IN (select id from conversations where business_id = $businessId)`. However, Supabase Realtime does not support subquery filters natively. The practical approach is:

**Option A (recommended for v1):** Subscribe to `conversations` table UPDATE events for the business. When `last_message_at` changes, refetch the global unread count with a single `SELECT SUM(unread_count) ...` query. This adds one database round-trip per new message but avoids subscription complexity.

**Option B (v2 consideration):** Maintain a `total_unread` denormalized column on a `business_messaging_stats` table, updated by trigger. Subscribe to that single row. Reduces round-trips but adds schema complexity.

Use Option A for v1.

### 7.5 Connection Recovery

Supabase Realtime connections drop on network interruption. The client SDK reconnects automatically. On reconnection, the channel re-subscribes. To handle missed events during the gap, add a `refetch` call after reconnection:

```typescript
.on('system', { event: 'RECONNECTED' }, () => {
  // Fetch messages since last known message ID
  fetchMessagesSince(lastKnownMessageId)
})
```

---

## 8. Frontend Integration

### 8.1 Files to Modify

| File | Change |
|------|--------|
| `src/components/features/messaging/messageThread.tsx` | Replace mock data calls with Server Actions + Realtime subscription |
| `src/app/business/dashboard/messages/page.tsx` | Replace `getConversationsForBusiness()` with `getConversations('business')` Server Action |
| `src/types/message.ts` | Deprecate; new types in `src/types/messaging.ts` |
| `src/lib/mock-data/messages.ts` | Remove all exports once wired (or keep behind a `NEXT_PUBLIC_USE_MOCK` flag during transition) |
| `src/lib/mock-data/index.ts` | Remove messaging exports |
| `src/components/layout/` (sidebar nav) | Wire unread badge to real count from `getConversations` |

### 8.2 New Files

| File | Purpose |
|------|---------|
| `src/lib/actions/messaging.ts` | All Server Actions (Section 6) |
| `src/types/messaging.ts` | TypeScript types (Section 6.7) |
| `src/components/features/messaging/CONTEXT.md` | Module context doc (per CLAUDE.md convention for 3+ file modules) |

### 8.3 `messageThread.tsx` Integration Pattern

The existing component signature is:

```typescript
interface MessageThreadProps {
  claimId: string
  currentUserId: string
  currentUserType: 'business' | 'consumer'
}
```

This needs one addition — `conversationId` — because the real database uses conversation UUIDs, not claim IDs, as the primary messaging key. The claim ID is still needed for display context (deal title, etc.) but not for message queries.

Updated signature:

```typescript
interface MessageThreadProps {
  conversationId: string   // new — required for Supabase queries
  claimId: string          // retained for display context
  currentUserId: string
  currentUserType: 'business' | 'consumer'
}
```

Callers that currently pass `claimId` will need to resolve the `conversationId` from the claim — this is a one-time lookup when the lead detail page or messages page loads the conversation.

### 8.4 Optimistic Send Pattern

To keep the UI feeling fast, the send flow is:

1. User submits message.
2. Component immediately appends an optimistic message object with a temporary ID (e.g., `optimistic-${Date.now()}`), `createdAt = new Date().toISOString()`, and `readAt = null`.
3. `sendMessage` Server Action fires.
4. On success: the Realtime subscription receives the INSERT event for the newly persisted message. The optimistic entry is replaced with the real record (matched by content + sender).
5. On failure: the optimistic entry is removed, and a toast error is shown: "Message couldn't be sent. Try again."

This pattern is already partially implemented in `messageThread.tsx` via the `setTimeout` mock — the real implementation replaces the timeout with the async Server Action.

### 8.5 Unread Badge Wiring

The business sidebar nav item for Messages currently has no badge. Post-integration:

1. The messages page (or a layout component wrapping the dashboard) fetches `getConversations('business')` on mount.
2. The total unread count is passed as a prop or via context to the sidebar nav item.
3. The badge renders when `totalUnread > 0`, capped at "99+".
4. The Realtime conversation subscription (Section 7.3) triggers a re-count when any conversation updates.

The sidebar component (`src/components/layout/`) is in scope for modification. The badge UI already exists in the design system (`Badge` component).

### 8.6 Consumer-Side Messaging (Future)

The consumer dashboard (`/dashboard/claims`) currently shows claim status but no messaging interface. The data layer from this PRD supports a consumer thread view without schema changes. When that UI is built:

- Call `getConversations('consumer')` to list threads.
- Call `getMessages(conversationId)` to load a thread.
- Use the same `messageThread.tsx` component with `currentUserType = 'consumer'`.
- The same Realtime subscription pattern applies.

---

## 9. User Stories and Acceptance Criteria

---

### US-01: Conversation auto-created on claim

**As a** consumer who claimed a deal,
**I want** a messaging channel to exist immediately after my claim,
**so that** I can start a conversation with the business without any extra steps.

**Acceptance Criteria:**

- Given a consumer submits a valid deal claim,
- When the claim record is inserted into the database,
- Then a `conversations` row is created with `claim_id = claim.id`, `consumer_id = claim.consumer_id`, `business_id = claim.business_id`, and `status = 'active'`.

- Given a claim already has an associated conversation,
- When the claim creation trigger fires again (idempotent scenario),
- Then no duplicate conversation is created (`ON CONFLICT DO NOTHING`).

---

### US-02: Business sends a message to a consumer

**As a** business owner viewing a lead detail,
**I want** to type and send a message to the consumer who claimed my deal,
**so that** I can answer their questions and schedule an appointment.

**Acceptance Criteria:**

- Given I am authenticated as the business owner of the claim,
- When I type a message and submit it,
- Then the message is persisted in the `messages` table with `sender_type = 'business'`, `sender_id = my auth uid`, and `read_at = NULL`.

- Given I submit an empty message (whitespace only),
- When I attempt to send,
- Then the send button is disabled and no Server Action is called.

- Given I type more than 2000 characters,
- When I attempt to send,
- Then the Server Action returns a validation error and no row is inserted.

- Given the Server Action fails (network error, DB timeout),
- When the failure is caught,
- Then the optimistic message is removed from the UI and a toast shows "Message couldn't be sent. Try again."

---

### US-03: Consumer receives a new message in real time

**As a** consumer with the conversation thread open,
**I want** new messages from the business to appear without refreshing the page,
**so that** the conversation feels responsive and live.

**Acceptance Criteria:**

- Given I have a conversation thread open,
- When the business sends a message,
- Then the new message appears in my thread within 500ms (p95), without a manual refresh.

- Given the new message arrives via Realtime,
- When the message renders,
- Then it is left-aligned with the other party's styling, showing the correct timestamp.

---

### US-04: Unread messages are marked as read when viewed

**As a** business owner who opens a conversation thread,
**I want** unread messages to be marked as read automatically,
**so that** my unread badge accurately reflects conversations I have not yet seen.

**Acceptance Criteria:**

- Given there are unread consumer messages in a conversation,
- When I navigate to that conversation thread,
- Then `markMessagesRead` is called and all consumer messages in that thread have `read_at` set to the current timestamp.

- Given I have already read all messages in a conversation,
- When I open that conversation again,
- Then no UPDATE is performed (no unread messages to mark).

---

### US-05: Unread count badge on navigation

**As a** business owner,
**I want** to see an unread count badge on the Messages nav item,
**so that** I know when consumers have sent messages I have not yet read.

**Acceptance Criteria:**

- Given one or more conversations have unread consumer messages,
- When the business dashboard loads,
- Then the Messages nav item shows a badge with the total count of unread messages across all conversations.

- Given the unread count is greater than 99,
- When the badge renders,
- Then it displays "99+" not the full number.

- Given I open a conversation and the messages are marked as read,
- When I return to the conversation list,
- Then the badge count decreases by the number of messages that were just read.

---

### US-06: Business archives a resolved conversation

**As a** business owner,
**I want** to archive a conversation once the appointment is booked or the deal is complete,
**so that** my messages inbox stays focused on active conversations.

**Acceptance Criteria:**

- Given I am viewing a conversation,
- When I click "Archive conversation",
- Then the conversation `status` is set to `'archived'` in the database.

- Given a conversation is archived,
- When I view the "All" tab on the messages page,
- Then the archived conversation is not visible.

- Given an archived conversation receives a new message,
- When the Realtime trigger fires and the DB trigger updates `last_message_at`,
- Then the conversation `status` is automatically set back to `'active'` and it reappears in the "All" tab.

---

### US-07: Paginated message history

**As a** business owner viewing a long conversation thread,
**I want** to scroll up to load earlier messages,
**so that** the initial page load is fast even for conversations with many messages.

**Acceptance Criteria:**

- Given a conversation has more than 50 messages,
- When I open the thread,
- Then only the most recent 50 messages load initially.

- Given there are earlier messages not yet loaded,
- When I scroll to the top of the thread,
- Then a "Load earlier messages" trigger fires and fetches the previous page, prepending them to the thread without resetting scroll position.

- Given I have loaded all messages,
- When I scroll to the top,
- Then the "Load earlier" trigger is not shown (no more pages).

---

## 10. Edge Cases and Error Handling

### 10.1 Network and Connectivity

| Scenario | Expected Behavior |
|----------|------------------|
| Message send fails mid-flight (network drops after submit) | Optimistic message is removed from UI. Toast: "Message couldn't be sent. Try again." The send button re-enables. |
| Realtime connection drops while thread is open | A subtle "Reconnecting..." indicator appears in the thread header. On reconnection, messages since the last known message ID are re-fetched. |
| User opens thread while offline | Loading state shown. Server Action throws. Error state shown: "Couldn't load messages. Check your connection." |
| Duplicate send (user taps send twice quickly) | The send button is disabled while `isSending = true`. The second tap is ignored. |

### 10.2 Data Integrity

| Scenario | Expected Behavior |
|----------|------------------|
| Consumer tries to message a business directly (no claim) | No conversation exists. The UI never exposes a compose interface without a valid `conversationId`. Even if a direct API call is attempted, the RLS INSERT policy on `messages` rejects it because no matching conversation exists with the caller as a participant. |
| Business tries to read another business's conversation | RLS `SELECT` policy returns zero rows. The application receives an empty result, not an error. |
| Two simultaneous messages from the same sender | Both inserts succeed. They are ordered by `created_at`. If the timestamps collide (< 1ms apart), order is arbitrary but both are stored. |
| Message inserted but Realtime event missed | Recipient does not see it in real time. On next page load or tab focus, the thread re-fetches and displays the message. The `last_message_at` on the conversation ensures the conversation list shows the conversation as updated. |
| Claim is cancelled after conversation is created | The conversation and its messages remain. Claim cancellation does not trigger cascade delete. The conversation is accessible but the claim shows "Cancelled" status. Messaging can continue (the business may still want to offer rescheduling). |
| Claim is hard-deleted (admin action) | `ON DELETE CASCADE` on `conversations.claim_id` removes the conversation and all messages. Admin tools must warn before hard-deleting claims. |

### 10.3 Content Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| Message content is 2000 characters exactly | Accepted. |
| Message content is 2001 characters | Rejected by Server Action validation before DB insert. Error returned: "Message is too long (max 2000 characters)." |
| Message content is only whitespace | Rejected. The `content.trim().length < 1` check fires. Send button remains disabled. |
| Message contains `<script>` tags or HTML | Stored as plain text. React renders it as a text node, not HTML. No XSS risk. |
| Very long single word (no spaces, 2000 chars) | CSS `break-words` on the message bubble (already in the existing component) prevents overflow. |
| Emoji-heavy message | Stored and displayed correctly. UTF-8 encoding in Postgres handles emoji without issues. |

### 10.4 Realtime Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| Sender's own message arrives via Realtime | The optimistic message is replaced with the real record. No duplicate is shown. The matching logic uses content + sender_type combination. If two identical messages are sent in rapid succession (unlikely), the first optimistic entry is replaced and the second is appended. |
| Recipient is not subscribed (app not open) | Message is stored. When they next open the conversation, the thread loads it via `getMessages`. The Realtime event is simply missed — no recovery needed because the DB is the source of truth. |
| Multiple tabs open by same user | Both tabs receive the Realtime event. Both call `markMessagesRead`. The second UPDATE is a no-op (already `read_at IS NOT NULL`). |

---

## 11. Security and Access Control

### 11.1 RLS Summary

| Table | Operation | Policy Rule |
|-------|-----------|-------------|
| `conversations` | SELECT | `auth.uid() = consumer_id OR auth.uid() = business_id` |
| `conversations` | UPDATE | Same as SELECT |
| `conversations` | INSERT | Via `SECURITY DEFINER` trigger only |
| `messages` | SELECT | Caller is participant of parent conversation |
| `messages` | INSERT | `sender_id = auth.uid()` AND caller is participant |
| `messages` | UPDATE | Caller is participant AND `sender_id != auth.uid()` (can only mark others' messages as read) |
| `messages` | DELETE | No policy — blocked |

### 11.2 Server Action Security

- Every Server Action calls `supabase.auth.getUser()` as its first operation. If no session, it throws `AuthError`. It does not rely on client-passed user IDs.
- `sender_type` is never accepted as a parameter. It is derived by looking up which column (`consumer_id` or `business_id`) the caller's UID matches in the conversation record.
- Rate limiting is not in scope for v1 but should be added before public launch. Target: 60 messages per conversation per hour per sender.

### 11.3 Content Moderation

- No automated content moderation in v1.
- Admin panel (existing at `/admin/dashboard`) should have a future "Reported messages" queue. The `messages` table has a `read_at` field that could be repurposed or a separate `reported_at` field added in v2.
- Users can report messages via a future report button. Out of scope for this PRD.

---

## 12. Migration from Mock Data

### 12.1 Transition Strategy

The mock data layer (`src/lib/mock-data/messages.ts`) and the real Server Actions can coexist during development via a feature flag:

```typescript
// src/lib/config.ts
export const USE_MOCK_MESSAGING = process.env.NEXT_PUBLIC_USE_MOCK === 'true'
```

The messaging components import from an adapter:

```typescript
// src/lib/messaging-adapter.ts
import { USE_MOCK_MESSAGING } from './config'

export const messagingApi = USE_MOCK_MESSAGING
  ? require('./mock-data/messages')   // existing mock functions
  : require('./actions/messaging')    // new Server Actions
```

This allows local development without a wired Supabase session while the real implementation is built. Once the real implementation is validated against a staging environment, remove the flag and delete `src/lib/mock-data/messages.ts`.

### 12.2 Data Model Mapping

The existing mock `Message` type maps to the new schema as follows:

| Mock field | Real column | Notes |
|------------|------------|-------|
| `id` | `messages.id` | UUID instead of `msg-1` style strings |
| `claimId` | `messages.conversation_id` | Indirect — claim → conversation → messages |
| `senderId` | `messages.sender_id` | Auth UUID instead of `user-1`, `biz-1` |
| `senderType` | `messages.sender_type` | Same values |
| `content` | `messages.content` | Same |
| `createdAt` | `messages.created_at` | Same format |
| `readAt` | `messages.read_at` | Same semantics |

The `ConversationSummary` interface exported from mock data is replaced by `ConversationWithPreview` from `src/types/messaging.ts`.

### 12.3 Component Change Surface

The following components call mock data functions that must be replaced:

| Component | Mock call | Replacement |
|-----------|-----------|-------------|
| `messageThread.tsx` | `getMessagesForClaim(claimId)` | `getMessages(conversationId)` Server Action |
| `messageThread.tsx` | `sendMessage(claimId, content, type, id)` | `sendMessage(conversationId, content)` Server Action |
| `messages/page.tsx` | `getConversationsForBusiness(businessId)` | `getConversations('business')` Server Action |

The `markMessagesRead` call is new — it does not replace an existing mock call because the mock does not persist reads across sessions.

---

## 13. Out of Scope (v1)

These items are explicitly deferred. They should not be implemented as part of this PRD's delivery.

| Feature | Reason for Deferral |
|---------|---------------------|
| File attachments (images, PDFs) | Requires Supabase Storage integration, content moderation, file type validation. Adds significant scope. |
| Typing indicators | Requires a Presence channel in Supabase Realtime, which is a separate subscription type. Low conversion impact vs. implementation effort. |
| Canned responses for businesses | A nice-to-have UX feature. Can be added as a client-only UI enhancement once the real data layer is live. |
| Consumer-facing messaging UI (page at `/dashboard/messages`) | The data layer supports it. The UI page is a separate deliverable not blocked by this PRD. |
| Message search | Full-text search on `messages.content` requires a GIN index and a new query. Deferred to v2. |
| Message read receipts displayed to sender | "Seen" labels in the thread. Low priority; `read_at` data is already captured. |
| Rate limiting on sends | Architecture-level concern. Should be added before public launch but is not part of the messaging schema work. |
| Column-level encryption for message content | Infrastructure-level concern. Supabase handles at-rest encryption at the storage level. |
| Group messaging | CostFinders is a two-party platform (one business, one consumer per claim). Groups are not applicable. |
| Message deletion by users | Messages are an immutable audit trail. Businesses can archive conversations but cannot delete messages. |
| Native push notifications | Handled by PRD-08. |
| Admin message oversight / moderation queue | Separate admin feature. Out of scope for this PRD. |

---

## 14. Open Questions

| # | Question | Owner | Resolution Target |
|---|----------|-------|------------------|
| Q1 | What is the Supabase Auth UUID column name for business owner accounts? The mock data uses string IDs like `biz-1`. The real business owner table needs to be confirmed before the `conversations.business_id` FK can be finalized. | Backend | Before schema migration |
| Q2 | Does the `claims` table already exist in Supabase, or does it need to be created as part of this PRD's migration? The DATABASE.md only documents `master_business_info` and `promo_offer_master`. If `claims` does not exist, its schema must be specified separately. | Backend | Before schema migration |
| Q3 | Should the `create_conversation_on_claim` trigger also fire for claims that were created before this migration (backfill)? If so, a one-time data migration script is needed. | Product | Before schema migration |
| Q4 | Is there a consumer-facing messaging entry point to specify? The consumer can currently see claim status at `/dashboard/claims` but cannot send messages. Should a message thread be embedded there, or does the consumer get a separate `/dashboard/messages` page? This affects how `conversationId` is resolved from the consumer side. | Product | Before frontend wiring |
| Q5 | PRD-08 (Notifications) is listed as a dependency for the notification trigger contract (F-20). What is the target delivery date for PRD-08? Message notifications cannot be wired until the `notifications` table schema is confirmed. | Product | Before notification wiring |
| Q6 | What is the expected message volume per conversation? If large medical spa businesses receive hundreds of claims per month, threads could grow to thousands of messages. Confirm pagination (50 per page) is sufficient or adjust. | Product | Before launch |

---

## Appendix A: File Tree Summary

```
src/
  lib/
    actions/
      messaging.ts              # NEW — Server Actions
    mock-data/
      messages.ts               # REMOVE after migration
  types/
    message.ts                  # DEPRECATE
    messaging.ts                # NEW — canonical types
  components/
    features/
      messaging/
        messageThread.tsx       # MODIFY — wire to real data + Realtime
        CONTEXT.md              # NEW — module context doc
  app/
    business/
      dashboard/
        messages/
          page.tsx              # MODIFY — wire to getConversations
```

---

## Appendix B: Supabase Realtime Channel Reference

| Channel name | Table | Filter | Event | Subscriber |
|-------------|-------|--------|-------|-----------|
| `conversation:{conversationId}` | `messages` | `conversation_id=eq.{id}` | INSERT | Both participants when thread is open |
| `business-conversations:{businessId}` | `conversations` | `business_id=eq.{id}` | UPDATE | Business dashboard messages page |
| `consumer-conversations:{consumerId}` | `conversations` | `consumer_id=eq.{id}` | UPDATE | Consumer dashboard (future) |

---

## Appendix C: Notification Trigger Contract (for PRD-08)

When a message is inserted, the following data is available to the notification system:

```typescript
interface MessageNotificationPayload {
  recipientId: string           // auth UUID of the recipient
  recipientType: 'business' | 'consumer'
  conversationId: string
  messageId: string
  senderDisplayName: string     // resolved at trigger time
  messagePreview: string        // first 80 chars of content
  claimId: string               // for deep-link in notification
  dealTitle: string             // for notification body text
}
```

The delivery mechanism (email subject, push body, SMS template) is defined in PRD-08. This PRD only defines what data is passed. The suggested notification copy, following the Messaging Style Guide, is:

- **Business receives consumer message:** "New message from {{consumer_first_name}} about {{deal_title}}"
- **Consumer receives business message:** "{{business_name}} replied to your claim"

---

*This document is a living specification. Update it when edge cases are resolved, Q&A items are answered, or scope changes are approved.*
