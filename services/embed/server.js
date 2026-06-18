// newshub-embed — microservicio de embeddings self-hosted.
// Modelo: Xenova/multilingual-e5-small (384 dimensiones, multilingüe es/en).
// e5 requiere prefijos: "passage: " para documentos, "query: " para consultas.
//
// API:
//   GET  /health           -> { status, ready, model, dim }
//   POST /embed { texts: string[], type?: 'passage'|'query' }
//        -> { embeddings: number[][], dim }

import http from 'node:http'
import { pipeline, env } from '@xenova/transformers'

// Cachear el modelo en disco (persistente entre arranques si se monta volumen).
env.cacheDir = process.env.MODEL_CACHE_DIR || '/app/.cache'
env.allowLocalModels = false

const MODEL = process.env.EMBED_MODEL || 'Xenova/multilingual-e5-small'
const PORT = Number(process.env.PORT || 8089)
const DIM = 384
const TOKEN = process.env.EMBED_TOKEN // si se define, /embed exige Bearer

let extractor = null
let loadError = null

async function load() {
  try {
    console.log(JSON.stringify({ level: 'info', msg: `Cargando modelo ${MODEL}…` }))
    extractor = await pipeline('feature-extraction', MODEL)
    console.log(JSON.stringify({ level: 'info', msg: 'Modelo listo' }))
  } catch (err) {
    loadError = err
    console.error(JSON.stringify({ level: 'error', msg: 'Fallo al cargar modelo', error: err.message }))
  }
}
load()

async function embed(texts, type) {
  if (!extractor) throw new Error('modelo no listo')
  const prefix = type === 'query' ? 'query: ' : 'passage: '
  const inputs = texts.map((t) => prefix + String(t ?? '').slice(0, 2000))
  const out = await extractor(inputs, { pooling: 'mean', normalize: true })
  // out.tolist() -> number[][]
  return out.tolist()
}

function send(res, code, body) {
  const data = JSON.stringify(body)
  res.writeHead(code, { 'Content-Type': 'application/json' })
  res.end(data)
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, extractor ? 200 : 503, {
      status: extractor ? 'ok' : 'loading',
      ready: Boolean(extractor),
      model: MODEL,
      dim: DIM,
      error: loadError?.message,
    })
  }

  if (req.method === 'POST' && req.url === '/embed') {
    if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
      return send(res, 401, { error: 'unauthorized' })
    }
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 5_000_000) req.destroy()
    })
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}')
        const texts = Array.isArray(body.texts) ? body.texts : []
        if (texts.length === 0) return send(res, 400, { error: 'texts vacío' })
        if (texts.length > 64) return send(res, 400, { error: 'máx 64 textos por lote' })
        const embeddings = await embed(texts, body.type)
        send(res, 200, { embeddings, dim: DIM })
      } catch (err) {
        send(res, 500, { error: err.message })
      }
    })
    return
  }

  send(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: `newshub-embed escuchando en :${PORT}` }))
})
