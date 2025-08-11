# 🧠 Sistema de Debug de Personalidade

## 📋 Como Usar

### 1. **Logs Automáticos**
O sistema agora gera logs detalhados automaticamente para cada interação:

- **🎭 ORCHESTRATOR**: Logs do orquestrador principal
- **🧬 EVOLUTION**: Logs do sistema de evolução
- **💭 EMOTIONAL**: Logs do motor emocional
- **📝 MESSAGEPROCESSOR**: Logs da integração no messageProcessor

### 2. **Filtrar Logs por Message ID**

Quando o usuário enviar uma mensagem, você receberá um **messageId** nos logs. Use esse ID para ver todo o fluxo:

```bash
# Dentro do container Docker:
node src/scripts/personalityDebugger.js [messageId]
```

**Exemplo:**
```bash
node src/scripts/personalityDebugger.js a1b2c3d4
```

### 3. **Ver Todos os Logs de Personalidade**

```bash
# Todos os logs recentes:
node src/scripts/personalityDebugger.js
```

### 4. **Grep Rápido nos Logs**

```bash
# Filtrar apenas logs PERSONALITY:
grep "PERSONALITY-" logs/*_debug.log | tail -50

# Ver logs específicos por componente:
grep "PERSONALITY-ORCHESTRATOR" logs/*_debug.log
grep "PERSONALITY-EVOLUTION" logs/*_debug.log
grep "PERSONALITY-EMOTIONAL" logs/*_debug.log
```

## 🔍 O Que os Logs Mostram

### **Fluxo Completo de uma Interação:**

1. **📥 ENTRADA**: Dados recebidos (userId, mensagem, sentimento)
2. **🧬 EVOLUÇÃO**: Como a personalidade evolui
3. **💭 EMOCIONAL**: Mudanças no estado emocional
4. **🎭 CARACTERIZAÇÃO**: Personalidade atual gerada
5. **📝 PROMPT**: Como o prompt é construído
6. **✅ RESULTADO**: Estado final e metadados

### **Informações Importantes nos Logs:**

- **mood**: Humor atual do assistente
- **formationLevel**: Nível de maturidade da personalidade (0-1)
- **evolutionApplied**: Se houve mudança na personalidade
- **emotionalChanges**: Quais emoções mudaram
- **adaptiveBehaviors**: Comportamentos adaptativos ativos

## 🚀 Como Testar

1. Envie uma mensagem para o assistente
2. Pegue o **messageId** que aparece nos logs
3. Execute: `node src/scripts/personalityDebugger.js <messageId>`
4. Analise o fluxo completo da evolução da personalidade!

## 📊 Exemplo de Saída

```
🧠 DEBUGGER DE PERSONALIDADE

📱 MESSAGE ID: a1b2c3d4
⏰ TIMESTAMP: 11/08/2025, 19:15:30
----------------------------------------
[19:15:30] ORCHESTRATOR: INÍCIO: Processando interação para evolução
   📊 Dados: {
     "userId": "user123",
     "messageLength": 25,
     "userSentiment": "positive"
   }

[19:15:30] EVOLUTION: EVOLUÇÃO PROCESSADA:
   📊 Dados: {
     "evolutionApplied": true,
     "newMood": "happy",
     "formationLevel": 0.245
   }
```

Com esse sistema, você pode acompanhar em tempo real como o assistente está "pensando" e evoluindo! 🎯
