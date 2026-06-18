# NewsHub

Agregador de noticias **personalizado** con **alertas en tiempo real**. Sigues
temas concretos y recibes notificaciones al instante (Web Push + SSE) cuando
aparece algo relevante.

- **UI** estilo [voicebox](../voicebox) — shadcn "new-york", Tailwind 4, tema oscuro dorado.
- **Despliegue** estilo [michael](../michael) — Docker → Coolify → Traefik en VPS Hetzner.

> Estado: **esqueleto v0.1**. Ver [`docs/REQUISITOS.md`](docs/REQUISITOS.md) y
> [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Stack

| Capa | Tecnología |
|------|-----------|
| UI + API | Next.js 15 (App Router, standalone) + React 19 |
| Diseño | Tailwind 4 + tokens de voicebox |
| DB | PostgreSQL 17 (migraciones SQL planas) |
| Ingesta | RSS (`rss-parser`) · News API · scraping (`cheerio`) |
| Realtime | SSE + Web Push (VAPID, `web-push`) |
| Infra | Docker · Coolify · Traefik · Hetzner |

## Desarrollo

```bash
# 1. Levantar Postgres
docker compose up -d

# 2. Configurar entorno
cp .env.example .env
# Generar claves VAPID y pegarlas en .env (VAPID_* y NEXT_PUBLIC_VAPID_PUBLIC_KEY):
pnpm --filter @newshub/web exec web-push generate-vapid-keys

# 3. Instalar + migrar + sembrar
pnpm install
pnpm db:migrate

# 4. Arrancar (http://localhost:3000)
pnpm dev

# 5. Forzar un ciclo de ingesta (en otra terminal)
curl "http://localhost:3000/api/ingest?token=dev-ingest-token-change-me"
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Healthcheck (usado por Docker/Coolify) |
| GET | `/api/feed?topic=&limit=` | Feed de artículos |
| GET/PATCH | `/api/topics` | Listar / seguir temas |
| POST/GET | `/api/ingest` | Ejecutar ingesta (token requerido) |
| GET | `/api/events` | Stream SSE de novedades |
| GET | `/api/push/vapid` | Clave pública VAPID |
| POST/DELETE | `/api/push/subscribe` | Suscripción Web Push |

## Despliegue

Push a `main` → GitHub Action dispara deploy en Coolify (API) → build del
`Dockerfile` multi-stage → migraciones + `node server.js` tras Traefik con SSL.

La ingesta periódica se configura como **scheduled task** en Coolify:

```bash
curl -fsS -X POST -H "Authorization: Bearer $INGEST_TOKEN" https://<dominio>/api/ingest
```

Ver [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) para el detalle.
