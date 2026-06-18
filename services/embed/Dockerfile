# newshub-embed — microservicio de embeddings (transformers.js)

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

# Precargar el modelo en la imagen para evitar descarga en el primer arranque.
ENV MODEL_CACHE_DIR=/app/.cache
RUN node -e "import('@xenova/transformers').then(async ({pipeline,env})=>{env.cacheDir='/app/.cache';env.allowLocalModels=false;await pipeline('feature-extraction', process.env.EMBED_MODEL||'Xenova/multilingual-e5-small');console.log('modelo precargado')})"

ENV PORT=8089
EXPOSE 8089

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:8089/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["dumb-init", "node", "server.js"]
