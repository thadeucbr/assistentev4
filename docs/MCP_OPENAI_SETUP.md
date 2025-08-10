# Guia de Configuração MCP com OpenAI

Este documento explica como configurar o servidor MCP do Assistente WhatsApp para funcionar com a OpenAI através do Cloudflare Zero Trust.

## 📋 Pré-requisitos

- [x] Servidor MCP implementado e funcionando
- [x] Cloudflare Zero Trust configurado (conforme mencionado pelo usuário)
- [ ] Domínio configurado no Cloudflare
- [ ] Tunnel do Cloudflare configurado

## 🚀 Passos para Configuração

### 1. Preparar o Servidor MCP para Produção

O servidor MCP precisa ser exposto via HTTP para que a OpenAI possa acessá-lo. Vamos criar uma versão HTTP do servidor:

```bash
# Instalar dependências adicionais no MCP server
cd mcp-server
npm install express cors helmet
```

### 2. Configurar Cloudflare Tunnel

Siga estes passos para expor o servidor MCP:

#### 2.1. Instalar Cloudflared (se ainda não tiver)
```bash
# Ubuntu/Debian
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

#### 2.2. Autenticar com Cloudflare
```bash
cloudflared tunnel login
```

#### 2.3. Criar um Tunnel
```bash
cloudflared tunnel create assistente-mcp
```

#### 2.4. Configurar o Tunnel
Crie um arquivo `config.yml` em `~/.cloudflared/config.yml`:

```yaml
tunnel: assistente-mcp
credentials-file: ~/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: assistente-mcp.seu-dominio.com
    service: http://localhost:3001
  - service: http_status:404
```

#### 2.5. Criar DNS Record
```bash
cloudflared tunnel route dns assistente-mcp assistente-mcp.seu-dominio.com
```

#### 2.6. Executar o Tunnel
```bash
cloudflared tunnel run assistente-mcp
```

### 3. Configurar OpenAI para usar MCP

Você precisará configurar a OpenAI para conectar ao seu servidor MCP remoto. Isso pode ser feito através da interface da OpenAI ou via API.

#### 3.1. Configuração via Claude Desktop (Anthropic) - Para teste
```json
{
  "mcpServers": {
    "assistente-whatsapp": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-fetch",
        "https://assistente-mcp.seu-dominio.com"
      ]
    }
  }
}
```

#### 3.2. Configuração via OpenAI ChatGPT
Para usar com OpenAI ChatGPT, você precisará:

1. **Acessar as configurações do GPT customizado**
2. **Adicionar a URL do servidor MCP** nas configurações de tools
3. **Configurar a autenticação** se necessário

### 4. Criar Servidor HTTP para MCP

Vamos criar uma versão HTTP do servidor MCP para compatibilidade com OpenAI:

```javascript
// mcp-server/http-server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { AssistenteMCPServer } from './index.js';

const app = express();
const port = process.env.MCP_HTTP_PORT || 3001;

// Middlewares de segurança
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Inicializar servidor MCP
const mcpServer = new AssistenteMCPServer();

// Endpoint para listar tools
app.get('/tools', async (req, res) => {
  try {
    const tools = await mcpServer.listTools();
    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para executar tools
app.post('/tools/:toolName', async (req, res) => {
  try {
    const { toolName } = req.params;
    const args = req.body;
    
    const result = await mcpServer.callTool(toolName, args);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'Assistente MCP Server'
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🌐 Servidor HTTP MCP rodando em http://0.0.0.0:${port}`);
});
```

### 5. Configuração de Segurança

#### 5.1. Autenticação por API Key (Opcional)
```javascript
// Middleware de autenticação
app.use('/tools', (req, res, next) => {
  const apiKey = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey || apiKey !== process.env.MCP_API_KEY) {
    return res.status(401).json({ error: 'API Key inválida' });
  }
  
  next();
});
```

#### 5.2. Rate Limiting
```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // limite de 100 requests por IP
});

app.use('/tools', limiter);
```

### 6. Monitoramento e Logs

#### 6.1. Logging estruturado
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'mcp-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'mcp-combined.log' })
  ]
});
```

#### 6.2. Métricas básicas
```javascript
let metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  toolUsage: {}
};

app.get('/metrics', (req, res) => {
  res.json(metrics);
});
```

## 🧪 Testando a Configuração

### 1. Teste Local
```bash
# Testar servidor MCP local
cd mcp-server
node test-server.js
```

### 2. Teste via HTTP
```bash
# Testar endpoint HTTP
curl -X GET https://assistente-mcp.seu-dominio.com/health

# Listar tools
curl -X GET https://assistente-mcp.seu-dominio.com/tools

# Executar uma tool
curl -X POST https://assistente-mcp.seu-dominio.com/tools/sentiment_analysis \
  -H "Content-Type: application/json" \
  -d '{"text": "Estou muito feliz hoje!"}'
```

### 3. Teste com OpenAI
Uma vez configurado, você poderá usar as tools do assistente diretamente no ChatGPT ou via API da OpenAI.

## 🔧 Troubleshooting

### Problemas Comuns

1. **Erro de CORS**: Verifique se o domínio da OpenAI está nas origens permitidas
2. **Timeout**: Aumente o timeout das tools mais pesadas
3. **Memória**: Monitore uso de memória para tools que processam dados grandes
4. **Rate Limits**: Configure limites apropriados baseado no uso esperado

### Logs úteis
```bash
# Logs do tunnel
cloudflared tunnel logs assistente-mcp

# Logs do servidor MCP
tail -f mcp-server/logs/mcp-combined.log

# Logs do sistema
journalctl -f -u cloudflared
```

## 📊 Próximos Passos

1. **Monitoramento**: Implementar dashboards para acompanhar uso
2. **Cache**: Adicionar cache Redis para respostas frequentes
3. **Versionamento**: Implementar versionamento da API
4. **Documentação**: Gerar documentação OpenAPI/Swagger
5. **Testes**: Implementar testes automatizados end-to-end

## ⚙️ Configurações de Ambiente

Adicione essas variáveis ao `.env`:

```env
# MCP HTTP Server
MCP_HTTP_PORT=3001
MCP_API_KEY=sua-chave-super-secreta
ALLOWED_ORIGINS=https://chatgpt.com,https://chat.openai.com

# Cloudflare
CLOUDFLARE_TUNNEL_TOKEN=seu-token-do-tunnel
```

Com essa configuração, seu assistente WhatsApp estará disponível como um servidor MCP robusto que pode ser usado pela OpenAI e outros clientes compatíveis com MCP!
