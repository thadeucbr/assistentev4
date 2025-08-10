#!/bin/bash

# Script para gerenciar MCP Server HTTP
# Arquivo: mcp-server.sh

set -e

# Configurações
MCP_HTTP_PORT=3001
PROJECT_DIR="/home/thadeu/assistentev4"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Iniciar servidor MCP HTTP
start_mcp_server() {
    log_info "Iniciando servidor MCP HTTP na porta $MCP_HTTP_PORT..."
    cd "$PROJECT_DIR"
    
    # Verificar se a porta está livre
    if lsof -Pi :$MCP_HTTP_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warn "Porta $MCP_HTTP_PORT já está em uso. Parando processo existente..."
        pkill -f "mcp-server/http-server.js" || true
        sleep 2
    fi
    
    # Iniciar servidor MCP HTTP em background
    nohup node mcp-server/http-server.js > logs/mcp-http-server.log 2>&1 &
    MCP_PID=$!
    echo $MCP_PID > /tmp/mcp-server.pid
    
    sleep 3
    
    # Verificar se iniciou corretamente
    if ps -p $MCP_PID > /dev/null; then
        log_info "Servidor MCP HTTP iniciado com sucesso (PID: $MCP_PID)"
        
        # Testar endpoint
        if curl -s http://localhost:$MCP_HTTP_PORT/health > /dev/null; then
            log_info "Endpoint de saúde respondendo corretamente"
        else
            log_warn "Endpoint de saúde não está respondendo"
        fi
    else
        log_error "Falha ao iniciar servidor MCP HTTP"
        exit 1
    fi
}

# Parar servidor MCP
stop_mcp_server() {
    log_info "Parando servidor MCP HTTP..."
    
    if [ -f /tmp/mcp-server.pid ]; then
        MCP_PID=$(cat /tmp/mcp-server.pid)
        if ps -p $MCP_PID > /dev/null; then
            kill $MCP_PID
            log_info "Servidor MCP HTTP parado (PID: $MCP_PID)"
        fi
        rm -f /tmp/mcp-server.pid
    fi
    
    # Garantir que todos os processos sejam parados
    pkill -f "mcp-server/http-server.js" || true
}

# Status do serviço
status() {
    echo -e "${BLUE}=== Status do Servidor MCP ===${NC}"
    
    # Status MCP Server
    if pgrep -f "mcp-server/http-server.js" > /dev/null; then
        echo -e "${GREEN}✓${NC} Servidor MCP HTTP: Rodando na porta $MCP_HTTP_PORT"
        if curl -s http://localhost:$MCP_HTTP_PORT/health > /dev/null; then
            echo -e "${GREEN}✓${NC} Endpoint de saúde: OK"
        else
            echo -e "${RED}✗${NC} Endpoint de saúde: Falhou"
        fi
    else
        echo -e "${RED}✗${NC} Servidor MCP HTTP: Parado"
    fi
    
    echo ""
    echo "Logs disponíveis em: logs/mcp-http-server.log"
    echo "URL local: http://localhost:$MCP_HTTP_PORT"
}

# Testar servidor
test_server() {
    log_info "Testando servidor MCP HTTP..."
    
    # Teste local
    log_info "Testando endpoint local..."
    if curl -s http://localhost:$MCP_HTTP_PORT/tools/list > /dev/null; then
        log_info "✓ Endpoint de tools funcionando"
    else
        log_error "✗ Endpoint de tools falhando"
        return 1
    fi
    
    if curl -s http://localhost:$MCP_HTTP_PORT/health > /dev/null; then
        log_info "✓ Endpoint de saúde funcionando"
    else
        log_error "✗ Endpoint de saúde falhando"
        return 1
    fi
    
    log_info "✓ Servidor MCP HTTP funcionando corretamente!"
}

# Função principal
main() {
    case "${1:-help}" in
        "start")
            start_mcp_server
            status
            ;;
        "stop")
            stop_mcp_server
            ;;
        "restart")
            stop_mcp_server
            sleep 2
            start_mcp_server
            status
            ;;
        "status")
            status
            ;;
        "test")
            test_server
            ;;
        "logs")
            echo "=== MCP Server Logs ==="
            tail -n 50 logs/mcp-http-server.log 2>/dev/null || echo "Sem logs do MCP Server"
            ;;
        "help"|*)
            echo "Uso: $0 {start|stop|restart|status|test|logs}"
            echo ""
            echo "Comandos:"
            echo "  start    - Iniciar servidor MCP HTTP"
            echo "  stop     - Parar servidor MCP HTTP"
            echo "  restart  - Reiniciar servidor MCP HTTP"
            echo "  status   - Mostrar status do servidor"
            echo "  test     - Testar endpoints do servidor"
            echo "  logs     - Mostrar logs recentes"
            echo ""
            echo "O servidor ficará disponível em: http://localhost:$MCP_HTTP_PORT"
            ;;
    esac
}

main "$@"
