# 🔧 Instruções para Corrigir OAuth2 no Google Cloud Console

## ⚠️ Problema Atual
O redirect URI está incorreto. Para aplicações desktop, precisa ser `urn:ietf:wg:oauth:2.0:oob`.

## 🛠️ Solução Rápida

### Opção 1: Atualizar Credenciais Desktop Existentes

1. **Acesse o Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials
   - Projeto: `gen-lang-client-0425807293`

2. **Edite as credenciais desktop:**
   - Clique no Client ID que termina com `...afc8.apps.googleusercontent.com`
   - Em **Authorized redirect URIs**, remova `http://localhost`
   - Adicione: `urn:ietf:wg:oauth:2.0:oob`
   - Clique **SAVE**

3. **Baixe as credenciais atualizadas:**
   - Clique no ícone de download
   - Substitua o arquivo `google-oauth-desktop-credentials.json`

### Opção 2: Criar Novas Credenciais (Recomendado)

1. **Criar nova credencial:**
   - Clique **+ CREATE CREDENTIALS**
   - Selecione **OAuth 2.0 Client IDs**
   - **Application type:** `Desktop application`
   - **Name:** `Assistente Calendar Desktop v2`

2. **Configurar redirect URI:**
   - O Google automaticamente adiciona `urn:ietf:wg:oauth:2.0:oob` para desktop
   - Clique **CREATE**

3. **Baixar credenciais:**
   - Baixe o JSON
   - Salve como `google-oauth-desktop-credentials.json`

## 🧪 Testar

Após corrigir:

```bash
node setupGoogleOAuthDesktop.js
```

## 📋 Formato Correto do Arquivo

O arquivo `google-oauth-desktop-credentials.json` deve ter:

```json
{
  "installed": {
    "client_id": "...",
    "client_secret": "...",
    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"],
    ...
  }
}
```

## 🎯 Por que isso aconteceu?

- **Desktop applications** usam `urn:ietf:wg:oauth:2.0:oob`
- **Web applications** usam `http://localhost:port/callback`
- O Google Cloud às vezes confunde os tipos

---

**🚀 Próximo passo:** Corrija no Google Cloud Console e execute o script novamente!
