// Cliente Postgres para el servidor de Next (pool único por proceso).
import { Pool, type QueryResultRow } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __newshubPool: Pool | undefined
}

export const pool =
  global.__newshubPool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== 'production') global.__newshubPool = pool

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params as unknown[])
}
