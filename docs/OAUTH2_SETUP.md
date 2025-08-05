# Configuração OAuth2 para Google Calendar

## Por que OAuth2?

Quando você usa uma **Service Account**, ela cria eventos em seu próprio calendário separado, não no seu calendário pessoal do Gmail. Para que o assistente crie eventos diretamente no **seu** calendário pessoal, você precisa usar OAuth2.

## Passos para Configuração

### 1. Configurar no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione seu projeto ou crie um novo
3. Ative a **Google Calendar API**:
   - Vá em "APIs & Services" > "Library"
   - Procure por "Google Calendar API"
   - Clique em "Enable"

4. Criar credenciais OAuth2:
   - Vá em "APIs & Services" > "Credentials"
   - Clique em "Create Credentials" > "OAuth 2.0 Client IDs"
   - Se for a primeira vez, você precisará configurar a "OAuth consent screen"
   - Selecione "Web application"
   - Em "Authorized redirect URIs", adicione: `http://localhost:3000/oauth/callback`
   - Clique em "Create"

5. Copie o **Client ID** e **Client Secret**

### 2. Configurar Variáveis de Ambiente

Adicione estas linhas ao seu arquivo `.env`:

```env
# Google Calendar OAuth2
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

### 3. Executar Script de Autorização

```bash
node setupGoogleOAuth.js
```

O script irá:

1. **Gerar uma URL de autorização** - você verá algo como:
   ```
   🔗 URL de autorização gerada:
   https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A//www.googleapis.com/auth/calendar&response_type=code&client_id=...
   ```

2. **Abrir esta URL no navegador** - você será redirecionado para o Google

3. **Fazer login e autorizar** - o Google pedirá permissão para acessar seu calendário

4. **Receber o código** - você será redirecionado para `http://localhost:3000/oauth/callback`

5. **Salvar o token** - o script salvará automaticamente o token em `google-token.json`

### 4. Verificar se Funcionou

Após a autorização, você verá:

```
✅ Autorização concluída com sucesso!
🎉 O assistente agora pode acessar seu Google Calendar
```

O arquivo `google-token.json` será criado na raiz do projeto.

## Testando

Execute o teste para verificar se está funcionando:

```bash
node testCalendarFeature.js
```

Se tudo estiver configurado corretamente, você verá eventos sendo criados no seu calendário pessoal!

## Resolução de Problemas

### Erro: "redirect_uri_mismatch"

Certifique-se de que você adicionou exatamente `http://localhost:3000/oauth/callback` nas URIs de redirecionamento no Google Cloud Console.

### Erro: "access_denied"

Você pode ter negado a permissão durante a autorização. Execute o script novamente e clique em "Allow" quando o Google pedir permissões.

### Token expirado

O OAuth2 service renova automaticamente o token quando necessário. Se houver problemas, delete o arquivo `google-token.json` e execute `setupGoogleOAuth.js` novamente.

### Calendário não é o principal

O sistema está configurado para usar o calendário principal (`primary`). Se você quiser usar um calendário específico, modifique o código nos serviços para usar o ID do calendário desejado.

## Arquivos Criados

- `google-token.json` - Token de acesso OAuth2 (não versionar)
- `setupGoogleOAuth.js` - Script de configuração
- `src/services/GoogleCalendarOAuthService.js` - Serviço OAuth2

## Segurança

- Nunca versione o arquivo `google-token.json`
- Mantenha suas credenciais OAuth2 seguras
- O token é renovado automaticamente quando expira
