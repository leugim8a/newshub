// Cliente Postgres compartido. Pool único por proceso.
const pg = require('pg')

let pool

function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

function query(text, params) {
  return getPool().query(text, params)
}

module.exports = { getPool, query }
