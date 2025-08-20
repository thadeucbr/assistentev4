import logger from '../utils/logger.js';
import HttpStreamClient from './HttpStreamClient.js';

/**
 * Cliente para comunicação com o servidor MCP via HTTP Stream
 */
export class MCPClient {
  constructor() {
    const mcpUrl = process.env.MCP_SERVER_URL || 'http://localhost:1337';
    this.httpClient = new HttpStreamClient(mcpUrl);
    this.requestId = 0;
    this.initialized = false;

    logger.info('MCPClient', `Servidor MCP configurado em: ${mcpUrl}`);
  }

  /**
   * Garante que a conexão com o servidor MCP está inicializada
   */
  async ensureInitialized() {
    if (this.initialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      const initPayload = {
        jsonrpc: '2.0',
        id: `${++this.requestId}`,
        method: 'initialize',
        params: {
          protocolVersion: '2024-08-05',
          clientInfo: { name: 'mcp-js-client', version: '0.2.0' },
          capabilities: {},
        },
      };

      this.httpClient.sendRequest(
        initPayload,
        (resp) => {
          if (resp.result) {
            this.initialized = true;
            logger.info('MCPClient', '✅ Conexão com MCP inicializada com sucesso');

            // Enviar notificação 'initialized'
            const initializedNotif = {
              jsonrpc: '2.0',
              method: 'initialized',
              params: {},
            };
            this.httpClient.sendRequest(initializedNotif, () => {}, () => {});

            resolve();
          }
        },
        (err) => {
          logger.error('MCPClient', '❌ Falha ao inicializar conexão com MCP', err);
          reject(err);
        }
      );
    });
  }

  /**
   * Executa uma ferramenta via MCP
   * @param {string} toolName - Nome da ferramenta
   * @param {object} args - Argumentos da ferramenta
   * @returns {Promise<object>} - Resultado da execução
   */
  async callTool(toolName, args = {}) {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      this.requestId++;
      const request = {
        jsonrpc: '2.0',
        id: `${this.requestId}`,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      };

      logger.info('MCPClient', `🔧 Chamando tool "${toolName}" via MCP (ID: ${this.requestId})`);
      logger.debug('MCPClient', `📝 Argumentos para ${toolName}:`, JSON.stringify(args, null, 2));

      this.httpClient.sendRequest(
        request,
        (response) => {
          if (response.error) {
            logger.error('MCPClient', `❌ Erro retornado pelo MCP: ${response.error.message}`);
            reject(new Error(`Erro MCP: ${response.error.message}`));
          } else {
            logger.info('MCPClient', `✅ Tool "${toolName}" executada com sucesso via MCP`);
            resolve(response.result);
          }
        },
        (error) => {
          logger.error('MCPClient', `❌ Erro ao executar tool "${toolName}":`, error.message);
          reject(error);
        }
      );
    });
  }

  /**
   * Lista as ferramentas disponíveis no servidor MCP
   * @returns {Promise<Array>} - Lista de ferramentas
   */
  async listTools() {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      this.requestId++;
      const request = {
        jsonrpc: '2.0',
        id: `${this.requestId}`,
        method: 'tools/list',
        params: {},
      };

      this.httpClient.sendRequest(
        request,
        (response) => {
          if (response.error) {
            logger.error('MCPClient', `❌ Erro retornado pelo MCP: ${response.error.message}`);
            reject(new Error(`Erro MCP: ${response.error.message}`));
          } else {
            logger.info('MCPClient', `Listagem de tools MCP obtida com sucesso: ${response.result.tools.length} tools`);
            resolve(response.result.tools);
          }
        },
        (error) => {
          logger.error('MCPClient', 'Erro ao listar tools MCP', error);
          reject(error);
        }
      );
    });
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
