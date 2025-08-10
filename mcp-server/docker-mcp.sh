#!/bin/bash

# Script para gerenciar MCP Server via Docker
# Arquivo: docker-mcp.sh

set -e

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

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

# Verificar se Docker está instalado e rodando
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado. Instale o Docker primeiro."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker não está rodando. Inicie o serviço Docker."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não encontrado. Instale o Docker Compose primeiro."
        exit 1
    fi
}

# Verificar se o arquivo .env existe
check_env() {
    if [[ ! -f .env ]]; then
        log_error "Arquivo .env não encontrado. Copie e configure o arquivo .env"
        exit 1
    fi
    
    # Carregar variáveis do .env
    source .env
    
    MCP_PORT=${MCP_PORT:-3001}
    log_info "Usando porta: $MCP_PORT"
}

# Build da imagem Docker
build() {
    log_info "Building imagem Docker do MCP Server..."
    check_docker
    check_env
    
    docker-compose build --no-cache
    
    if [[ $? -eq 0 ]]; then
        log_info "✓ Imagem construída com sucesso!"
    else
        log_error "✗ Falha ao construir imagem"
        exit 1
    fi
}

# Iniciar o container
start() {
    log_info "Iniciando MCP Server via Docker..."
    check_docker
    check_env
    
    # Verificar se já está rodando
    if docker-compose ps | grep -q "assistente-mcp-server.*Up"; then
        log_warn "Container já está rodando"
        status
        return
    fi
    
    # Iniciar em background
    docker-compose up -d
    
    if [[ $? -eq 0 ]]; then
        log_info "✓ Container iniciado com sucesso!"
        sleep 3
        status
    else
        log_error "✗ Falha ao iniciar container"
        exit 1
    fi
}

# Parar o container
stop() {
    log_info "Parando MCP Server Docker..."
    check_docker
    
    docker-compose down
    
    if [[ $? -eq 0 ]]; then
        log_info "✓ Container parado com sucesso!"
    else
        log_error "✗ Falha ao parar container"
        exit 1
    fi
}

# Reiniciar o container
restart() {
    log_info "Reiniciando MCP Server Docker..."
    stop
    sleep 2
    start
}

# Status do container
status() {
    check_docker
    check_env
    
    echo -e "${BLUE}=== Status do MCP Server Docker ===${NC}"
    
    # Status do container
    if docker-compose ps | grep -q "assistente-mcp-server.*Up"; then
        echo -e "${GREEN}✓${NC} Container: Rodando"
        
        # Verificar health check
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' assistente-mcp-server 2>/dev/null || echo "unknown")
        case $HEALTH in
            "healthy")
                echo -e "${GREEN}✓${NC} Health Check: Saudável"
                ;;
            "unhealthy")
                echo -e "${RED}✗${NC} Health Check: Não saudável"
                ;;
            "starting")
                echo -e "${YELLOW}⌛${NC} Health Check: Iniciando..."
                ;;
            *)
                echo -e "${YELLOW}?${NC} Health Check: Status desconhecido"
                ;;
        esac
        
        # Testar endpoint
        if curl -s "http://localhost:$MCP_PORT/health" &>/dev/null; then
            echo -e "${GREEN}✓${NC} Endpoint: Acessível em http://localhost:$MCP_PORT"
        else
            echo -e "${RED}✗${NC} Endpoint: Não acessível"
        fi
        
    else
        echo -e "${RED}✗${NC} Container: Parado"
    fi
    
    echo ""
    echo "Comandos úteis:"
    echo "  - Logs: docker-compose logs -f"
    echo "  - Shell: docker-compose exec mcp-server sh"
    echo "  - Stats: docker stats assistente-mcp-server"
}

# Ver logs do container
logs() {
    check_docker
    
    if [[ "$1" == "-f" ]] || [[ "$1" == "--follow" ]]; then
        log_info "Seguindo logs do container (Ctrl+C para sair)..."
        docker-compose logs -f
    else
        log_info "Últimos logs do container:"
        docker-compose logs --tail=50
    fi
}

# Testar o servidor
test() {
    log_info "Testando MCP Server Docker..."
    check_docker
    check_env
    
    # Verificar se o container está rodando
    if ! docker-compose ps | grep -q "assistente-mcp-server.*Up"; then
        log_error "Container não está rodando. Execute: $0 start"
        exit 1
    fi
    
    # Teste de saúde
    log_info "Testando endpoint de saúde..."
    if curl -s "http://localhost:$MCP_PORT/health" > /dev/null; then
        log_info "✓ Endpoint de saúde funcionando"
    else
        log_error "✗ Endpoint de saúde falhando"
        return 1
    fi
    
    # Teste de ferramentas
    log_info "Testando lista de ferramentas..."
    if curl -s "http://localhost:$MCP_PORT/tools/list" > /dev/null; then
        log_info "✓ Endpoint de ferramentas funcionando"
    else
        log_error "✗ Endpoint de ferramentas falhando"
        return 1
    fi
    
    log_info "✓ Servidor MCP Docker funcionando corretamente!"
}

# Shell interativo no container
shell() {
    check_docker
    
    if ! docker-compose ps | grep -q "assistente-mcp-server.*Up"; then
        log_error "Container não está rodando. Execute: $0 start"
        exit 1
    fi
    
    log_info "Abrindo shell no container..."
    docker-compose exec mcp-server sh
}

# Limpar imagens e containers orfãos
clean() {
    log_info "Limpando recursos Docker do MCP Server..."
    check_docker
    
    # Parar containers
    docker-compose down --remove-orphans
    
    # Remover imagens não utilizadas
    docker system prune -f
    
    log_info "✓ Limpeza concluída!"
}

# Função principal
main() {
    case "${1:-help}" in
        "build")
            build
            ;;
        "start")
            start
            ;;
        "stop")
            stop
            ;;
        "restart")
            restart
            ;;
        "status")
            status
            ;;
        "logs")
            logs "$2"
            ;;
        "test")
            test
            ;;
        "shell")
            shell
            ;;
        "clean")
            clean
            ;;
        "help"|*)
            echo "Uso: $0 {build|start|stop|restart|status|logs|test|shell|clean}"
            echo ""
            echo "Comandos:"
            echo "  build    - Construir imagem Docker"
            echo "  start    - Iniciar container MCP Server"
            echo "  stop     - Parar container MCP Server"
            echo "  restart  - Reiniciar container"
            echo "  status   - Mostrar status do container"
            echo "  logs     - Mostrar logs (use -f para seguir)"
            echo "  test     - Testar endpoints do servidor"
            echo "  shell    - Abrir shell no container"
            echo "  clean    - Limpar recursos Docker"
            echo ""
            echo "Exemplos:"
            echo "  $0 build && $0 start    # Build e start"
            echo "  $0 logs -f              # Seguir logs"
            echo "  $0 status               # Ver status"
            ;;
    esac
}

main "$@"
