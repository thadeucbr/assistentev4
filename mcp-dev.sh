#!/bin/bash

# Script para gerenciar o servidor MCP
# Uso: ./mcp-dev.sh [start|stop|test|status|install|start-http|test-http]

MCP_DIR="/home/thadeu/assistentev4/mcp-server"
MCP_PID_FILE="/tmp/mcp-server.pid"
MCP_HTTP_PID_FILE="/tmp/mcp-http-server.pid"

case "$1" in
  "install")
    echo "🔧 Instalando dependências do MCP Server..."
    cd "$MCP_DIR"
    npm install
    echo "✅ Dependências instaladas!"
    ;;
    
  "start")
    if [ -f "$MCP_PID_FILE" ]; then
      echo "⚠️ Servidor MCP já está executando (PID: $(cat $MCP_PID_FILE))"
      exit 1
    fi
    
    echo "🚀 Iniciando servidor MCP stdio em background..."
    cd "$MCP_DIR"
    nohup node index.js > /tmp/mcp-server.log 2>&1 &
    echo $! > "$MCP_PID_FILE"
    echo "✅ Servidor MCP iniciado! PID: $(cat $MCP_PID_FILE)"
    echo "📄 Logs em: /tmp/mcp-server.log"
    ;;
    
  "start-http")
    if [ -f "$MCP_HTTP_PID_FILE" ]; then
      echo "⚠️ Servidor HTTP MCP já está executando (PID: $(cat $MCP_HTTP_PID_FILE))"
      exit 1
    fi
    
    echo "🌐 Iniciando servidor HTTP MCP em background..."
    cd "$MCP_DIR"
    nohup node http-server.js > /tmp/mcp-http-server.log 2>&1 &
    echo $! > "$MCP_HTTP_PID_FILE"
    echo "✅ Servidor HTTP MCP iniciado! PID: $(cat $MCP_HTTP_PID_FILE)"
    echo "🌍 Disponível em: http://localhost:3001"
    echo "📄 Logs em: /tmp/mcp-http-server.log"
    ;;
    
  "stop")
    stopped_any=false
    
    if [ -f "$MCP_PID_FILE" ]; then
      PID=$(cat "$MCP_PID_FILE")
      echo "🛑 Parando servidor MCP stdio (PID: $PID)..."
      kill "$PID" 2>/dev/null
      rm -f "$MCP_PID_FILE"
      stopped_any=true
    fi
    
    if [ -f "$MCP_HTTP_PID_FILE" ]; then
      PID=$(cat "$MCP_HTTP_PID_FILE")
      echo "🛑 Parando servidor HTTP MCP (PID: $PID)..."
      kill "$PID" 2>/dev/null
      rm -f "$MCP_HTTP_PID_FILE"
      stopped_any=true
    fi
    
    if [ "$stopped_any" = true ]; then
      echo "✅ Servidores MCP parados!"
    else
      echo "⚠️ Nenhum servidor MCP estava executando"
    fi
    ;;
    
  "status")
    echo "📊 Status dos servidores MCP:"
    
    if [ -f "$MCP_PID_FILE" ]; then
      PID=$(cat "$MCP_PID_FILE")
      if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Servidor MCP stdio está executando (PID: $PID)"
      else
        echo "❌ PID file stdio existe mas processo não está ativo"
        rm -f "$MCP_PID_FILE"
      fi
    else
      echo "❌ Servidor MCP stdio não está executando"
    fi
    
    if [ -f "$MCP_HTTP_PID_FILE" ]; then
      PID=$(cat "$MCP_HTTP_PID_FILE")
      if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Servidor HTTP MCP está executando (PID: $PID)"
        echo "🌍 Disponível em: http://localhost:3001"
      else
        echo "❌ PID file HTTP existe mas processo não está ativo"
        rm -f "$MCP_HTTP_PID_FILE"
      fi
    else
      echo "❌ Servidor HTTP MCP não está executando"
    fi
    ;;
    
  "test")
    echo "🧪 Testando servidor MCP stdio..."
    cd "$MCP_DIR"
    node test-server.js
    ;;
    
  "test-http")
    echo "🧪 Testando servidor HTTP MCP..."
    cd "$MCP_DIR"
    if [ "$2" = "--start-server" ]; then
      node test-http-server.js --start-server
    else
      node test-http-server.js
    fi
    ;;
    
  "logs")
    case "$2" in
      "http")
        if [ -f "/tmp/mcp-http-server.log" ]; then
          echo "📄 Últimas linhas do log do HTTP MCP Server:"
          tail -n 20 /tmp/mcp-http-server.log
        else
          echo "⚠️ Arquivo de log HTTP não encontrado"
        fi
        ;;
      *)
        if [ -f "/tmp/mcp-server.log" ]; then
          echo "📄 Últimas linhas do log do MCP Server:"
          tail -n 20 /tmp/mcp-server.log
        else
          echo "⚠️ Arquivo de log não encontrado"
        fi
        ;;
    esac
    ;;
    
  "dev")
    echo "🔧 Iniciando servidor MCP stdio em modo desenvolvimento..."
    cd "$MCP_DIR"
    npm run dev
    ;;
    
  "dev-http")
    echo "🌐 Iniciando servidor HTTP MCP em modo desenvolvimento..."
    cd "$MCP_DIR"
    npm run dev:http
    ;;
    
  *)
    echo "📖 Uso: $0 {install|start|start-http|stop|test|test-http|status|logs|dev|dev-http}"
    echo ""
    echo "Comandos disponíveis:"
    echo "  install     - Instala dependências do MCP Server"
    echo "  start       - Inicia o servidor MCP stdio em background"
    echo "  start-http  - Inicia o servidor HTTP MCP em background"
    echo "  stop        - Para todos os servidores MCP"
    echo "  status      - Verifica se os servidores estão executando"
    echo "  test        - Executa testes do servidor MCP stdio"
    echo "  test-http   - Executa testes do servidor HTTP MCP"
    echo "  logs        - Mostra os últimos logs do servidor stdio"
    echo "  logs http   - Mostra os últimos logs do servidor HTTP"
    echo "  dev         - Inicia servidor stdio em modo desenvolvimento"
    echo "  dev-http    - Inicia servidor HTTP em modo desenvolvimento"
    echo ""
    echo "Exemplos:"
    echo "  $0 test-http --start-server  # Inicia servidor temporário para testes"
    exit 1
    ;;
esac
