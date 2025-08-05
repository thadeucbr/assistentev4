# 📅 Configuração Rápida do Google Calendar

Este guia te ajuda a configurar a integração com Google Calendar em poucos passos.

## 🚀 Configuração Rápida (Service Account + Email Principal)

### Passo 1: Configure a Service Account

1. **Acesse o Google Cloud Console**: https://console.cloud.google.com/
2. **Ative a API do Calendar**: APIs & Services > Library > Google Calendar API
3. **Crie uma Service Account**: APIs & Services > Credentials > Create Credentials > Service Account
4. **Baixe as credenciais**: Clique na service account criada > Keys > Add Key > JSON
5. **Salve o arquivo**: Renomeie para `google-credentials.json` e coloque na raiz do projeto

### Passo 2: Configure seu Email Principal

Execute o script de configuração:

```bash
node setupCalendarEmail.js seu_email@gmail.com
```

Exemplo:
```bash
node setupCalendarEmail.js joao.silva@gmail.com
```

### Passo 3: Compartilhe seu Calendário

1. Abra [Google Calendar](https://calendar.google.com)
2. Clique na engrenagem ⚙️ > Configurações
3. Clique no seu calendário na barra lateral
4. Role até "Compartilhar com pessoas específicas"
5. Clique em "Adicionar pessoas"
6. Cole o email da service account (está no arquivo `google-credentials.json`, campo `client_email`)
7. Selecione permissão: **"Fazer alterações nos eventos"**
8. Clique em "Enviar"

## ✅ Pronto! Como Testar

1. **Teste a integração**:
   ```bash
   node testCalendarFeature.js
   ```

2. **Use no WhatsApp**:
   - "Agendar reunião para amanhã às 14h"
   - "Criar evento para sexta-feira às 10h30"
   - "Listar meus eventos"

## 🎯 O que Acontece Agora

- ✅ Eventos são criados no calendário compartilhado
- ✅ Você recebe convites automáticos por email
- ✅ Arquivos .ics são gerados para importar em outros calendários
- ✅ Notificações funcionam normalmente

## 🔧 Variáveis de Ambiente

O arquivo `.env` deve conter:

```env
# Google Calendar Configuration
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
GOOGLE_CALENDAR_OWNER_EMAIL=seu_email@gmail.com
```

## 🆘 Problemas Comuns

### Erro: "Calendar not found"
- Verifique se compartilhou o calendário corretamente
- Confirme se deu permissão de "Fazer alterações nos eventos"

### Não recebo convites
- Verifique se o email está correto no arquivo `.env`
- Confirme se a variável `GOOGLE_CALENDAR_OWNER_EMAIL` está configurada

### Eventos não aparecem
- Verifique se está olhando o calendário correto
- Os eventos aparecerão em "Calendários compartilhados"

## 🔄 Alternativa: OAuth2

Se preferir usar OAuth2 (acesso direto à sua conta), veja a documentação completa em `CALENDAR_FEATURE.md`.

---

**💡 Dica**: Esta configuração permite que o assistente crie eventos em um calendário compartilhado, e você recebe convites automáticos. É a melhor solução para usar Service Account acessando seu calendário pessoal!
