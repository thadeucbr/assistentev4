# Configuração do Google Calendar - Passo a Passo

## Opção 1: Service Account com Email Principal (Recomendado para Início)

Esta é a opção mais simples para começar. O bot criará eventos em um calendário separado, mas você receberá convites automáticos.

### Passo 1: Configurar Service Account no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a API do Google Calendar:
   - Vá em "APIs & Services" > "Library"
   - Procure por "Google Calendar API"
   - Clique em "Enable"

4. Crie uma Service Account:
   - Vá em "APIs & Services" > "Credentials"
   - Clique em "Create Credentials" > "Service Account"
   - Preencha o nome (ex: "assistente-calendar")
   - Clique em "Create and Continue"
   - Pule as permissões opcionais e clique em "Done"

5. Baixe as credenciais:
   - Clique na service account criada
   - Vá na aba "Keys"
   - Clique em "Add Key" > "Create New Key"
   - Selecione "JSON" e clique em "Create"
   - Salve o arquivo como `google-credentials.json` na raiz do projeto

### Passo 2: Configurar Email Principal

Execute o comando:
```bash
node setupCalendarEmail.js seu_email@gmail.com
```

Ou adicione manualmente no arquivo `.env`:
```env
GOOGLE_CALENDAR_OWNER_EMAIL=seu_email@gmail.com
```

### Passo 3: Compartilhar Calendário (Opcional)

Se quiser que os eventos apareçam no seu calendário principal:

1. Acesse [Google Calendar](https://calendar.google.com)
2. No lado esquerdo, encontre "Meus calendários"
3. Clique nos 3 pontos (⋮) ao lado do SEU CALENDÁRIO PRINCIPAL
   - **Importante:** Não clique em calendários importados ou secundários
   - Procure pelo calendário que tem seu nome ou email
4. Selecione "Configurações e compartilhamento"
5. Role a página para baixo até encontrar "Compartilhar com pessoas específicas"
   - Esta seção fica depois de "Permissões de acesso"
   - Se não aparecer, verifique se está no calendário principal correto
6. Clique em "Adicionar pessoas"
7. Adicione o email da service account (está no arquivo `google-credentials.json`, campo `client_email`)
8. Defina as permissões como "Fazer alterações nos eventos"
9. Clique em "Enviar"

### Passo 4: Testar

Execute o teste:
```bash
node testCalendarFeature.js
```

## Opção 2: OAuth2 (Acesso Direto ao Seu Calendário)

Esta opção permite acesso direto ao seu calendário pessoal, mas é mais complexa de configurar.

### Passo 1: Configurar OAuth2 no Google Cloud

1. No Google Cloud Console, vá em "APIs & Services" > "Credentials"
2. Clique em "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure o tipo como "Web application"
4. Em "Authorized redirect URIs", adicione: `http://localhost:3000/oauth/callback`
5. Copie o Client ID e Client Secret

### Passo 2: Configurar Variáveis

Adicione no `.env`:
```env
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

### Passo 3: Autorizar Acesso

Execute:
```bash
node setupGoogleOAuth.js
```

Este script irá:
1. Abrir uma URL no seu navegador
2. Pedir autorização para acessar seu calendário
3. Salvar o token de acesso

## Como Funciona

### Com Service Account + Email Principal:
1. Bot cria evento no calendário da service account
2. Você é automaticamente adicionado como participante obrigatório
3. Recebe convite por email
4. Pode aceitar/recusar normalmente
5. Arquivo .ics é gerado para importar em outros calendários

### Com OAuth2:
1. Bot acessa diretamente seu calendário pessoal
2. Eventos aparecem imediatamente na sua agenda
3. Arquivo .ics é gerado para compartilhar

## Troubleshooting

### Erro de Autenticação
- Verifique se a API do Calendar está ativada
- Confirme se as credenciais estão corretas
- Para Service Account: verifique se o arquivo JSON está no local correto

### Não recebo convites
- Verifique se `GOOGLE_CALENDAR_OWNER_EMAIL` está correto no `.env`
- Confirme se o email da service account foi adicionado ao seu calendário

### Eventos não aparecem no meu calendário
- Para Service Account: você precisa compartilhar seu calendário (Passo 3 da Opção 1)
- Para OAuth2: eventos devem aparecer automaticamente

## Estrutura de Arquivos

```
assistentev4/
├── google-credentials.json          # Credenciais da Service Account
├── google-credentials.example.json  # Exemplo de credenciais
├── google-token.json               # Token OAuth2 (gerado automaticamente)
├── setupCalendarEmail.js           # Script de configuração do email
├── setupGoogleOAuth.js             # Script de configuração OAuth2
├── testCalendarFeature.js          # Teste da funcionalidade
└── temp_calendar/                  # Arquivos .ics gerados
    ├── evento_123456.ics
    └── evento_789012.ics
```
