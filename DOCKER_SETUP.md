# Configuração Docker - Assistente V4

## Configurações de Conectividade e Restart

### 1. Política de Restart
O container do `assistentev4` está configurado com a política `restart: unless-stopped` no `docker-compose.yml`.

**Comportamento:**
- ✅ Reinicia automaticamente se o container falhar
- ✅ Reinicia automaticamente se o Docker daemon for reiniciado
- ✅ Reinicia automaticamente se a máquina for reinicializada
- ❌ NÃO reinicia se for parado manualmente com `docker stop`

### 2. Conectividade com MongoDB
O container está conectado a duas redes Docker:

1. **minha-rede-compartilhada** (rede principal do assistentev4)
2. **project-12_llm_network** (rede do MongoDB)

**Configuração no .env:**
```bash
MONGO_URI=mongodb://llm-mongodb:27017
MONGO_DB=whatsapp
```

### 3. Comandos Úteis

#### Verificar política de restart:
```bash
docker inspect assistentev4 --format '{{.HostConfig.RestartPolicy.Name}}'
```

#### Reconectar à rede do MongoDB (se necessário):
```bash
docker network connect project-12_llm_network assistentev4
```

#### Testar conectividade com MongoDB:
```bash
docker exec assistentev4 node -e "const net = require('net'); const socket = new net.Socket(); socket.setTimeout(5000); socket.on('connect', () => { console.log('MongoDB acessível!'); socket.destroy(); }); socket.on('error', (err) => { console.log('Erro:', err.message); }); socket.on('timeout', () => { console.log('Timeout'); socket.destroy(); }); socket.connect(27017, 'llm-mongodb');"
```

#### Subir o serviço:
```bash
docker-compose up -d
```

#### Parar o serviço:
```bash
docker-compose down
```

### 4. Verificações de Saúde do Sistema

Para garantir que tudo está funcionando após um restart da máquina:

1. **Verificar se Docker está rodando:**
   ```bash
   sudo systemctl status docker
   ```

2. **Verificar containers em execução:**
   ```bash
   docker ps
   ```

3. **Verificar conectividade com MongoDB:**
   ```bash
   # Testar conectividade
   docker exec assistentev4 node -e "const net = require('net'); const socket = new net.Socket(); socket.setTimeout(5000); socket.on('connect', () => { console.log('OK'); socket.destroy(); }); socket.on('error', (err) => { console.log('ERRO'); }); socket.connect(27017, 'llm-mongodb');"
   ```

### 5. Solução de Problemas

#### Se o container não conseguir conectar ao MongoDB após restart:
```bash
# Reconectar à rede do MongoDB
docker network connect project-12_llm_network assistentev4

# Reiniciar o container
docker restart assistentev4
```

#### Se o container não reiniciar automaticamente:
1. Verificar se o Docker está rodando: `sudo systemctl start docker`
2. Verificar a política de restart: `docker inspect assistentev4 --format '{{.HostConfig.RestartPolicy.Name}}'`
3. Se necessário, recriar com docker-compose: `docker-compose up -d`

### 6. Configuração do Sistema

- ✅ Docker daemon habilitado para iniciar no boot (`systemctl is-enabled docker` = enabled)
- ✅ Container configurado com `restart: unless-stopped`
- ✅ Conectividade entre containers configurada
- ✅ Variáveis de ambiente atualizadas

**Status:** Configuração completa e funcional! 🚀
