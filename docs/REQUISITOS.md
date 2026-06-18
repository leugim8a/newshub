# NewsHub — Requisitos del producto (PRD borrador)

> Estado: **borrador v0.1** — base para ir puliendo. Última actualización: 2026-06-18.

## 1. Visión

NewsHub es un **agregador de noticias personalizado** que mantiene al usuario
informado de lo último **en tiempo real**. El usuario sigue temas concretos
(p. ej. "IA", "Real Madrid", "tipos de interés BCE"), tendencias y actualidad,
y recibe **notificaciones al instante** cuando aparece algo relevante.

No es un lector RSS más: el valor está en (1) la **personalización por tema**,
(2) la **detección de novedad/tendencia** y (3) la **inmediatez** de la alerta.

## 2. Usuario objetivo

Persona informada (profesional, inversor, fan, periodista, curioso) que quiere
enterarse antes que nadie de lo que le importa **sin** revisar 20 fuentes a mano.

## 3. Alcance del MVP

### Incluido
- **Feed personalizado** ordenado por relevancia y recencia.
- **Temas seguidos**: el usuario crea/sigue temas por palabras clave.
- **Ingesta multi-fuente** (conectores enchufables):
  - **RSS/Atom** — base del MVP (medios con feed: Reuters, BBC, El País, etc.).
  - **News API** (NewsAPI.org / GNews) — búsqueda por keyword/tema. _Conector con clave._
  - **Scraping a medida** — para medios sin RSS. _Fase posterior, scaffold listo._
- **Deduplicación** de la misma noticia entre fuentes (por URL canónica + hash de título).
- **Notificaciones al instante** vía **Web Push** (navegador, aunque la pestaña esté cerrada).
- **Tiempo real in-app** vía **SSE**: badge/toast en vivo mientras la web está abierta.
- **Multi-idioma desde el inicio** (UI **es/en**; fuentes mezcladas es+en).
- **UI estilo Voicebox**: shadcn "new-york", Tailwind 4, tema oscuro con acento dorado.

### Fuera del MVP (backlog)
- Cuentas de usuario / login (MVP arranca con un perfil local/anónimo + cookie).
- Resúmenes con IA por artículo y por tema (digest diario).
- Clustering semántico de "tendencias" (embeddings).
- Apps móviles nativas / Telegram / email digest.
- Moderación de fuentes por la comunidad.

## 4. Requisitos funcionales

| ID | Requisito |
|----|-----------|
| RF-1 | El usuario ve un feed de artículos con título, fuente, fecha relativa, idioma y tema. |
| RF-2 | El usuario puede seguir/dejar de seguir temas (chips). El feed se filtra por temas seguidos. |
| RF-3 | El sistema ingiere artículos de las fuentes activas de forma periódica (cron). |
| RF-4 | El sistema deduplica artículos repetidos entre fuentes. |
| RF-5 | Cuando entra un artículo que casa con un tema seguido, se genera una **notificación**. |
| RF-6 | El usuario puede activar **Web Push** y recibe la alerta en el SO. |
| RF-7 | Con la web abierta, las novedades llegan **en vivo** (SSE) sin recargar. |
| RF-8 | El usuario cambia el idioma de la UI (es/en); se detecta el del navegador por defecto. |
| RF-9 | Cada artículo enlaza a la fuente original (no se reproduce el contenido completo). |

## 5. Requisitos no funcionales

- **Latencia de alerta**: < 60 s desde que el artículo está en una fuente con ingesta activa.
- **Disponibilidad**: despliegue en VPS Hetzner vía Coolify + Traefik + Let's Encrypt.
- **Coste**: reutiliza infraestructura existente (VPS ya pagado, Postgres self-hosted).
- **Privacidad**: sin tracking de terceros; las suscripciones push se guardan cifradas en reposo.
- **Legal**: solo título + extracto + enlace a la fuente (fair use); respeto a `robots.txt` en scraping.
- **i18n**: textos de UI externalizados; soporte es/en desde el día 1.

## 6. Arquitectura (resumen)

```
Fuentes ──► Ingesta (conectores RSS / NewsAPI / scrape)
                │  (cron: /api/ingest, cada N min vía Coolify scheduled task)
                ▼
        PostgreSQL 17  (articles, sources, topics, notifications, push_subscriptions)
                │
        ┌───────┴────────┐
        ▼                ▼
   Web Push (VAPID)   SSE  /api/events  ──►  UI Next.js (estilo Voicebox)
```

- **Frontend + Backend**: Next.js 15 (App Router, `output: standalone`) — un solo despliegue.
- **DB**: PostgreSQL 17 self-hosted (mismo patrón que `michael`).
- **Realtime**: SSE para in-app; Web Push (service worker + VAPID) para fuera de la app.
- **Cron**: tarea programada de Coolify llama a `POST /api/ingest` (protegido por token).

Ver detalle en [`ARQUITECTURA.md`](./ARQUITECTURA.md).

## 7. Modelo de datos (MVP)

- `sources` — fuentes de noticias (tipo rss/newsapi/scrape, url, idioma, activa).
- `articles` — artículos normalizados y deduplicados.
- `topics` — temas seguidos (keywords + idioma).
- `article_topics` — relación N:M artículo↔tema (match de ingesta).
- `push_subscriptions` — endpoints Web Push del navegador.
- `notifications` — alertas generadas (artículo + tema + estado entregado/leído).

## 8. Métricas de éxito (MVP)

- Tiempo medio fuente→alerta < 60 s.
- % de notificaciones que el usuario abre (CTR) > 15 %.
- Nº de temas seguidos por usuario activo ≥ 3.

## 9. Decisiones abiertas (a pulir)

- [ ] ¿Login/cuentas o seguir anónimo con cookie en el MVP?
- [ ] Set inicial de fuentes RSS por idioma (curar lista).
- [ ] Proveedor News API definitivo (NewsAPI.org vs GNews vs Mediastack).
- [ ] Frecuencia de cron de ingesta (¿1 min? ¿5 min?) y límites de las APIs gratuitas.
- [ ] Estrategia de "tendencia" (volumen + recencia simple vs clustering semántico).
