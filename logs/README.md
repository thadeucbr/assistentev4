# Sistema de Logs de Erro

Este diretório contém os logs de erro gerados automaticamente pelo sistema.

## Funcionalidade

A função `logError()` em `src/utils/logger.js` é responsável por:

1. **Capturar erros**: Registra automaticamente todos os erros que ocorrem em blocos try-catch
2. **Gerar arquivos**: Cria arquivos `.txt` com timestamp único para cada erro
3. **Informações detalhadas**: Inclui:
   - Timestamp do erro
   - Contexto onde o erro ocorreu
   - Mensagem de erro
   - Stack trace completo
   - Nome do erro
   - Causa (se disponível)

## Formato dos Arquivos

Os arquivos seguem o padrão: `error-YYYY-MM-DDTHH-mm-ss-sssZ.txt`

Exemplo: `error-2025-07-28T15-30-45-123Z.txt`

## Exemplo de Conteúdo

```
=== ERROR LOG ===
Timestamp: 2025-07-28T15:30:45.123Z
Context: openAiChat - OpenAI API call failed
Message: OpenAI chat failed: 429 Rate limit exceeded
Stack: Error: OpenAI chat failed: 429 Rate limit exceeded
    at openAiChat (c:\Users\thade\OneDrive\Documentos\Teste\src\config\ai\openai\openAiChat.js:35:13)
    ...
Name: Error
================
```

## Limpeza

Os arquivos de log devem ser limpos periodicamente para evitar acúmulo excessivo de dados.
