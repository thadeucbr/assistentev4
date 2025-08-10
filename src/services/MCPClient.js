import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Cliente para comunicação com o servidor MCP
 */
export class MCPClient {
  constructor(serverPath = null) {
    // Determinar o caminho correto do servidor MCP
    let mcpPath = serverPath || process.env.MCP_SERVER_PATH || './mcp-server/index.js';
    
    // Se for um caminho relativo, resolver baseado no diretório de trabalho atual
    if (!path.isAbsolute(mcpPath)) {
      mcpPath = path.resolve(process.cwd(), mcpPath);
    }
    
    this.serverPath = mcpPath;
    this.requestId = 0;
    
    logger.info('MCPClient', `Servidor MCP configurado em: ${this.serverPath}`);
    
    // Verificar se o arquivo existe
    try {
      if (fs.existsSync(this.serverPath)) {
        logger.info('MCPClient', '✅ Arquivo do servidor MCP encontrado');
      } else {
        logger.error('MCPClient', '❌ Arquivo do servidor MCP não encontrado');
        logger.error('MCPClient', `Working directory: ${process.cwd()}`);
        logger.error('MCPClient', `MCP_SERVER_PATH env: ${process.env.MCP_SERVER_PATH}`);
        
        // Listar arquivos no diretório atual para debug
        try {
          const files = fs.readdirSync(process.cwd());
          logger.error('MCPClient', `Arquivos no working directory: ${files.join(', ')}`);
          
          if (files.includes('mcp-server')) {
            const mcpFiles = fs.readdirSync(path.join(process.cwd(), 'mcp-server'));
            logger.error('MCPClient', `Arquivos em mcp-server/: ${mcpFiles.join(', ')}`);
          }
        } catch (err) {
          logger.error('MCPClient', `Erro ao listar arquivos: ${err.message}`);
        }
      }
    } catch (error) {
      logger.error('MCPClient', `Erro ao verificar arquivo MCP: ${error.message}`);
    }
  }

  /**
   * Executa uma ferramenta via MCP
   * @param {string} toolName - Nome da ferramenta
   * @param {object} args - Argumentos da ferramenta
   * @returns {Promise<object>} - Resultado da execução
   */
  async callTool(toolName, args = {}) {
    try {
      this.requestId++;
      
      const request = {
        jsonrpc: '2.0',
        id: this.requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      logger.info('MCPClient', `🔧 Chamando tool "${toolName}" via MCP (ID: ${this.requestId})`);
      logger.debug('MCPClient', `📝 Argumentos para ${toolName}:`, JSON.stringify(args, null, 2));

      // Executa o servidor MCP em modo stdio
      const command = `echo '${JSON.stringify(request)}' | node "${this.serverPath}"`;
      logger.debug('MCPClient', `💻 Executando comando: ${command.substring(0, 100)}...`);
      
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });

      if (stderr && !stderr.includes('Assistente MCP Server running on stdio')) {
        logger.warn('MCPClient', `⚠️ MCP Server stderr: ${stderr.substring(0, 200)}...`);
      }

      // Parse da resposta
      const lines = stdout.split('\n').filter(line => line.trim());
      let response = null;

      logger.debug('MCPClient', `📥 Recebidas ${lines.length} linhas de resposta do MCP`);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === this.requestId) {
            response = parsed;
            logger.debug('MCPClient', `✅ Resposta encontrada para ID ${this.requestId}`);
            break;
          }
        } catch (error) {
          // Linha não é JSON válido, continuar
          continue;
        }
      }

      if (!response) {
        logger.error('MCPClient', `❌ Resposta válida não encontrada do servidor MCP para ID ${this.requestId}`);
        logger.error('MCPClient', `📄 Stdout recebido: ${stdout.substring(0, 500)}...`);
        throw new Error('Resposta válida não encontrada do servidor MCP');
      }

      if (response.error) {
        logger.error('MCPClient', `❌ Erro retornado pelo MCP: ${response.error.message}`);
        throw new Error(`Erro MCP: ${response.error.message}`);
      }

      logger.info('MCPClient', `✅ Tool "${toolName}" executada com sucesso via MCP`);
      logger.debug('MCPClient', `📤 Resultado: ${JSON.stringify(response.result, null, 2).substring(0, 200)}...`);
      return response.result;
    } catch (error) {
      logger.error('MCPClient', `❌ Erro ao executar tool "${toolName}":`, error.message);
      throw error;
    }
  }

  /**
   * Lista as ferramentas disponíveis no servidor MCP
   * @returns {Promise<Array>} - Lista de ferramentas
   */
  async listTools() {
    try {
      this.requestId++;
      
      const request = {
        jsonrpc: '2.0',
        id: this.requestId,
        method: 'tools/list',
        params: {}
      };

      const command = `echo '${JSON.stringify(request)}' | node "${this.serverPath}"`;
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });

      if (stderr && !stderr.includes('Assistente MCP Server running on stdio')) {
        logger.warn('MCPClient', `MCP Server stderr: ${stderr}`);
      }

      // Parse da resposta
      const lines = stdout.split('\n').filter(line => line.trim());
      let response = null;

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id === this.requestId) {
            response = parsed;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!response) {
        throw new Error('Resposta válida não encontrada do servidor MCP');
      }

      if (response.error) {
        throw new Error(`Erro MCP: ${response.error.message}`);
      }

      logger.info('MCPClient', `Listagem de tools MCP obtida com sucesso: ${response.result.tools.length} tools`);
      return response.result.tools;
    } catch (error) {
      logger.error('MCPClient', 'Erro ao listar tools MCP', error);
      throw error;
    }
  }

  /**
   * Verifica se o servidor MCP está disponível
   * @returns {Promise<boolean>} - true se o servidor estiver disponível
   */
  async isAvailable() {
    try {
      await this.listTools();
      return true;
    } catch (error) {
      logger.warn('MCPClient', 'Servidor MCP não está disponível', error);
      return false;
    }
  }
}

export default MCPClient;
