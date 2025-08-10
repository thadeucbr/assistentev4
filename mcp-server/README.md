# Assistente MCP Server

Este é o servidor MCP (Model Context Protocol) para o Assistente WhatsApp. Ele expõe todas as funcionalidades do assistente através de um protocolo padronizado que pode ser consumido por diferentes clientes AI, incluindo a OpenAI.

## Funcionalidades Disponíveis

### 🎨 Geração de Imagem
- **Tool**: `image_generation`
- **Descrição**: Gera imagens baseadas em prompts de texto
- **Parâmetros**:
  - `prompt` (string, obrigatório): Descrição da imagem
  - `model` (string, opcional): Modelo a usar (dall-e-3, dall-e-2, etc.)

### 🔍 Análise de Imagem
- **Tool**: `image_analysis`
- **Descrição**: Analisa imagens e extrai informações
- **Parâmetros**:
  - `id` (string, obrigatório): ID da imagem ou dados base64
  - `prompt` (string, opcional): Prompt para guiar a análise

### 🎵 Geração de Áudio
- **Tool**: `audio_generation`
- **Descrição**: Converte texto em fala
- **Parâmetros**:
  - `text` (string, obrigatório): Texto para conversão
  - `voice` (string, opcional): Voz a usar
  - `speed` (number, opcional): Velocidade da fala

### 📅 Gerenciamento de Calendário
- **Tool**: `calendar_management`
- **Descrição**: Gerencia eventos do Google Calendar
- **Parâmetros**:
  - `userId` (string, obrigatório): ID do usuário
  - `query` (string, obrigatório): Operação desejada

### 🎲 Verificação de Loteria
- **Tool**: `lottery_check`
- **Descrição**: Verifica resultados de loterias brasileiras
- **Parâmetros**:
  - `query` (string, obrigatório): Consulta sobre loteria

### ⏰ Gerenciamento de Lembretes
- **Tool**: `reminder_management`
- **Descrição**: Cria e gerencia lembretes
- **Parâmetros**:
  - `userId` (string, obrigatório): ID do usuário
  - `query` (string, obrigatório): Operação desejada

### 😊 Análise de Sentimento
- **Tool**: `sentiment_analysis`
- **Descrição**: Analisa o sentimento de textos
- **Parâmetros**:
  - `text` (string, obrigatório): Texto para análise

### 🎭 Inferência de Estilo de Interação
- **Tool**: `interaction_style_inference`
- **Descrição**: Infere o estilo de comunicação do usuário
- **Parâmetros**:
  - `message` (string, obrigatório): Mensagem para análise

### 👤 Atualização de Perfil
- **Tool**: `user_profile_update`
- **Descrição**: Atualiza resumo do perfil do usuário
- **Parâmetros**:
  - `userId` (string, obrigatório): ID do usuário
  - `conversationHistory` (array, obrigatório): Histórico da conversa

### 🌐 Requisições HTTP
- **Tool**: `http_request`
- **Descrição**: Faz requisições HTTP para APIs externas
- **Parâmetros**:
  - `url` (string, obrigatório): URL do endpoint
  - `method` (string, opcional): Método HTTP
  - `headers` (object, opcional): Cabeçalhos HTTP
  - `body` (string, opcional): Corpo da requisição

## Instalação e Configuração

### 1. Instalar Dependências
```bash
cd mcp-server
npm install
```

### 2. Configurar Variáveis de Ambiente
Copie as variáveis de ambiente do projeto principal ou configure o arquivo `.env` local.

### 3. Executar o Servidor
```bash
# Modo produção
npm start

# Modo desenvolvimento
npm run dev
```

### 4. Testar o Servidor
```bash
node test-server.js
```

## Integração com OpenAI

Para usar este servidor MCP com a OpenAI, você precisará:

1. **Configurar o Cloudflare Zero Trust** (como mencionado que já está configurado)
2. **Expor o servidor** através do Cloudflare Tunnel
3. **Configurar a OpenAI** para usar o servidor MCP remoto

### Exemplo de configuração para OpenAI:

```json
{
  "mcpServers": {
    "assistente-whatsapp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch", "https://seu-dominio.trycloudflare.com"],
      "env": {
        "MCP_SERVER_URL": "https://seu-dominio.trycloudflare.com"
      }
    }
  }
}
```

## Arquitetura

O servidor MCP atua como uma ponte entre as tools existentes do projeto e o protocolo MCP, permitindo que:

1. **Reutilização**: As mesmas tools podem ser usadas tanto no WhatsApp quanto via MCP
2. **Padronização**: Interface consistente para diferentes clientes AI
3. **Escalabilidade**: Fácil adição de novas tools
4. **Manutenabilidade**: Separação clara entre lógica de negócio e protocolo

## Estrutura de Pastas

```
mcp-server/
├── index.js          # Servidor principal MCP
├── config.js         # Configurações
├── test-server.js    # Script de teste
├── package.json      # Dependências npm
├── .env              # Variáveis de ambiente
└── README.md         # Esta documentação
```

## Logs e Debugging

O servidor inclui logging detalhado para facilitar o debugging:

- Logs são enviados para `stderr` para não interferir com o protocolo MCP
- Nível de log configurável via `LOG_LEVEL`
- Tratamento de erros robusto com códigos MCP apropriados

## Próximos Passos

1. **Deploy**: Configurar o Cloudflare Tunnel
2. **Monitoramento**: Adicionar métricas e health checks
3. **Documentação**: Expandir exemplos de uso
4. **Testes**: Adicionar testes automatizados
