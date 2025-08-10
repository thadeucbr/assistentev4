import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';
import sendMessage from '../whatsapp/sendMessage.js';

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
    let tempFile = null; // Mover para o escopo da função
    
    try {
      // Para send_message com payloads muito grandes, usar fallback direto
      if (toolName === 'send_message' && JSON.stringify(args).length > 5000) {
        logger.info('MCPClient', `📤 Payload muito grande (${JSON.stringify(args).length} chars), usando fallback direto`);
        return await this.fallbackSendMessage(args);
      }

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

      // Log do tamanho da entrada para análise
      const inputSize = JSON.stringify(args).length;
      logger.aiResponse('MCPClient', `Input para tool "${toolName}"`, {
        toolName,
        inputSize,
        hasLargeContent: inputSize > 1000,
        requestId: this.requestId
      });

      const requestJson = JSON.stringify(request);
      
      // Para payloads grandes, usar spawn direto sem shell (mais confiável)
      let stdout, stderr;
      
      if (requestJson.length > 2000) {
        // Usar spawn direto para evitar problemas de shell escaping
        logger.debug('MCPClient', `📤 Usando spawn direto para payload grande (${requestJson.length} chars)`);
        
        const result = await this.spawnWithInput('node', [this.serverPath], requestJson);
        stdout = result.stdout;
        stderr = result.stderr;
      } else {
        // Para payloads pequenos, usar printf com aspas simples
        const safeJson = requestJson.replace(/'/g, "'\"'\"'");
        const command = `printf '%s\\n' '${safeJson}' | node "${this.serverPath}"`;
        
        logger.debug('MCPClient', `💻 Executando comando MCP...`);
        logger.debug('MCPClient', `🔍 Comando completo: ${command.substring(0, 300)}${command.length > 300 ? '...' : ''}`);
        
        const result = await execAsync(command, { 
          timeout: 60000,
          maxBuffer: 1024 * 1024
        });
        stdout = result.stdout;
        stderr = result.stderr;
      }

      logger.debug('MCPClient', `📊 Resultado execAsync - stdout: ${stdout.length} chars, stderr: ${stderr.length} chars`);

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
        // Se for send_message e não conseguiu resposta, tentar fallback
        if (toolName === 'send_message') {
          logger.warn('MCPClient', `⚠️ MCP falhou para send_message, tentando fallback direto`);
          return await this.fallbackSendMessage(args);
        }

        logger.error('MCPClient', `❌ Resposta válida não encontrada do servidor MCP para ID ${this.requestId}`);
        logger.error('MCPClient', `📄 Stdout recebido (${stdout.length} chars): ${stdout.substring(0, 500)}...`);
        logger.error('MCPClient', `🔍 Linhas encontradas: ${lines.length}`);
        
        // Log detalhado para análise
        logger.aiResponse('MCPClient', `Erro de parsing MCP para tool "${toolName}"`, {
          toolName,
          requestId: this.requestId,
          stdoutLength: stdout.length,
          linesFound: lines.length,
          inputSize: JSON.stringify(args).length,
          firstLines: lines.slice(0, 3),
          error: 'Resposta válida não encontrada'
        });
        
        // Log das linhas para debug
        lines.forEach((line, index) => {
          if (index < 5) { // Mostrar apenas as primeiras 5 linhas
            logger.error('MCPClient', `📝 Linha ${index}: ${line.substring(0, 100)}...`);
          }
        });
        
        throw new Error(`Resposta válida não encontrada do servidor MCP para ID ${this.requestId}. Stdout: ${stdout.substring(0, 200)}`);
      }

      if (response.error) {
        // Se for send_message com erro, tentar fallback
        if (toolName === 'send_message') {
          logger.warn('MCPClient', `⚠️ MCP retornou erro para send_message: ${response.error.message}, tentando fallback direto`);
          return await this.fallbackSendMessage(args);
        }

        logger.error('MCPClient', `❌ Erro retornado pelo MCP: ${response.error.message}`);
        throw new Error(`Erro MCP: ${response.error.message}`);
      }

      logger.info('MCPClient', `✅ Tool "${toolName}" executada com sucesso via MCP`);
      logger.debug('MCPClient', `📤 Resultado: ${JSON.stringify(response.result, null, 2).substring(0, 200)}...`);
      
      // Log do resultado para análise
      const resultSize = JSON.stringify(response.result).length;
      logger.aiResponse('MCPClient', `Output da tool "${toolName}"`, {
        toolName,
        resultSize,
        hasLargeResult: resultSize > 1000,
        requestId: this.requestId,
        success: true
      });
      
      return response.result;
      
    } catch (error) {
      // Para send_message, sempre tentar fallback em caso de erro
      if (toolName === 'send_message') {
        logger.warn('MCPClient', `⚠️ Erro no MCP para send_message: ${error.message}, tentando fallback direto`);
        try {
          return await this.fallbackSendMessage(args);
        } catch (fallbackError) {
          logger.error('MCPClient', `❌ Fallback também falhou: ${fallbackError.message}`);
          // Continuar com o erro original se o fallback também falhar
        }
      }

      logger.error('MCPClient', `❌ Erro ao executar tool "${toolName}":`, error.message);
      throw error;
    } finally {
      // Limpar arquivo temporário se foi criado
      if (tempFile && fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
          logger.debug('MCPClient', `🧹 Arquivo temporário removido: ${tempFile}`);
        } catch (cleanupError) {
          logger.warn('MCPClient', `⚠️ Falha ao remover arquivo temporário: ${cleanupError.message}`);
        }
      }
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

  /**
   * Executa processo com spawn e envia dados via stdin
   * Mais confiável que shell para grandes payloads
   */
  spawnWithInput(command, args, input) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data;
      });

      child.stderr.on('data', (data) => {
        stderr += data;
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}\nStderr: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Enviar dados via stdin
      child.stdin.write(input);
      child.stdin.end();

      // Timeout de 60 segundos
      setTimeout(() => {
        child.kill();
        reject(new Error('Process timeout'));
      }, 60000);
    });
  }

  /**
   * Fallback para send_message usando a função original do projeto
   * Usado quando MCP falha ou payload é muito grande
   */
  async fallbackSendMessage(args) {
    try {
      logger.info('MCPClient', '🔄 Executando fallback direto para sendMessage');
      
      const { content, to, from, quotedMsgId } = args;
      
      // Usar a função sendMessage original do projeto
      const result = await sendMessage(to, content, quotedMsgId);
      
      logger.info('MCPClient', '✅ Fallback sendMessage executado com sucesso');
      
      // Retornar no formato esperado pelo MCP
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              type: 'message',
              content: content,
              success: true,
              result: {
                success: true,
                response: result || 'message_sent_via_fallback'
              },
              note: 'Mensagem enviada via fallback direto'
            }, null, 2)
          }
        ]
      };
      
    } catch (error) {
      logger.error('MCPClient', `❌ Erro no fallback sendMessage: ${error.message}`);
      
      // Retornar formato de erro
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              type: 'error',
              message: 'Falha ao enviar mensagem',
              error: error.message,
              success: false
            }, null, 2)
          }
        ]
      };
    }
  }
}

export default MCPClient;
