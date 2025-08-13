# Módulos removidos / não utilizados

Data: 2025-08-13  
Branch: `chore/cleanup-unused-modules`

## Removidos

| Arquivo | Motivo |
|---------|--------|
| `src/config/ai/openai/tools.js` | Nunca importado – protótipo antigo de tools OpenAI |
| `src/config/ai/ollama/functions.js` | Não referenciado – experimento antigo de functions |
| `src/skills/curl.js` | Skill não utilizada (nenhum wrapper/uso dinâmico encontrado) |
| `src/utils/logExample.js` | Exemplo isolado sem referência |

## Mantidos (uso indireto ou via wrappers)

| Arquivo | Observação |
|---------|------------|
| `src/skills/generateAudio.js` | Usado por testes e wrappers MCP (import dinâmico). |
| `src/skills/calendar.js` | Usado via import dinâmico em `mcp-server/skill-wrappers.js`. |
| `cosineSimilarity` duplicado | Implementação em `src/core/memory/cosineSimilarity.js` e lógica similar em `src/lib/vectorStore.js` – considerar unificação. |
| Skills duplicadas (ex: analyzeImage, lotteryCheck) | Há versões em `/src/skills` e `/mcp-server/skills` – avaliar fonte única. |

## Próximos passos sugeridos

1. Unificar `cosineSimilarity` em util único. (CONCLUÍDO: util criado em `src/utils/cosineSimilarity.js` e antigo marcado como deprecated)
2. Consolidar skills duplicadas com wrappers MCP. (PENDENTE)
3. Adicionar script de CI (`scripts/check-unused.js`) para detectar módulos sem import. (CONCLUÍDO - script adicionado)
4. Revisar antes do merge se não surgiram novos usos em PRs paralelas. (EM ABERTO)

## Reversão

Restaurar algum arquivo removido:

```bash
git checkout main -- <caminho/do/arquivo>
```

---
Documento gerado automaticamente na limpeza de agosto/2025.
