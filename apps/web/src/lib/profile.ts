// Perfil anónimo por cookie (sin login). Un perfil por navegador.
import { cookies } from 'next/headers'
import { query } from './db'

export const PROFILE_COOKIE = 'nh_pid'
const ONE_YEAR = 60 * 60 * 24 * 365

// Lee el id de perfil de la cookie y comprueba que existe en BD.
export async function getProfileId(): Promise<string | null> {
  const jar = await cookies()
  const v = jar.get(PROFILE_COOKIE)?.value
  if (!v) return null
  const { rows } = await query<{ id: string }>(`SELECT id FROM profiles WHERE id = $1`, [v])
  return rows[0]?.id ?? null
}

// Crea un perfil nuevo y le hace seguir todas las categorías curadas por defecto.
export async function createProfile(lang = 'es'): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO profiles (lang) VALUES ($1) RETURNING id`,
    [lang],
  )
  const id = rows[0].id
  await query(
    `INSERT INTO profile_topics (profile_id, topic_id)
     SELECT $1, id FROM topics WHERE kind = 'curated'
     ON CONFLICT DO NOTHING`,
    [id],
  )
  return id
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  maxAge: ONE_YEAR,
  path: '/',
}
