import type { BriefingItem } from '@/lib/briefing'

const RESEND_KEY = process.env.RESEND_API_KEY
const FROM = process.env.DIGEST_FROM || 'NewsHub <onboarding@resend.dev>'
export const BASE_URL =
  process.env.PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://newshub.example.com'

export function emailEnabled(): boolean {
  return Boolean(RESEND_KEY)
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  )
}

const T = {
  es: {
    subject: 'Tu briefing de NewsHub',
    heading: 'Briefing del día',
    intro: 'Las historias con más cobertura, resumidas.',
    sources: 'fuentes',
    open: 'Ver historia completa',
    unsub: 'Darse de baja',
    footer: 'Recibes esto porque te suscribiste al briefing diario de NewsHub.',
  },
  en: {
    subject: 'Your NewsHub briefing',
    heading: "Today's briefing",
    intro: 'The most-covered stories, summarized.',
    sources: 'sources',
    open: 'Read the full story',
    unsub: 'Unsubscribe',
    footer: 'You receive this because you subscribed to the NewsHub daily briefing.',
  },
}

export function renderDigest(
  items: BriefingItem[],
  lang: 'es' | 'en',
  profileId: string,
): { subject: string; html: string } {
  const t = T[lang]
  const unsubUrl = `${BASE_URL}/api/digest/unsubscribe?p=${profileId}`
  const stories = items
    .map((it, i) => {
      const bullets =
        it.bullets.length > 0
          ? `<ul style="margin:8px 0 0;padding-left:18px;color:#9a9a9a;font-size:14px;line-height:1.5">${it.bullets
              .map((b) => `<li>${esc(b)}</li>`)
              .join('')}</ul>`
          : ''
      return `
      <tr><td style="padding:18px 0;border-bottom:1px solid #232323">
        <div style="font-size:12px;color:#caa84a;font-weight:600;margin-bottom:4px">
          ${i + 1} · ${it.source_count} ${t.sources}
        </div>
        <a href="${esc(it.url)}" style="font-size:17px;font-weight:600;color:#f5f5f5;text-decoration:none;line-height:1.3">${esc(it.title)}</a>
        ${it.summary ? `<p style="margin:8px 0 0;color:#cfcfcf;font-size:15px;line-height:1.55">${esc(it.summary)}</p>` : ''}
        ${bullets}
        <div style="margin-top:10px">
          <a href="${BASE_URL}/story/${it.cluster_id}" style="font-size:13px;color:#caa84a;text-decoration:none">${t.open} →</a>
        </div>
      </td></tr>`
    })
    .join('')

  const html = `<!doctype html><html><body style="margin:0;background:#0d0d0d;padding:24px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#141414;border:1px solid #232323;border-radius:16px;padding:28px">
        <tr><td>
          <h1 style="margin:0;font-family:system-ui,sans-serif;color:#f5f5f5;font-size:22px">${t.heading}</h1>
          <p style="margin:6px 0 0;font-family:system-ui,sans-serif;color:#8a8a8a;font-size:14px">${t.intro}</p>
        </td></tr>
        <tr><td><table role="presentation" width="100%" style="font-family:system-ui,sans-serif">${stories}</table></td></tr>
        <tr><td style="padding-top:20px;font-family:system-ui,sans-serif;color:#6a6a6a;font-size:12px;line-height:1.6">
          ${t.footer}<br/>
          <a href="${unsubUrl}" style="color:#8a8a8a">${t.unsub}</a>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`

  return { subject: t.subject, html }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_KEY) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${RESEND_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      signal: AbortSignal.timeout(15000),
    })
    return res.ok
  } catch {
    return false
  }
}
