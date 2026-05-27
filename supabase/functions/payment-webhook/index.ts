// DevEnglish Edge Function — payment-webhook
// Handles Lemon Squeezy order webhooks.
// On successful payment: sets profiles.is_paid = true, profiles.paid_at = now().
//
// Lemon Squeezy dashboard setup:
//   Webhook URL : https://<project>.supabase.co/functions/v1/payment-webhook
//   Events      : order_created, subscription_payment_success
//   Signing key : set as LEMON_SQUEEZY_WEBHOOK_SECRET env var
//
// Checkout link must include custom_data with user_id:
//   https://devenglis.lemonsqueezy.com/buy/xxx?checkout[custom][user_id]=<supabase-user-id>
import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────

// Minimal shape of the Lemon Squeezy webhook payload we care about
interface LemonSqueezyPayload {
  meta: {
    event_name: string          // e.g. 'order_created'
    custom_data?: {
      user_id?: string          // Supabase user id passed at checkout
    }
  }
  data: {
    attributes: {
      user_email?: string       // Buyer email — fallback lookup if user_id absent
      status?: string           // 'paid', 'refunded', etc.
      total?: number            // Amount in cents
      currency?: string
    }
  }
}

// ── Signature verification ────────────────────────────────────────

/**
 * Verifies the Lemon Squeezy webhook signature.
 *
 * Lemon Squeezy computes:  HMAC-SHA256(rawBody, secret)  → hex string
 * and sends it in the  X-Signature  header.
 */
async function verifySignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const enc     = new TextEncoder()
    const key     = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
    const expected = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Constant-time comparison to prevent timing attacks
    if (expected.length !== signature.length) return false
    let mismatch = 0
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return mismatch === 0
  } catch {
    return false
  }
}

// ── Helper ────────────────────────────────────────────────────────

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// ── Main handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Step 1: Read raw body (needed for signature verification) ──

  const rawBody = await req.text()
  if (!rawBody) {
    return json({ error: 'Empty request body' }, 400)
  }

  // ── Step 2: Verify Lemon Squeezy signature ─────────────────────

  const signature = req.headers.get('X-Signature') ?? ''
  const secret    = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET') ?? ''

  if (!secret) {
    console.error('LEMON_SQUEEZY_WEBHOOK_SECRET is not configured')
    return json({ error: 'Webhook secret not configured' }, 500)
  }

  if (!signature) {
    return json({ error: 'Missing X-Signature header' }, 401)
  }

  const isValid = await verifySignature(rawBody, signature, secret)
  if (!isValid) {
    console.warn('Webhook signature mismatch — possible forgery attempt')
    return json({ error: 'Invalid signature' }, 401)
  }

  // ── Step 3: Parse payload ──────────────────────────────────────

  let payload: LemonSqueezyPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400)
  }

  const eventName = payload?.meta?.event_name
  console.log(`Received Lemon Squeezy event: ${eventName}`)

  // ── Step 4: Handle relevant events only ───────────────────────

  const HANDLED_EVENTS = ['order_created', 'subscription_payment_success']
  if (!HANDLED_EVENTS.includes(eventName)) {
    // Acknowledge unhandled events without error — Lemon Squeezy will retry on non-2xx
    return json({ received: true, handled: false, event: eventName })
  }

  // For order_created we only act on paid orders
  if (eventName === 'order_created' && payload.data.attributes.status !== 'paid') {
    return json({ received: true, handled: false, reason: 'Order not paid yet' })
  }

  // ── Step 5: Identify the user ──────────────────────────────────

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const userId    = payload.meta.custom_data?.user_id
  const userEmail = payload.data.attributes.user_email

  let profileId: string | null = null

  if (userId) {
    // Primary lookup: user_id in custom_data (most reliable)
    profileId = userId
  } else if (userEmail) {
    // Fallback: look up by email in auth.users
    const { data: userList } = await admin.auth.admin.listUsers()
    const match = userList?.users?.find(
      (u) => u.email?.toLowerCase() === userEmail.toLowerCase(),
    )
    profileId = match?.id ?? null
  }

  if (!profileId) {
    // We couldn't identify the user — log for manual review, still return 200
    // so Lemon Squeezy doesn't keep retrying this legitimate webhook
    console.error(
      'Payment webhook: could not identify user.',
      JSON.stringify({ eventName, userEmail, userId }),
    )
    return json({
      received: true,
      handled: false,
      reason: 'User not found — manual review required',
    })
  }

  // ── Step 6: Mark the user as paid ─────────────────────────────

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      is_paid:  true,
      paid_at:  new Date().toISOString(),
    })
    .eq('id', profileId)

  if (updateError) {
    console.error('Failed to update profile:', updateError.message, { profileId })
    return json({ error: 'Failed to update user profile' }, 500)
  }

  console.log(`✅ User ${profileId} marked as paid (event: ${eventName})`)

  return json({ received: true, handled: true, userId: profileId })
})
