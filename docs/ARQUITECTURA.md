# NewsHub — Arquitectura

## Stack

| Capa | Tecnología | Notas |
|------|-----------|-------|
| UI | Next.js 15 (App Router) + React 19 | `output: standalone` para Docker |
| Diseño | Tailwind 4 + shadcn "new-york" | Tokens portados de **voicebox** (tema oscuro dorado) |
| Estado/datos | Server Components + fetch + SSE | Sin cliente de datos pesado en el MVP |
| Base de datos | PostgreSQL 17 self-hosted | Migraciones SQL planas (patrón de `michael`) |
| Ingesta | `rss-parser`, `cheerio`, News API HTTP | Conectores enchufables en `apps/web/src/ingest` |
| Realtime | SSE (`/api/events`) + Web Push (VAPID) | `web-push` en servidor, `sw.js` en cliente |
| Infra | Docker → Coolify → Traefik + Let's Encrypt | VPS Hetzner (igual que `michael`) |
| CI/CD | GitHub Actions → Coolify API deploy | Push a `main` dispara build+deploy |

## Monorepo

```
newshub/
├── apps/web/            # Next.js (UI + API + ingesta)
│   └── src/
│       ├── app/         # rutas y API routes
│       ├── components/  # UI estilo voicebox
│       ├── ingest/      # conectores de fuentes
│       └── lib/         # db, i18n, push, utils
├── packages/db/         # esquema + migraciones + cliente pg
├── Dockerfile           # build multi-stage standalone
├── docker-compose.yml   # postgres 17 para desarrollo
└── .github/workflows/   # deploy.yml, test.yml
```

## Flujo de ingesta

1. Coolify ejecuta una **scheduled task** (o un cron externo) que hace
   `POST /api/ingest` con `Authorization: Bearer $INGEST_TOKEN`.
2. El endpoint recorre las `sources` activas y llama al conector correspondiente.
3. Cada conector devuelve artículos normalizados `{ url, title, summary, lang, publishedAt }`.
4. Se **deduplica** (URL canónica + hash de título) e inserta en `articles`.
5. Para cada artículo nuevo se evalúan los `topics` (match por keyword) → `article_topics`.
6. Por cada match se crea una `notification` y se:
   - emite por **SSE** a los clientes conectados,
   - envía por **Web Push** a las `push_subscriptions` suscritas al tema.

## Realtime

- **SSE** (`GET /api/events`): stream `text/event-stream`; el cliente escucha con
  `EventSource` y pinta toasts/badge. Ligero, sin servidor WebSocket aparte.
- **Web Push**: el navegador registra `sw.js`, se suscribe con la clave pública VAPID
  y manda el endpoint a `POST /api/push/subscribe`. El servidor envía con `web-push`.

## Despliegue (idéntico a michael)

- `Dockerfile` multi-stage: deps → build (`next build` standalone) → runtime
  (`migrate` + `node server.js`).
- Coolify construye la imagen al recibir el webhook/deploy y la publica tras Traefik
  con certificado Let's Encrypt automático.
- Variables en Coolify (ver `.env.example`): `DATABASE_URL`, `INGEST_TOKEN`,
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEWSAPI_KEY` (opcional).
