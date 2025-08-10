# Guia de Integração OpenAI com MCP Server

## Visão Geral

Este guia explica como integrar o servidor MCP do Assistente WhatsApp com a OpenAI para usar ferramentas remotas através do protocolo MCP (Model Context Protocol).

## Pré-requisitos

1. **Servidor MCP funcionando** - O servidor MCP deve estar configurado e acessível
2. **Cloudflare Zero Trust** - Para expor o servidor MCP de forma segura (já configurado conforme mencionado)
3. **Conta OpenAI** - Com acesso à API e recursos de ferramentas remotas

## Estrutura do Projeto

```
assistentev4/
├── mcp-server/                 # Servidor MCP
│   ├── index.js               # Servidor MCP stdio
│   ├── skill-wrappers.js      # Wrappers seguros das skills
│   ├── package.json           # Dependências MCP
│   └── README.md              # Documentação do servidor
├── src/
│   ├── services/
│   │   └── MCPClient.js       # Cliente MCP para uso interno
│   └── core/tools/
│       └── HybridToolExecutor.js  # Executor híbrido (local + MCP)
├── .env                       # Configurações (MCP_ENABLED=true)
└── mcp-dev.sh                 # Script de desenvolvimento
```

## Configuração do Servidor MCP

### 1. Instalação e Teste

```bash
# Instalar dependências do servidor MCP
cd mcp-server
npm install

# Testar o servidor
node test-server.js

# Ou usar o script de desenvolvimento
cd ..
bash mcp-dev.sh test
```

### 2. Configuração do Cloudflare Tunnel

Para expor o servidor MCP de forma segura, configure um tunnel do Cloudflare:

```bash
# Instalar cloudflared (se não estiver instalado)
# Debian/Ubuntu:
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install cloudflared

# Criar tunnel para o servidor MCP
cloudflared tunnel create assistente-mcp

# Configurar arquivo de configuração
# ~/.cloudflared/config.yml
```

Exemplo de `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/usuario/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: assistente-mcp.seudominio.com
    service: stdio+unix:///tmp/mcp-server.sock
    originRequest:
      httpHostHeader: assistente-mcp.seudominio.com
  - service: http_status:404
```

### 3. Executar o Servidor com Tunnel

```bash
# Iniciar o tunnel
cloudflared tunnel run assistente-mcp

# Em outro terminal, iniciar o servidor MCP
bash mcp-dev.sh start
```

## Configuração na OpenAI

### 1. Arquivo de Configuração MCP

Crie um arquivo de configuração para a OpenAI que referencia seu servidor MCP remoto:

```json
{
  "mcpServers": {
    "assistente-whatsapp": {
      "command": "stdio",
      "args": ["https://assistente-mcp.seudominio.com"],
      "env": {
        "MCP_SERVER_URL": "https://assistente-mcp.seudominio.com"
      }
    }
  }
}
```

### 2. Integração via API da OpenAI

Se estiver usando a API da OpenAI diretamente, você pode configurar ferramentas remotas:

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configurar ferramentas MCP
const mcpTools = [
  {
    type: "function",
    function: {
      name: "assistente_image_generation",
      description: "Generate images using the WhatsApp assistant's MCP server",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Image generation prompt" }
        },
        required: ["prompt"]
      }
    }
  }
  // ... outras ferramentas
];

// Usar nas chamadas da API
const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "user", content: "Generate an image of a sunset" }
  ],
  tools: mcpTools
});
```

## Ferramentas Disponíveis via MCP

O servidor MCP expõe as seguintes ferramentas:

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `image_generation` | Gerar imagens com IA | `prompt`, `model?` |
| `image_analysis` | Analisar imagens | `id`, `prompt?` |
| `audio_generation` | Gerar áudio TTS | `text`, `voice?`, `speed?` |
| `calendar_management` | Gerenciar Google Calendar | `userId`, `query` |
| `lottery_check` | Verificar loterias brasileiras | `query` |
| `reminder_management` | Gerenciar lembretes | `userId`, `query` |
| `sentiment_analysis` | Analisar sentimento | `text` |
| `interaction_style_inference` | Inferir estilo de interação | `message` |
| `user_profile_update` | Atualizar perfil do usuário | `userId`, `conversationHistory` |
| `http_request` | Requisições HTTP | `url`, `method?`, `headers?`, `body?` |

## Uso Interno (Projeto Principal)

O projeto também pode usar o MCP internamente:

### 1. Habilitar MCP

```bash
# Habilitar MCP no .env
MCP_ENABLED=true
MCP_SERVER_PATH=/home/thadeu/assistentev4/mcp-server/index.js
```

### 2. O HybridToolExecutor

O `HybridToolExecutor` automaticamente:
- Verifica se o MCP está disponível
- Executa ferramentas via MCP quando possível
- Faz fallback para execução local em caso de erro
- Mapeia tools do projeto para tools MCP

### 3. Exemplo de Uso

```javascript
import { HybridToolExecutor } from './src/core/tools/HybridToolExecutor.js';

const executor = new HybridToolExecutor();

// As ferramentas são executadas automaticamente via MCP se disponível
const result = await executor.executeTools(
  messages, 
  response, 
  tools, 
  from, 
  id, 
  userContent, 
  messageData
);
```

## Scripts de Desenvolvimento

### Comandos Úteis

```bash
# Status do servidor MCP
bash mcp-dev.sh status

# Testar servidor
bash mcp-dev.sh test

# Iniciar servidor em modo desenvolvimento
bash mcp-dev.sh dev

# Parar todos os servidores
bash mcp-dev.sh stop
```

## Monitoramento e Logs

### 1. Logs do Servidor MCP

```bash
# Ver logs em tempo real
bash mcp-dev.sh logs

# Logs de erro
grep ERROR /tmp/mcp-server.log

# Estatísticas de uso
grep "executada com sucesso" /tmp/mcp-server.log | wc -l
```

### 2. Monitoramento de Performance

O servidor MCP inclui métricas básicas que podem ser acessadas (se usando a versão HTTP):

```bash
curl http://localhost:3001/metrics
```

## Segurança

### 1. Autenticação

Para produção, configure uma API key:

```bash
# No .env
MCP_API_KEY=sua-chave-secreta-aqui
```

### 2. CORS

Configure origins permitidas:

```bash
# No .env
ALLOWED_ORIGINS=https://api.openai.com,https://chat.openai.com
```

## Troubleshooting

### Problemas Comuns

1. **Servidor MCP não responde**
   ```bash
   bash mcp-dev.sh status
   bash mcp-dev.sh start
   ```

2. **Ferramentas falhando**
   - Verificar configurações no `.env`
   - Verificar logs: `bash mcp-dev.sh logs`
   - Testar individualmente: `bash mcp-dev.sh test`

3. **Problemas de rede**
   - Verificar Cloudflare tunnel
   - Testar conectividade: `ping assistente-mcp.seudominio.com`

4. **Fallback para local**
   - MCP automaticamente faz fallback para execução local
   - Verificar logs para identificar problemas MCP

## Próximos Passos

1. **Deploy em Produção**
   - Configurar Cloudflare Tunnel em produção
   - Implementar monitoramento e alertas
   - Configurar backup/recovery

2. **Otimizações**
   - Cache de resultados para ferramentas pesadas
   - Load balancing para múltiplas instâncias MCP
   - Métricas avançadas e observabilidade

3. **Extensões**
   - Adicionar novas ferramentas ao servidor MCP
   - Integrar com outros clients além da OpenAI
   - Implementar autenticação mais robusta
