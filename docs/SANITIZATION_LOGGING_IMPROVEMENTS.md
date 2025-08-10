# Melhorias nos Logs de Sanitização

## Problema Identificado

Os logs anteriores de sanitização eram muito básicos e não forneciam contexto suficiente para debug:

```
[SANITIZE] Removendo mensagem assistant vazia ou sem conteúdo
[SANITIZE] Removendo mensagem tool órfã: tool_call_id=undefined
[SANITIZE] Mensagens sanitizadas: 13 -> 11
```

## Melhorias Implementadas

### 1. **Logs Detalhados de Análise**

Agora você pode ver **exatamente** o que está acontecendo durante a sanitização:

```
🔵 [abc12345|2] Sanitize: Iniciando sanitização de 13 mensagens
🔵 [abc12345|2] Sanitize: Analisando assistant message [3] com 2 tool_calls: call_123, call_456
🔵 [abc12345|2] Sanitize:   Procurando respostas para tool_calls: call_123, call_456  
🔵 [abc12345|2] Sanitize:   Encontradas 1/2 respostas: [5] tool_call_id=call_123
🟡 [abc12345|2] Sanitize:   ❌ Tool_calls incompletos - esperado 2, encontrado 1
```

### 2. **Rastreamento de Tool Calls Órfãos**

Agora você vê **por que** uma tool está órfã:

```
🟡 [abc12345|2] Sanitize:   🗑️ [7] Removendo tool órfã {
  tool_call_id: "call_456",
  hasValidId: true,
  isInValidSet: false,
  contentPreview: "Mensagem enviada ao usuário: Olá! Como posso...",
  validToolCallIds: ["call_123", "call_789"]
}
```

### 3. **Resumo Final com Estatísticas**

```
🎯 [abc12345|2] MILESTONE Sanitize: Sanitização concluída: 13 → 11 {
  removed: {
    assistant: 1,
    tool: 1,
    total: 2
  },
  kept: 11,
  validToolCallIds: ["call_123", "call_789"],
  issues: {
    incompleteToolCalls: 1,
    orphanedTools: 1
  }
}
```

### 4. **Logs de Erro Detalhados para Problemas**

Se houver problemas, agora você recebe logs de erro com detalhes completos:

```
🔴 [abc12345|2] Sanitize: Detectados 1 conjuntos de tool_calls incompletos {
  details: [{
    assistantIndex: 3,
    expected: ["call_123", "call_456"], 
    found: ["call_123"],
    missing: ["call_456"]
  }]
}

🔴 [abc12345|2] Sanitize: Detectados 1 tool responses órfãos {
  details: [{
    index: 7,
    tool_call_id: "call_456",
    content: "Mensagem enviada ao usuário...",
    hasValidId: true,
    isInValidSet: false
  }]
}
```

## Como Interpretar os Novos Logs

### **Análise de Tool Calls**
- **✅ Todos os tool_calls têm respostas**: Tool calls válidos
- **❌ Tool_calls incompletos**: Alguns tool_calls não têm resposta correspondente

### **Remoção de Mensagens**
- **🗑️ Removendo assistant órfã**: Assistant com tool_calls que não têm todas as respostas
- **🗑️ Removendo tool órfã**: Tool response sem assistant correspondente ou tool_call_id inválido

### **Campos Importantes nos Logs**
- `hasValidId`: Se a mensagem tool tem um tool_call_id
- `isInValidSet`: Se o tool_call_id está no conjunto de IDs válidos
- `validToolCallIds`: Lista de todos os tool_call_ids considerados válidos
- `expected/found/missing`: O que era esperado vs o que foi encontrado

## Benefícios para Debug

1. **Visibilidade completa** do processo de sanitização
2. **Identificação precisa** da causa de tools órfãs
3. **Rastreamento detalhado** de tool_calls incompletos
4. **Estatísticas** para análise de padrões
5. **Logs estruturados** para investigação posterior

Agora, quando você vir uma tool órfã, os logs mostrarão exatamente:
- Qual tool_call_id ela tem
- Se esse ID é válido
- Por que não foi considerada válida
- Quais IDs são considerados válidos no contexto

Isso facilita muito a identificação de problemas no ciclo de execução de ferramentas!
