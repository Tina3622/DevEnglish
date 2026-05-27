// DevEnglish Edge Function — sync
// Bidirectional flashcard sync between the client's local Dexie store
// and the Supabase flashcards table.
//
// Client sends:
//   { flashcards: LocalFlashcard[], lastSyncedAt?: number (ms) }
//
// Server responds:
//   { syncedFlashcards: CloudFlashcard[], syncedAt: number (ms) }
//
// Conflict strategy: last-write-wins based on createdAt.
// A card is "new" if it has no supabaseId; "existing" if it does.
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────

/** Shape the client sends (matches IFlashcard in engine/db/index.ts) */
interface LocalFlashcard {
  supabaseId?:   string   // uuid — present if previously synced
  word:          string
  ipa?:          string
  partOfSpeech?: string
  definition:    string
  example?:      string
  exampleZh?:    string
  scene?:        string
  masteryLevel:  number   // 0–4
  nextReviewAt:  number   // Unix ms
  reviewCount:   number
  createdAt:     number   // Unix ms
}

/** Shape stored in Supabase (snake_case columns) */
interface CloudFlashcard {
  id:              string   // uuid
  user_id:         string
  word:            string
  ipa:             string | null
  part_of_speech:  string | null
  definition:      string
  example:         string | null
  example_zh:      string | null
  scene:           string | null
  mastery_level:   number
  next_review_at:  string   // ISO timestamp
  review_count:    number
  created_at:      string   // ISO timestamp
  synced_at:       string   // ISO timestamp
}

/** What we return to the client — camelCase + supabaseId */
interface SyncedFlashcard {
  supabaseId:    string
  word:          string
  ipa:           string | null
  partOfSpeech:  string | null
  definition:    string
  example:       string | null
  exampleZh:     string | null
  scene:         string | null
  masteryLevel:  number
  nextReviewAt:  number   // Unix ms
  reviewCount:   number
  createdAt:     number   // Unix ms
  syncedAt:      number   // Unix ms
}

// ── Helpers ───────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** Convert a CloudFlashcard row back to the camelCase shape the client expects */
function toSyncedFlashcard(row: CloudFlashcard): SyncedFlashcard {
  return {
    supabaseId:   row.id,
    word:         row.word,
    ipa:          row.ipa,
    partOfSpeech: row.part_of_speech,
    definition:   row.definition,
    example:      row.example,
    exampleZh:    row.example_zh,
    scene:        row.scene,
    masteryLevel: row.mastery_level,
    nextReviewAt: new Date(row.next_review_at).getTime(),
    reviewCount:  row.review_count,
    createdAt:    new Date(row.created_at).getTime(),
    syncedAt:     new Date(row.synced_at).getTime(),
  }
}

/** Map a LocalFlashcard to a Supabase row (omit id for new cards) */
function toDbRow(
  card: LocalFlashcard,
  userId: string,
  syncedAt: string,
): Omit<CloudFlashcard, 'id'> & { id?: string } {
  return {
    ...(card.supabaseId ? { id: card.supabaseId } : {}),
    user_id:        userId,
    word:           card.word.trim().toLowerCase(),
    ipa:            card.ipa            ?? null,
    part_of_speech: card.partOfSpeech   ?? null,
    definition:     card.definition,
    example:        card.example        ?? null,
    example_zh:     card.exampleZh      ?? null,
    scene:          card.scene          ?? null,
    mastery_level:  card.masteryLevel,
    next_review_at: new Date(card.nextReviewAt).toISOString(),
    review_count:   card.reviewCount,
    created_at:     new Date(card.createdAt).toISOString(),
    synced_at:      syncedAt,
  }
}

// ── Main handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    // ── Step 1: Verify JWT ───────────────────────────────────────

    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing or malformed Authorization header' }, 401)
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized — invalid or expired token' }, 401)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // ── Step 2: Parse request body ───────────────────────────────

    let body: { flashcards?: LocalFlashcard[]; lastSyncedAt?: number }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const incomingCards: LocalFlashcard[] = Array.isArray(body?.flashcards)
      ? body.flashcards
      : []

    const lastSyncedAt: number | null =
      typeof body?.lastSyncedAt === 'number' ? body.lastSyncedAt : null

    // ── Step 3: Validate and cap incoming batch ──────────────────

    const MAX_BATCH = 500
    if (incomingCards.length > MAX_BATCH) {
      return json(
        { error: `Batch too large — maximum ${MAX_BATCH} cards per sync request` },
        400,
      )
    }

    // Filter out cards missing required fields
    const validCards = incomingCards.filter(
      (c) => c?.word?.trim() && c?.definition?.trim(),
    )

    // ── Step 4: Upsert incoming cards → Supabase ─────────────────

    const now       = new Date()
    const syncedAt  = now.toISOString()
    const syncedMs  = now.getTime()

    let upsertedRows: CloudFlashcard[] = []

    if (validCards.length > 0) {
      const rows = validCards.map((c) => toDbRow(c, user.id, syncedAt))

      // onConflict targets (user_id, word) — requires a UNIQUE constraint:
      //   ALTER TABLE flashcards ADD CONSTRAINT flashcards_user_word_unique
      //     UNIQUE (user_id, word);
      // New cards (no id) will be inserted; existing cards will update all columns.
      const { data, error: upsertError } = await admin
        .from('flashcards')
        .upsert(rows, {
          onConflict:        'user_id, word',
          ignoreDuplicates:  false,
        })
        .select()

      if (upsertError) {
        console.error('Upsert error:', upsertError.message)
        return json({ error: 'Failed to sync flashcards to cloud' }, 500)
      }

      upsertedRows = (data as CloudFlashcard[]) ?? []
    }

    // ── Step 5: Pull cards updated on other devices ──────────────
    //
    // Fetch all cards for this user whose synced_at is newer than lastSyncedAt.
    // This is how multi-device sync works: device A syncs → updates synced_at;
    // device B pulls delta → gets those cards.

    let deltaRows: CloudFlashcard[] = []

    if (lastSyncedAt !== null) {
      const lastSyncedIso = new Date(lastSyncedAt).toISOString()

      const { data: delta, error: fetchError } = await admin
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .gt('synced_at', lastSyncedIso)

      if (fetchError) {
        console.error('Delta fetch error:', fetchError.message)
        // Non-fatal — return what we have so far
      } else {
        deltaRows = (delta as CloudFlashcard[]) ?? []
      }
    }

    // Merge: start from upserted rows, then add any delta rows not already included
    const upsertedIds = new Set(upsertedRows.map((r) => r.id))
    const allRows     = [
      ...upsertedRows,
      ...deltaRows.filter((r) => !upsertedIds.has(r.id)),
    ]

    // ── Step 6: Return synced cards ──────────────────────────────

    const syncedFlashcards = allRows.map(toSyncedFlashcard)

    return json({
      syncedFlashcards,
      syncedAt:  syncedMs,
      synced:    upsertedRows.length,
      delta:     deltaRows.length,
    })

  } catch (err) {
    console.error('Unhandled error in sync function:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
