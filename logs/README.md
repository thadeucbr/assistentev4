# Sistema de Logs Avançado

Este diretório contém os logs estruturados do sistema. O novo sistema de logging oferece:

## Características

- **IDs únicos por mensagem**: Cada processamento de mensagem gera um ID único (8 caracteres)
- **Rotação automática**: Mantém apenas os últimos 50 arquivos de log
- **Logs estruturados**: Formato JSON com timestamp, messageId, tempo decorrido, nível, componente e dados
- **Console limpo**: Apenas logs críticos aparecem no console

## Tipos de Log

- **error**: Erros críticos que precisam de atenção
- **warn**: Avisos importantes
- **info**: Informações gerais do fluxo
- **debug**: Logs detalhados apenas em arquivo

## Formato dos Arquivos

Os arquivos seguem o padrão: `{messageId}_{nivel}.log`

Exemplo: `a1b2c3d4_info.log`

## Exemplo de Entrada no Log

```json
{
  "timestamp": "2025-07-30T10:30:45.123Z",
  "messageId": "a1b2c3d4",
  "elapsedTime": "+1250ms",
  "level": "INFO",
  "component": "ProcessMessage",
  "message": "Processamento da mensagem concluído",
  "data": {
    "totalTime": 1250,
    "userId": "user123"
  }
}
```

## Uso no Código

```javascript
import logger from '../utils/logger.js';

// No início de cada processamento de mensagem
const messageId = logger.generateMessageId();

// Logs estruturados
logger.info('ComponentName', 'Operação realizada com sucesso');
logger.error('ComponentName', 'Erro ao processar', { error: error.message });
logger.debug('ComponentName', 'Informação detalhada apenas para arquivo');

// Logs de timing
logger.timing('ComponentName', 'Operação concluída em 150ms');

// Marcos importantes
logger.milestone('ComponentName', 'Marco importante atingido');
```

## Vantagens

1. **Console limpo**: Reduz drasticamente a poluição no terminal
2. **Rastreabilidade completa**: Cada mensagem pode ser rastreada do início ao fim
3. **Logs persistentes**: Histórico mantido em arquivos organizados
4. **Performance**: Logs de timing para análise de performance
5. **Rotação automática**: Não consome espaço indefinidamente

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
