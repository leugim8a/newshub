// Migrador SQL plano (mismo patrón que michael): aplica los .sql de migrations/
// en orden y registra los ya ejecutados en _migrations.
const { readdir, readFile } = require('node:fs/promises')
const { join } = require('node:path')
const pg = require('pg')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

function log(level, msg, extra) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra }))
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  const { rows: executed } = await pool.query('SELECT name FROM _migrations ORDER BY name')
  const executedNames = new Set(executed.map((r) => r.name))

  const migrationsDir = join(__dirname, '..', 'migrations')
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

  let ran = 0
  for (const file of files) {
    if (executedNames.has(file)) continue
    log('info', `Migración iniciada: ${file}`)
    const sql = await readFile(join(migrationsDir, file), 'utf-8')
    await pool.query(sql)
    await pool.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file])
    log('info', `Migración completada: ${file}`)
    ran++
  }

  log('info', ran > 0 ? `Migraciones completadas (${ran})` : 'Sin migraciones pendientes')
  await pool.end()
}

migrate().catch(async (err) => {
  log('error', 'Migration failed', { error: err.message, stack: err.stack })
  try {
    await pool.end()
  } catch {}
  process.exit(1)
})
