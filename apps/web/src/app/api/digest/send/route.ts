import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { buildBriefing } from '@/lib/briefing'
import { emailEnabled, renderDigest, sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Envía el briefing por email a los perfiles suscritos. Disparado por el cron de
// Coolify (igual que /api/ingest), protegido con Authorization: Bearer $INGEST_TOKEN.
async function run(): Promise<{ sent: number; skipped: number; recipients: number }> {
  if (!emailEnabled()) return { sent: 0, skipped: 0, recipients: 0 }

  // Destinatarios opt-in que no han recibido el digest en las últimas 18h.
  const { rows: subs } = await query<{ id: string; email: string; digest_lang: string }>(
    `SELECT id, email, digest_lang FROM profiles
      WHERE digest_optin = true AND email IS NOT NULL
        AND (digest_sent_at IS NULL OR digest_sent_at < now() - interval '18 hours')`,
  )
  if (subs.length === 0) return { sent: 0, skipped: 0, recipients: 0 }

  // El briefing es el mismo para todos; se construye una sola vez por idioma.
  const cache: Record<string, Awaited<ReturnType<typeof buildBriefing>>> = {}
  let sent = 0
  let skipped = 0
  for (const s of subs) {
    const lang = s.digest_lang === 'en' ? 'en' : 'es'
    if (!cache[lang]) cache[lang] = await buildBriefing()
    const items = cache[lang]
    if (items.length === 0) {
      skipped++
      continue
    }
    const { subject, html } = renderDigest(items, lang, s.id)
    const ok = await sendEmail(s.email, subject, html)
    if (ok) {
      sent++
      await query(`UPDATE profiles SET digest_sent_at = now() WHERE id = $1`, [s.id])
    } else {
      skipped++
    }
  }
  return { sent, skipped, recipients: subs.length }
}

export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN
  const auth = req.headers.get('authorization')
  if (token && auth !== `Bearer ${token}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}

export async function GET(req: Request) {
  const token = process.env.INGEST_TOKEN
  const url = new URL(req.url)
  if (token && url.searchParams.get('token') !== token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}
