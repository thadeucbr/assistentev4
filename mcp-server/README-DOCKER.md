# MCP Server Docker

Este diretório contém a configuração Docker para o servidor MCP (Model Context Protocol) do Assistente WhatsApp.

## 🐳 Estrutura Docker

```
mcp-server/
├── Dockerfile              # Imagem Docker do MCP Server
├── docker-compose.yml      # Configuração Docker Compose
├── docker-mcp.sh          # Script de gerenciamento
├── .env                   # Variáveis de ambiente
├── package.json           # Dependências Node.js
├── index.js              # Servidor MCP Stdio
├── http-server.js        # Servidor MCP HTTP
└── skill-wrappers.js     # Wrappers das skills
```

## ⚙️ Configuração

### 1. Arquivo `.env`

O arquivo `.env` já está configurado com todas as variáveis necessárias herdadas do projeto principal.

**Principais configurações:**
```env
MCP_PORT=3001                    # Porta do servidor HTTP
MCP_LOGGING=true                 # Habilitar logs
LOG_LEVEL=info                   # Nível de log
```

### 2. Volumes Docker

O container mapeia os seguintes diretórios:
- `../logs` → `/app/logs` - Logs do sistema
- `../temp_audio` → `/app/temp_audio` - Arquivos de áudio temporários  
- `../temp_calendar` → `/app/temp_calendar` - Arquivos de calendário
- Credenciais Google (read-only para segurança)

## 🚀 Como usar

### Comandos rápidos:

```bash
# Construir e iniciar
./docker-mcp.sh build && ./docker-mcp.sh start

# Ver status
./docker-mcp.sh status

# Ver logs
./docker-mcp.sh logs

# Testar servidor
./docker-mcp.sh test

# Parar
./docker-mcp.sh stop
```

### Comandos disponíveis:

| Comando | Descrição |
|---------|-----------|
| `build` | Construir imagem Docker |
| `start` | Iniciar container |
| `stop` | Parar container |
| `restart` | Reiniciar container |
| `status` | Status do container |
| `logs` | Ver logs (use `-f` para seguir) |
| `test` | Testar endpoints |
| `shell` | Shell no container |
| `clean` | Limpar recursos Docker |

## 🔍 Monitoramento

### Health Check
O container possui health check automático que verifica o endpoint `/health` a cada 30 segundos.

### Logs
```bash
# Ver logs recentes
./docker-mcp.sh logs

# Seguir logs em tempo real
./docker-mcp.sh logs -f

# Via Docker Compose
docker-compose logs -f
```

### Métricas
```bash
# Stats do container
docker stats assistente-mcp-server

# Informações detalhadas
docker inspect assistente-mcp-server
```

## 🌐 Endpoints

Quando o container estiver rodando, os endpoints estarão disponíveis em:

- **Health Check:** `http://localhost:3001/health`
- **Listar Tools:** `http://localhost:3001/tools/list`  
- **Executar Tool:** `POST http://localhost:3001/tools/call`
- **Métricas:** `http://localhost:3001/metrics`

## 🔧 Troubleshooting

### Container não inicia:
```bash
# Verificar logs de erro
./docker-mcp.sh logs

# Verificar se a porta está livre
lsof -i :3001

# Reconstruir imagem
./docker-mcp.sh clean && ./docker-mcp.sh build
```

### Problemas de permissão:
```bash
# Verificar volumes
docker-compose config

# Verificar se diretórios existem
ls -la ../logs ../temp_audio ../temp_calendar
```

### Health check falhando:
```bash
# Verificar endpoint manualmente
curl http://localhost:3001/health

# Verificar logs do container
./docker-mcp.sh logs
```

## 🚀 Deploy para Produção

### Com Cloudflare Tunnel:
```bash
# 1. Iniciar container
./docker-mcp.sh start

# 2. Configurar tunnel no Cloudflare Dashboard:
#    - Tipo: HTTP
#    - URL: http://localhost:3001

# 3. Testar acesso externo
curl https://seu-dominio.com/health
```

### Com reverse proxy (nginx/traefik):
```bash
# Exemplo nginx config:
location /mcp/ {
    proxy_pass http://localhost:3001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## 📋 Checklist de Deploy

- [ ] Arquivo `.env` configurado
- [ ] Credenciais Google no lugar correto
- [ ] Diretórios de volume criados
- [ ] Porta 3001 livre ou configurada
- [ ] Docker e Docker Compose instalados
- [ ] Container buildado e testado
- [ ] Health check passando
- [ ] Endpoints acessíveis externamente (se necessário)

## 🔒 Segurança

- Credenciais são mapeadas como read-only
- Container roda em rede isolada
- Health checks monitoram a saúde do serviço
- Logs estruturados para auditoria
- Rate limiting configurado no servidor HTTP
