# Feature: Integração com Google Calendar

Esta feature permite ao assistente virtual agendar eventos no Google Calendar e gerar arquivos iCal para que os usuários possam importar os eventos em seus próprios calendários.

## Funcionalidades

### 1. Agendamento de Eventos
- Criação automática de eventos no Google Calendar pessoal
- Extração inteligente de informações da conversa (título, data, hora)
- Suporte a descrições, locais e participantes

### 2. Geração de Arquivos iCal
- Criação de arquivos .ics para cada evento
- Compatível com Google Calendar, Outlook, Apple Calendar, etc.
- Arquivos salvos em `temp_calendar/`

### 3. Listagem de Eventos
- Visualização de próximos eventos
- Formatação amigável das informações

## Configuração

### Opção 1: OAuth2 (Recomendado - Acessa SEU calendário)

Esta opção permite que o assistente acesse diretamente o seu calendário pessoal do Google.

#### 1. Configurar OAuth2 no Google Cloud Console

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a API do Google Calendar
4. Vá em "APIs & Services" > "Credentials"
5. Clique em "Create Credentials" > "OAuth 2.0 Client IDs"
6. Configure o tipo como "Web application"
7. Adicione `http://localhost:3000/oauth/callback` nas URIs de redirecionamento autorizadas
8. Copie o Client ID e Client Secret

#### 2. Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```env
# Google Calendar OAuth2 Configuration
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback
```

#### 3. Executar Configuração OAuth2

Execute o script de configuração:

```bash
node setupGoogleOAuth.js
```

Este script irá:
1. Gerar uma URL de autorização
2. Abrir um servidor local para receber o callback
3. Salvar o token de acesso em `google-token.json`

### Opção 2: Service Account (Calendário separado)

Esta opção cria eventos em um calendário da conta de serviço. Para acessar seu calendário pessoal, você precisa compartilhá-lo com a service account.

#### 1. Credenciais do Google Calendar

Para usar esta opção, você precisa configurar as credenciais do Google Cloud:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative a API do Google Calendar
4. Crie uma conta de serviço (Service Account)
5. Baixe as credenciais em formato JSON
6. Salve o arquivo como `google-credentials.json` na raiz do projeto

#### 2. Compartilhar seu calendário com a Service Account

1. Acesse [Google Calendar](https://calendar.google.com)
2. No lado esquerdo, encontre "Meus calendários"
3. Clique nos 3 pontos (⋮) ao lado do seu calendário principal
4. Selecione "Configurações e compartilhamento"
5. Role até a seção "Compartilhar com pessoas específicas" ou "Pessoas específicas"
6. Clique em "Adicionar pessoas" e adicione o email da service account (campo `client_email` do arquivo JSON)
7. Defina as permissões como "Fazer alterações nos eventos"
8. Clique em "Enviar"

#### 3. Configurar Email Principal (Recomendado)

Para receber convites automáticos de todos os eventos criados, configure seu email principal:

1. No arquivo `.env`, defina a variável:
```env
GOOGLE_CALENDAR_OWNER_EMAIL=seu_email@gmail.com
```

2. Com isso configurado, você será automaticamente adicionado como participante obrigatório em todos os eventos e receberá convites por email.

#### 4. Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```env
# Google Calendar Service Account Configuration
GOOGLE_CREDENTIALS_PATH=./google-credentials.json

# Email principal para receber convites automáticos
GOOGLE_CALENDAR_OWNER_EMAIL=seu_email@gmail.com
```

### 3. Estrutura do Arquivo de Credenciais

O arquivo `google-credentials.json` deve ter a seguinte estrutura:

```json
{
  "type": "service_account",
  "project_id": "seu-projeto-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "service-account@seu-projeto.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/service-account%40seu-projeto.iam.gserviceaccount.com"
}
```

## Como Usar

### Exemplos de Comandos

1. **Criar um evento:**
   - "Agendar reunião para amanhã às 14h"
   - "Criar evento para sexta-feira às 10h30"
   - "Marcar compromisso para segunda às 9h"

2. **Listar eventos:**
   - "Quais são meus próximos eventos?"
   - "Mostrar minha agenda"
   - "Listar compromissos da semana"

3. **Informações detalhadas:**
   - "Agendar reunião com cliente X na terça-feira às 15h no escritório"

## Arquitetura

### Componentes

1. **GoogleCalendarService** (`src/services/GoogleCalendarService.js`)
   - Integração direta com a API do Google Calendar
   - Autenticação via Service Account
   - CRUD completo de eventos

2. **ICalService** (`src/services/ICalService.js`)
   - Geração de arquivos .ics
   - Suporte a eventos únicos e múltiplos
   - Compatibilidade com padrões iCalendar

3. **CalendarAgent** (`src/agents/CalendarAgent.js`)
   - Processamento inteligente de solicitações
   - Análise de intenção (criar, listar, deletar)
   - Coordenação entre serviços

4. **calendar.js** (`src/skills/calendar.js`)
   - Interface principal para o sistema de IA
   - Validação de parâmetros
   - Tratamento de erros

### Fluxo de Execução

1. Usuário envia mensagem com solicitação de calendário
2. IA identifica a intenção e chama `calendar_agent`
3. CalendarAgent analisa a solicitação e determina a ação
4. Para criação de eventos:
   - GoogleCalendarService cria o evento
   - ICalService gera arquivo .ics
   - Usuário recebe confirmação e arquivo

## Melhorias Futuras

### Processamento de Linguagem Natural
- Integração com modelos de NLP para extração mais precisa de datas/horas
- Suporte a linguagem natural complexa ("na próxima terça depois do almoço")

### Funcionalidades Avançadas
- Edição de eventos existentes
- Lembretes personalizados
- Convites por email
- Sincronização bidirecional

### Interface de Usuário
- Webhook para envio de arquivos .ics via WhatsApp
- Links de download temporários
- Integração com serviços de armazenamento em nuvem

## Dependências

- `googleapis`: Integração com APIs do Google
- `ical-generator`: Geração de arquivos iCalendar
- Dependências existentes do projeto

## Segurança

- Credenciais armazenadas de forma segura
- Validação de parâmetros de entrada
- Logs detalhados para auditoria
- Limpeza automática de arquivos temporários (a implementar)

## Logs

A feature utiliza o sistema de logs existente do projeto:

- **Info**: Eventos criados, arquivos gerados
- **Debug**: Fluxo de execução, parâmetros
- **Error**: Falhas de autenticação, erros de API

## Troubleshooting

### Problemas Comuns

1. **Erro de autenticação**
   - Verificar se o arquivo de credenciais está correto
   - Confirmar se a API do Calendar está ativada
   - Verificar permissões da Service Account

2. **Eventos não aparecem**
   - Confirmar se está usando o calendário correto
   - Verificar fuso horário configurado

3. **Arquivos .ics não funcionam**
   - Verificar se o diretório `temp_calendar` existe
   - Confirmar permissões de escrita
