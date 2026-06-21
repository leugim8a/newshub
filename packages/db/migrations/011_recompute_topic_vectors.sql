-- Forzar recálculo de los vectores de tema con el texto LIMPIO (sin acrónimos
-- cortos ambiguos): ensureTopicEmbeddings() los rellenará en el próximo ciclo /
-- en /api/admin/retag.
UPDATE topics SET embedding = NULL;
