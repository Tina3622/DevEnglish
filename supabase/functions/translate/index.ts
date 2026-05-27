// DevEnglish Edge Function — translate
// Proxies DeepSeek API calls to protect the API key server-side.
// Free users: max 50 AI calls (trial_count tracked in profiles table).
// Paid users: unlimited (is_paid = true).
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────

interface TranslateRequest {
  text: string
  sourceLang?: 'zh' | 'en' | 'auto'
}

interface TranslateResult {
  translation: string   // English if Chinese input, Chinese if English input
  ipa:         string   // IPA for English word, empty string for phrases/Chinese
  definition:  string   // Chinese definition with developer context
  example:     string   // English example in developer/workplace context
  exampleZh:   string   // Chinese translation of the example
}

// ── CORS headers ──────────────────────────────────────────────────
// Required for browser clients (Supabase JS SDK adds these automatically
// for supabase.functions.invoke(), but explicit is safer).

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

// ── DeepSeek system prompt ────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a developer English learning assistant for Chinese software engineers.

Analyze the input text and return ONLY valid JSON — no markdown, no explanation.

Rules:
• If the input is Chinese (a word or sentence): translate it into natural,
  idiomatic English that a developer would use at work. Leave "ipa" empty ("").
• If the input is an English word or short phrase: provide a full learning card
  with Chinese definition, IPA, and a developer-context example sentence.
• Keep "definition" and "exampleZh" in Chinese.
• "example" must be a complete English sentence with a developer/workplace scenario.

JSON shape (all fields required, use empty string "" if not applicable):
{
  "translation": "...",
  "ipa":         "...",
  "definition":  "...",
  "example":     "...",
  "exampleZh":   "..."
}
`.trim()

// ── Main handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
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

    // Create a user-scoped client — getUser() validates the JWT via Supabase Auth
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized — invalid or expired token' }, 401)
    }

    // ── Step 2: Check quota ──────────────────────────────────────

    // Admin client bypasses RLS so we can read and update profiles
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('is_paid, trial_count')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError.message)
      return json({ error: 'Could not verify user profile' }, 500)
    }

    const isPaid      = profile?.is_paid    ?? false
    const trialCount  = profile?.trial_count ?? 0
    const FREE_LIMIT  = 50

    if (!isPaid && trialCount >= FREE_LIMIT) {
      return json(
        {
          error: 'Free quota exceeded',
          code:  'QUOTA_EXCEEDED',
          hint:  `You have used all ${FREE_LIMIT} free AI translations. Purchase DevEnglish to continue.`,
        },
        402,
      )
    }

    // ── Step 3: Parse and validate request body ──────────────────

    let body: TranslateRequest
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const text = body?.text?.trim()
    if (!text) {
      return json({ error: '"text" field is required and must be non-empty' }, 400)
    }

    // ── Step 4: Call DeepSeek API ────────────────────────────────

    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    if (!deepseekKey) {
      console.error('DEEPSEEK_API_KEY environment variable is not set')
      return json({ error: 'Translation service is not configured' }, 503)
    }

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model:           'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: text },
        ],
        temperature:     0.3,
        max_tokens:      500,
        response_format: { type: 'json_object' },
      }),
    })

    if (!dsRes.ok) {
      const errText = await dsRes.text()
      console.error(`DeepSeek error ${dsRes.status}:`, errText)
      return json({ error: 'Translation service temporarily unavailable' }, 502)
    }

    const dsData   = await dsRes.json()
    const rawContent: string = dsData?.choices?.[0]?.message?.content ?? ''

    let result: TranslateResult
    try {
      result = JSON.parse(rawContent)
    } catch {
      console.error('Failed to parse DeepSeek JSON:', rawContent)
      return json({ error: 'Unexpected response from translation service' }, 502)
    }

    // Basic validation — ensure all expected keys exist
    const requiredKeys: (keyof TranslateResult)[] = [
      'translation', 'ipa', 'definition', 'example', 'exampleZh',
    ]
    for (const key of requiredKeys) {
      if (typeof result[key] !== 'string') result[key] = ''
    }

    // ── Step 5: Increment trial_count for free users ─────────────

    if (!isPaid) {
      const { error: updateError } = await admin
        .from('profiles')
        .update({ trial_count: trialCount + 1 })
        .eq('id', user.id)

      if (updateError) {
        // Non-fatal — log but don't block the response
        console.warn('Failed to update trial_count:', updateError.message)
      }
    }

    // ── Step 6: Return result ────────────────────────────────────

    return json({
      ...result,
      // Expose remaining quota to the client for UI hints
      quotaRemaining: isPaid ? null : Math.max(0, FREE_LIMIT - trialCount - 1),
    })

  } catch (err) {
    console.error('Unhandled error in translate function:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
