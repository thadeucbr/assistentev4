# 🔐 Configuração OAuth2 - Google Calendar (Docker)

## 📋 Passos para Configurar OAuth2

### 1. Configurar Credenciais no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Vá em **APIs & Services** > **Credentials**
3. Clique em **Create Credentials** > **OAuth 2.0 Client IDs**
4. Selecione tipo: **Web application**
5. Nome: **Assistente Calendar**
6. **Authorized redirect URIs**: `http://localhost:3000/oauth/callback`
7. Clique em **Create**
8. **Baixe o arquivo JSON** das credenciais

### 2. Salvar Credenciais

1. Salve o arquivo baixado como `google-oauth-credentials.json` na raiz do projeto
2. Certifique-se que o arquivo está no mesmo diretório que o `setupGoogleOAuth.js`

### 3. Executar Configuração

```bash
# No container Docker
node setupGoogleOAuth.js
```

### 4. Processo de Autorização

1. O script irá gerar uma **URL de autorização**
2. **Copie a URL** e abra no seu navegador
3. **Faça login** na sua conta Google
4. **Autorize** o acesso ao Google Calendar
5. Após autorizar, você será redirecionado para uma página com um código
6. **Copie o código** da URL (depois de `code=`)
7. **Cole o código** no terminal quando solicitado

### 5. Atualização Automática

O script irá:
- ✅ Salvar o token de acesso em `google-token.json`
- ✅ Atualizar o arquivo `.env` com as configurações OAuth2
- ✅ Testar o acesso ao Google Calendar

## 🐳 Docker Considerations

### Por que usar OAuth2 no Docker?

- **✅ Simplicidade**: Não precisa compartilhar calendários
- **✅ Acesso Direto**: Eventos criados diretamente no seu calendário
- **✅ Segurança**: Tokens podem ser renovados automaticamente
- **✅ Controle Total**: Você mantém controle sobre os dados

### Diferença do Service Account

| Método | Service Account | OAuth2 |
|--------|----------------|--------|
| **Setup** | Mais complexo | Mais simples |
| **Acesso** | Via email sharing | Direto ao calendário |
| **Eventos** | Em calendário compartilhado | No seu calendário principal |
| **Controle** | Limitado | Total |

## 🔧 Configuração Manual Alternativa

Se preferir configurar manualmente, adicione no `.env`:

```env
# Google Calendar OAuth2 Configuration
GOOGLE_CALENDAR_AUTH_TYPE=oauth2
GOOGLE_OAUTH_CREDENTIALS_PATH=./google-oauth-credentials.json
GOOGLE_TOKEN_PATH=./google-token.json
```

## 🚀 Testando a Configuração

Após completar a configuração:

```bash
# Teste via script
node testCalendarFeature.js

# Ou teste via WhatsApp
"agendar reunião para amanhã às 15h"
```

## 🔄 Renovação de Token

O sistema irá automaticamente:
- Detectar tokens expirados
- Renovar usando o refresh token
- Salvar o novo token

## ❗ Troubleshooting

### Token Expirado
```bash
node setupGoogleOAuth.js
```

### Credenciais Inválidas
1. Verifique se `google-oauth-credentials.json` está correto
2. Verifique se a URL de redirect está configurada corretamente
3. Certifique-se que as APIs estão habilitadas no Google Cloud

### Problemas de Docker
- OAuth2 funciona melhor que Service Account em containers
- Não requer configuração de rede específica
- Tokens são persistidos em arquivos locais

## 📁 Arquivos Necessários

```
projeto/
├── google-oauth-credentials.json    # Credenciais do Google Cloud
├── google-token.json               # Token gerado (auto-criado)
├── setupGoogleOAuth.js             # Script de configuração
└── .env                            # Configurações (auto-atualizado)
```
