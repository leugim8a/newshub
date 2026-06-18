# NewsHub — guía para Claude

Agregador de noticias personalizado con alertas en tiempo real. UI portada de
**voicebox**; infraestructura de despliegue copiada de **michael**.

## Arquitectura

| Capa | Decisión |
|------|----------|
| Framework | Next.js 15 App Router, `output: standalone`. UI **y** API en un único servicio. |
| Diseño | Tailwind 4 (CSS-first, `@theme`) + tokens de voicebox. Tema oscuro por defecto (`<html class="dark">`). Botones `rounded-full`, acento dorado `hsl(43 50% 45%)`. |
| DB | PostgreSQL 17, migraciones SQL planas en `packages/db/migrations` (patrón michael, tabla `_migrations`). |
| Ingesta | Conectores enchufables en `apps/web/src/ingest` (`rss`, `newsapi`, `scrape`). `runIngest()` deduplica (URL canónica + hash de título), casa temas por keyword y genera notificaciones. |
| Realtime | SSE en `/api/events` (bus en memoria `lib/realtime.ts`) + Web Push VAPID (`lib/push.ts`, `public/sw.js`). |
| Despliegue | Docker → Coolify → Traefik + Let's Encrypt en VPS Hetzner (`46.225.117.75:8000`). Push a `main` → GitHub Action → Coolify API deploy. |

## Convenciones

- Paquetes: `@newshub/web`, `@newshub/db`. pnpm workspaces + turbo.
- El servidor de Next usa `apps/web/src/lib/db.ts` (pool pg propio). `packages/db`
  existe para migraciones (se ejecutan en el arranque del contenedor).
- Las API routes son `dynamic = 'force-dynamic'`.
- i18n ligero propio (es/en) en `lib/i18n.tsx`, sin librería externa.
- La ingesta se protege con `INGEST_TOKEN`; el cron de Coolify la dispara.

## Realtime — limitaciones del MVP

`lib/realtime.ts` es un bus **en memoria**: vale para una sola instancia. Para
escalar a varias réplicas, migrar a Postgres `LISTEN/NOTIFY` o Redis pub/sub.

## Comandos

```bash
docker compose up -d          # Postgres dev (puerto 5434)
pnpm install
pnpm db:migrate               # aplica migraciones
pnpm dev                      # Next en :3000
curl ".../api/ingest?token=$INGEST_TOKEN"   # forzar ingesta
```

## Variables de entorno

Ver `.env.example`. Claves: `DATABASE_URL`, `INGEST_TOKEN`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEWSAPI_KEY` (opcional).

## Pendiente / backlog

Ver sección 9 de `docs/REQUISITOS.md` (login, curado de fuentes, proveedor News
API, frecuencia de cron, estrategia de "tendencias").
