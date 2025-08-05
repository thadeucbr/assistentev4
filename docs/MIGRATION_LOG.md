# Guia de Migração do Sistema de Logging

Este guia ajuda a migrar do sistema antigo de `console.log` para o novo sistema de logging estruturado.

## Passos para Migração

### 1. Importar o Logger

```javascript
// Adicionar no topo do arquivo
import logger from '../utils/logger.js';
```

### 2. Substituições Comuns

#### Console.log simples → Logger
```javascript
// ❌ Antes
console.log(`[ProcessMessage] 🚀 Iniciando processamento...`);

// ✅ Depois  
logger.start('ProcessMessage', 'Iniciando processamento...');
```

#### Console.log com timing → Logger timing
```javascript
// ❌ Antes
console.log(`[ProcessMessage] ✅ Operação concluída (+${Date.now() - startTime}ms)`);

// ✅ Depois
logger.timing('ProcessMessage', 'Operação concluída');
```

#### Console.error → Logger error
```javascript
// ❌ Antes
console.error(`[ProcessMessage] Erro ao processar:`, error);

// ✅ Depois
logger.error('ProcessMessage', 'Erro ao processar', { error: error.message, stack: error.stack });
```

#### Console.warn → Logger warn
```javascript
// ❌ Antes
console.warn(`[ProcessMessage] ⚠️ Aviso importante`);

// ✅ Depois
logger.warn('ProcessMessage', 'Aviso importante');
```

### 3. Padrões Específicos

#### Início de Função
```javascript
// ✅ No início de cada processamento principal
const messageId = logger.generateMessageId();
logger.start('ComponentName', 'Descrição da operação');
```

#### Debug Detalhado
```javascript
// ✅ Para logs que só devem aparecer em arquivo
logger.debug('ComponentName', 'Informação detalhada', { data: complexObject });
```

#### Marcos Importantes
```javascript
// ✅ Para marcos importantes no fluxo
logger.milestone('ComponentName', 'Marco importante atingido');
```

#### Erros Críticos
```javascript
// ✅ Para erros que precisam atenção imediata
logger.critical('ComponentName', 'Erro crítico detectado', { error: errorData });
```

#### Final de Função
```javascript
// ✅ No final de operações importantes
logger.end('ComponentName', 'Operação concluída com sucesso');
```

## Componentes Recomendados

Use nomes consistentes para componentes:

- `ProcessMessage` - Processamento principal de mensagens
- `ToolCall` - Execução de ferramentas
- `Sanitize` - Sanitização de dados
- `STM` - Gerenciamento de memória de curto prazo
- `LTM` - Operações de memória de longo prazo
- `Profile` - Gerenciamento de perfil do usuário
- `AI` - Operações de IA/LLM
- `WhatsApp` - Operações do WhatsApp
- `Database` - Operações de banco de dados

## Exemplo de Migração Completa

### Antes
```javascript
export default async function processMessage(message) {
  const startTime = Date.now();
  console.log(`[ProcessMessage] 🚀 Iniciando processamento - ${new Date().toISOString()}`);
  
  try {
    console.log(`[ProcessMessage] 📖 Carregando contexto...`);
    const context = await loadContext();
    console.log(`[ProcessMessage] ✅ Contexto carregado (+${Date.now() - startTime}ms)`);
    
    // ... processamento ...
    
    console.log(`[ProcessMessage] ✅ Concluído (+${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error(`[ProcessMessage] Erro:`, error);
  }
}
```

### Depois
```javascript
import logger from '../utils/logger.js';

export default async function processMessage(message) {
  const messageId = logger.generateMessageId();
  logger.start('ProcessMessage', 'Iniciando processamento');
  
  try {
    logger.debug('ProcessMessage', 'Carregando contexto...');
    const context = await loadContext();
    logger.timing('ProcessMessage', 'Contexto carregado');
    
    // ... processamento ...
    
    logger.end('ProcessMessage', 'Processamento concluído com sucesso');
  } catch (error) {
    logger.critical('ProcessMessage', 'Erro no processamento', { 
      error: error.message, 
      stack: error.stack 
    });
  }
}
```

## Comandos Úteis Durante a Migração

```bash
# Ver todos os logs de erro
npm run logs:errors

# Ver logs em tempo real
npm run logs:follow

# Ver logs de um processamento específico
npm run logs -- --message-id abc12345

# Listar todos os arquivos de log
npm run logs:list

# Ver apenas os últimos logs
npm run logs:tail
```

## Benefícios da Migração

1. **Console mais limpo** - Apenas erros críticos aparecem no terminal
2. **Rastreabilidade** - Cada mensagem tem um ID único para rastreamento completo
3. **Análise histórica** - Logs persistentes permitem análise posterior
4. **Debugging facilitado** - Logs estruturados e pesquisáveis
5. **Performance** - Timing automático em todas as operações
6. **Organização** - Logs separados por nível e componente
