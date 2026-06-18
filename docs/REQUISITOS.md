# NewsHub — Requisitos del producto (PRD)

> Estado: **v1.0 — requisitos cerrados** (sin decisiones de producto abiertas).
> Última actualización: 2026-06-18.
>
> **Decisiones**: identidad **anónima por cookie**; temas = **categorías curadas +
> keywords propias**; notificaciones **inmediatas con rate-limit + dedupe de historia**
> y **umbral de tracción** (≥2 fuentes o crecimiento); tendencias por **clustering
> semántico** con embeddings **self-hosted** (`multilingual-e5-small`, 384d, `pgvector`);
> News API = **GNews**.

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
- **Identidad anónima por cookie**: un perfil por navegador, sin registro ni
  fricción. Los temas seguidos y las suscripciones push se asocian a ese perfil.
- **Feed personalizado** ordenado por relevancia y recencia.
- **Temas = categorías curadas + keywords propias**:
  - **Categorías curadas** — 9 chips predefinidos para arranque sin pantalla vacía y con
    calidad controlada: **IA, Tecnología, Economía, Política, Internacional, Deportes,
    Ciencia, Clima, Cultura**.
  - **Temas propios del usuario**: crea un tema con sus palabras clave (p. ej.
    "Real Madrid", "tipos BCE"). Cada perfil tiene sus temas.
- **Ingesta multi-fuente** (conectores enchufables):
  - **RSS/Atom** — base del MVP (medios con feed: El País, El Mundo, BBC, The Guardian…).
  - **News API** (**GNews**) — búsqueda por keyword/tema. _Conector con clave GNews._
  - **Scraping a medida** — para medios sin RSS. _Fase posterior, scaffold listo._
- **Deduplicación** de la misma noticia entre fuentes (por URL canónica + hash de título).
- **Notificaciones al instante con control de ruido**: Web Push (aunque la pestaña
  esté cerrada) por cada match de un tema seguido, pero con **rate-limit por tema**
  y **dedupe de historia** (no avisar dos veces de la misma noticia/cluster).
- **Tiempo real in-app** vía **SSE**: badge/toast en vivo mientras la web está abierta.
- **Tendencias por clustering semántico**: se agrupan artículos de la **misma historia**
  con embeddings (vectores) y se marca como tendencia el cluster que más crece en una
  ventana móvil. Requiere `pgvector` + un proveedor de embeddings (ver §10).
- **Multi-idioma desde el inicio** (UI **es/en**; fuentes mezcladas es+en).
- **UI estilo Voicebox**: shadcn "new-york", Tailwind 4, tema oscuro con acento dorado.

### Fuera del MVP (backlog)
- Cuentas de usuario / login con email (el MVP arranca **solo** anónimo por cookie;
  el salto a cuentas multi-dispositivo se evaluará después).
- Resúmenes con IA por artículo y por tema (digest diario).
- Apps móviles nativas / Telegram / email digest.
- Moderación de fuentes por la comunidad.

## 4. Requisitos funcionales

| ID | Requisito |
|----|-----------|
| RF-1 | El usuario ve un feed de artículos con título, fuente, fecha relativa, idioma y tema. |
| RF-2 | El usuario puede seguir/dejar de seguir **categorías curadas** (chips). El feed se filtra por temas seguidos. |
| RF-3 | El sistema ingiere artículos de las fuentes activas de forma periódica (cron). |
| RF-4 | El sistema deduplica artículos repetidos entre fuentes. |
| RF-5 | Cuando entra un artículo que casa con un tema seguido, se genera una **notificación**. |
| RF-6 | El usuario puede activar **Web Push** y recibe la alerta en el SO. |
| RF-7 | Con la web abierta, las novedades llegan **en vivo** (SSE) sin recargar. |
| RF-8 | El usuario cambia el idioma de la UI (es/en); se detecta el del navegador por defecto. |
| RF-9 | Cada artículo enlaza a la fuente original (no se reproduce el contenido completo). |
| RF-10 | A cada visitante se le asigna un **perfil anónimo** (cookie httpOnly); sus temas y push se asocian a ese perfil. |
| RF-11 | El usuario puede **crear temas propios** con sus palabras clave y gestionarlos (editar/borrar). |
| RF-12 | Las notificaciones respetan un **rate-limit por tema** y un **dedupe**: no se avisa dos veces de la misma historia (mismo cluster). |
| RF-12b | Solo se notifica si, además de casar un tema, el cluster supera un **umbral de tracción** (≥2 fuentes o crecimiento), para priorizar historias reales sobre ruido. |
| RF-13 | El sistema agrupa artículos de la **misma historia** por similitud semántica (embeddings) y expone un panel de **tendencias** (clusters que más crecen en una ventana móvil). |
| RF-14 | El usuario puede seguir una **tendencia/cluster** y recibir alerta si esa historia evoluciona. |

## 5. Requisitos no funcionales

- **Latencia de alerta**: < 60 s desde que el artículo está en una fuente con ingesta activa.
- **Disponibilidad**: despliegue en VPS Hetzner vía Coolify + Traefik + Let's Encrypt.
- **Coste**: reutiliza infraestructura existente (VPS ya pagado, Postgres self-hosted).
- **Privacidad**: sin tracking de terceros; las suscripciones push se guardan cifradas en reposo.
- **Legal**: solo título + extracto + enlace a la fuente (fair use); respeto a `robots.txt` en scraping.
- **i18n**: textos de UI externalizados; soporte es/en desde el día 1.

## 6. Arquitectura (resumen)

```
Fuentes ──► Ingesta (RSS / NewsAPI / scrape) ──► dedup ──► embedding ──► cluster
                │  (cron: /api/ingest, cada N min vía Coolify scheduled task)
                ▼
   PostgreSQL 17 + pgvector
   (profiles, sources, articles[+embedding], topics, clusters,
    notifications[+throttle], push_subscriptions)
                │
        ┌───────┴────────┐
        ▼                ▼
   Web Push (VAPID)   SSE  /api/events  ──►  UI Next.js (estilo Voicebox)
   (por cluster,                              feed + temas + tendencias
    con rate-limit)
```

- **Frontend + Backend**: Next.js 15 (App Router, `output: standalone`) — un solo despliegue.
- **DB**: PostgreSQL 17 self-hosted (mismo patrón que `michael`).
- **Realtime**: SSE para in-app; Web Push (service worker + VAPID) para fuera de la app.
- **Cron**: tarea programada de Coolify llama a `POST /api/ingest` (protegido por token).

Ver detalle en [`ARQUITECTURA.md`](./ARQUITECTURA.md).

## 7. Modelo de datos (MVP)

- `profiles` — **perfil anónimo** por cookie (id, created_at, last_seen, lang).
- `sources` — fuentes de noticias (tipo rss/newsapi/scrape, url, idioma, activa).
- `articles` — artículos normalizados y deduplicados. **+** `embedding vector` y
  `cluster_id` (FK a `clusters`).
- `topics` — temas: `kind` = `curated` | `custom`, `keywords[]`, `lang`,
  `owner_profile_id` (NULL para curados globales).
- `profile_topics` — qué temas sigue cada perfil (sustituye al flag `followed` global).
- `article_topics` — relación N:M artículo↔tema (match de ingesta).
- `clusters` — historia agregada: `centroid vector`, `size`, `first_seen`,
  `last_seen`, `score_trend` (volumen×recencia). Base de **tendencias**.
- `push_subscriptions` — endpoints Web Push, asociados a `profile_id` y a temas.
- `notifications` — alertas generadas (artículo/cluster + tema + perfil + estado).
- `notification_throttle` — control de rate-limit/dedupe por (perfil, tema, cluster).

> Cambios vs v0.1: nuevas tablas `profiles`, `profile_topics`, `clusters`,
> `notification_throttle`; `topics` gana `kind`/`owner_profile_id`; `articles`
> gana `embedding`/`cluster_id`. Requiere la extensión **`pgvector`**.

## 8. Métricas de éxito (MVP)

- Tiempo medio fuente→alerta < 60 s.
- % de notificaciones que el usuario abre (CTR) > 15 %.
- Nº de temas seguidos por usuario activo ≥ 3.

## 9. Decisiones (cerradas)

### Resueltas
- [x] **Identidad**: anónima por cookie (perfil por navegador). Login multi-dispositivo, fuera del MVP.
- [x] **Temas**: categorías curadas + keywords propias del usuario.
- [x] **Notificaciones**: inmediatas con rate-limit por tema + dedupe de historia (cluster).
- [x] **Tendencias**: clustering semántico con embeddings (`pgvector`).

### Resueltas (segunda ronda)
- [x] **Embeddings**: **self-hosted** en el VPS — microservicio con `multilingual-e5-small`
      (**384 dimensiones**, ~120 MB, bajo RAM). Sin coste por uso ni salida de datos.
- [x] **Proveedor News API**: **GNews** (free tier ~100 req/día, multi-idioma).

### Resueltas (tercera ronda)
- [x] **Categorías curadas iniciales** (9): IA, Tecnología, Economía, Política, Internacional,
      Deportes, Ciencia, Clima, Cultura.
- [x] **Modelo y dimensión**: `multilingual-e5-small`, vector de **384d** en `pgvector`.
- [x] **Umbral de alerta**: match de tema seguido **+** tracción mínima del cluster
      (≥2 fuentes o crecimiento). No basta un solo artículo suelto.

### Defaults de tuning (aceptados, afinables con datos reales)
- **Cron de ingesta**: cada **5 min** (bajable a 1-2 min con tráfico).
- **Rate-limit de alertas**: máx **1 alerta por tema cada 30 min**; **dedupe por cluster**
  en ventana de **24 h**.
- **Clustering**: umbral coseno **0.92** (calibrado: e5 comprime las similitudes en rango
  alto — misma historia ~0.95, mismo tema/otra historia ~0.90), ventana de tendencia **6 h**,
  cluster mínimo **3 artículos** (y ≥2 fuentes para alertar).

> **No quedan decisiones de producto abiertas.** Lo que reste se resolverá al implementar
> (detalles de UI, esquema exacto, tuning sobre tráfico real).

## 10. Nota técnica — clustering semántico (la pieza nueva mayor)

El clustering es lo más ambicioso del MVP y añade dependencias nuevas. Enfoque propuesto:

1. **Embeddings**: al ingerir, se calcula el vector de `título + extracto` con un modelo
   **multilingüe** (es/en en el mismo espacio). Se guarda en `articles.embedding` (`pgvector`).
2. **Asignación a cluster**: se busca el cluster existente más cercano (coseno) dentro de una
   ventana temporal; si supera el umbral de similitud, se une y se actualiza el centroide;
   si no, se crea un cluster nuevo. (Clustering incremental online, sin recomputar todo.)
3. **Tendencia**: `score_trend` = f(tamaño del cluster, velocidad de crecimiento, recencia).
   El panel de tendencias lista los clusters con mayor score en la ventana.
4. **Dedupe de notificaciones**: la alerta se emite por **cluster**, no por artículo — así no
   se notifica 5 veces la misma historia cubierta por 5 medios.

**Embeddings — decidido: self-hosted en el VPS.** Microservicio dedicado (un contenedor
más en Coolify, patrón que ya usas con tus servicios mlx/xtts) que expone `POST /embed`
y devuelve el vector. Modelo **`multilingual-e5-small`** (**384d**) para que es/en compartan
espacio vectorial. La app Next llama a ese servicio durante la ingesta.
- Ventajas: sin coste por uso, los textos no salen del VPS, alineado con el stack self-hosted.
- Coste: ~120 MB de modelo + algo de CPU/RAM del VPS y un servicio que mantener.

> Riesgo/alcance: si el microservicio de embeddings se complica o el VPS va justo de RAM, se
> puede **fasear** — arrancar con tendencia por volumen+recencia simple (sin embeddings) y
> añadir el clustering semántico después, sin cambiar el contrato de la UI de "tendencias".

## 11. Servicios desplegados

| Servicio | Rol |
|----------|-----|
| `newshub-web` | Next.js (UI + API + ingesta). Ya desplegado. |
| `newshub-db` | PostgreSQL 17 **+ `pgvector`** (habilitar extensión). Ya desplegado (falta pgvector). |
| `newshub-embed` | **Nuevo**: microservicio de embeddings self-hosted `multilingual-e5-small` 384d (`POST /embed`). Por crear. |
