import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/digest/unsubscribe?p=<profileId> — enlace de baja del email.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get('p')
  if (p) {
    await query(`UPDATE profiles SET digest_optin = false WHERE id = $1`, [p]).catch(() => {})
  }
  const html = `<!doctype html><html><body style="margin:0;background:#0d0d0d;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif">
    <div style="text-align:center;color:#f5f5f5;padding:32px">
      <h1 style="font-size:20px;margin:0 0 8px">Suscripción cancelada</h1>
      <p style="color:#8a8a8a;font-size:14px;margin:0">Ya no recibirás el briefing por email.</p>
      <a href="/" style="display:inline-block;margin-top:20px;color:#caa84a;font-size:14px;text-decoration:none">Volver a NewsHub →</a>
    </div></body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
