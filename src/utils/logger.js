import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração do logger
const LOGS_DIR = path.join(__dirname, '../../logs');
const MAX_LOG_FILES = 50;
const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info'
};

// Garantir que a pasta de logs existe
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

class Logger {
  constructor() {
    this.currentMessageId = null;
    this.startTime = null;
    this.sessionStartTime = Date.now();
    this.toolStack = []; // Stack de ferramentas sendo executadas
    this.interactionCount = 0;
    this.stepTimings = new Map(); // Para rastrear timing de steps específicos
  }

  // Gerar um novo ID único para cada mensagem/operação
  generateMessageId() {
    this.currentMessageId = uuidv4().substring(0, 8); // Usar apenas os primeiros 8 caracteres
    this.startTime = Date.now();
    this.interactionCount = 0;
    this.toolStack = [];
    this.stepTimings.clear();
    return this.currentMessageId;
  }

  // Definir um ID específico (útil para operações que já têm um ID)
  setMessageId(messageId) {
    this.currentMessageId = messageId;
    this.startTime = Date.now();
    this.interactionCount = 0;
    this.toolStack = [];
    this.stepTimings.clear();
  }

  // Obter o ID atual da mensagem
  getCurrentMessageId() {
    return this.currentMessageId || 'unknown';
  }

  // Calcular tempo decorrido desde o início da operação
  getElapsedTime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  // Calcular tempo total desde o início da sessão
  getSessionElapsedTime() {
    return Date.now() - this.sessionStartTime;
  }

  // Registrar início de uma tool
  toolStart(toolName, toolId, args = null) {
    const toolExecution = {
      name: toolName,
      id: toolId,
      startTime: Date.now(),
      args: args ? JSON.stringify(args).substring(0, 200) + '...' : null
    };
    
    this.toolStack.push(toolExecution);
    
    // Mostrar no console - informação importante
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    console.log(`🔧 [${this.getCurrentMessageId()}|${++this.interactionCount}] TOOL START: ${toolName} +${elapsedTime}ms`);
    
    // Log completo no arquivo (com todos os dados)
    this.info(`TOOL-START-${toolName}`, `Iniciando execução da ferramenta ${toolName}`, {
      toolId,
      args: args,
      stackDepth: this.toolStack.length,
      sessionTime
    });
  }

  // Registrar fim de uma tool
  toolEnd(toolName, toolId, result = null, error = null) {
    const toolIndex = this.toolStack.findIndex(t => t.id === toolId);
    let toolExecution = null;
    
    if (toolIndex >= 0) {
      toolExecution = this.toolStack[toolIndex];
      this.toolStack.splice(toolIndex, 1);
    }
    
    const executionTime = toolExecution ? Date.now() - toolExecution.startTime : 0;
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    if (error) {
      // Erro na tool - mostrar no console (sem dados detalhados)
      console.error(`🔴 [${this.getCurrentMessageId()}|${this.interactionCount}] TOOL ERROR: ${toolName} (${executionTime}ms)`);
      this.error(`TOOL-ERROR-${toolName}`, `Erro na execução da ferramenta ${toolName}`, {
        toolId,
        executionTime,
        error: error.message || error,
        sessionTime
      });
    } else {
      // Sucesso na tool - mostrar no console (sem dados detalhados)
      console.log(`✅ [${this.getCurrentMessageId()}|${this.interactionCount}] TOOL END: ${toolName} (${executionTime}ms)`);
      
      this.info(`TOOL-END-${toolName}`, `Ferramenta ${toolName} executada com sucesso`, {
        toolId,
        executionTime,
        resultSize: typeof result === 'string' ? result.length : 'non-string',
        sessionTime
      });
    }
  }

  // Registrar step específico com timing
  step(component, stepName, data = null) {
    const stepKey = `${component}-${stepName}`;
    const currentTime = Date.now();
    
    // Se já existe um step similar, calcular diff
    let stepTime = 0;
    if (this.stepTimings.has(stepKey)) {
      stepTime = currentTime - this.stepTimings.get(stepKey);
    }
    this.stepTimings.set(stepKey, currentTime);
    
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    // Mostrar no console apenas steps importantes
    if (this.shouldShowStep(component, stepName)) {
      console.log(`🚀 [${this.getCurrentMessageId()}|${this.interactionCount}] ${component}: ${stepName} +${elapsedTime}ms`);
    }
    
    // Log completo no arquivo
    this.info(`STEP-${component}`, stepName, {
      stepTime: stepTime > 0 ? `${stepTime}ms` : 'first-time',
      totalElapsed: `${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      data
    });
  }

  // Determinar se step deve aparecer no console
  shouldShowStep(component, stepName) {
    // Apenas steps realmente importantes do fluxo principal
    const importantSteps = [
      'Processamento de mensagem iniciado',
      'Mensagem autorizada para processamento', 
      'Processamento da mensagem concluído',
      'Iniciando ciclo de ferramentas',
      'Gerando resposta principal da IA'
    ];
    
    return importantSteps.some(step => stepName.includes(step));
  }

  // Função principal de logging
  log(level, component, message, data = null) {
    const timestamp = new Date().toISOString();
    const messageId = this.getCurrentMessageId();
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    const logEntry = {
      timestamp,
      messageId,
      interactionCount: this.interactionCount,
      elapsedTime: `+${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      level: level.toUpperCase(),
      component,
      message,
      activeTools: this.toolStack.map(t => t.name),
      ...(data && { data })
    };

    // Escrever no arquivo (sempre com dados completos)
    this.writeToFile(level, logEntry);
    
    // Mostrar no console baseado na importância (apenas mensagem básica, dados vão apenas para arquivo)
    if (this.shouldShowInConsole(level, component, message)) {
      const consoleMessage = `[${messageId}|${this.interactionCount}] ${component}: ${message} (+${elapsedTime}ms)`;
      
      if (level === LOG_LEVELS.ERROR) {
        console.error(`🔴 ${consoleMessage}`);
      } else if (level === LOG_LEVELS.WARN) {
        console.warn(`🟡 ${consoleMessage}`);
      } else {
        console.log(`🔵 ${consoleMessage}`);
      }
    }
  }

    // Determinar se deve ser mostrado no console
  shouldShowInConsole(level, component, message) {
    // Sempre mostrar ERRORs e WARNs
    if (level === LOG_LEVELS.ERROR || level === LOG_LEVELS.WARN) {
      return true;
    }
    
    // Verificar se message e component são strings válidas
    const safeMessage = typeof message === 'string' ? message : '';
    const safeComponent = typeof component === 'string' ? component : '';
    
    // Mostrar apenas logs realmente importantes do fluxo principal
    const criticalPatterns = [
      'ERRO CRÍTICO', 'CRITICAL', 'Fallback', 'webhook-received'
    ];
    
    // Componentes que devem aparecer no console (mais restritivo)
    const criticalComponents = [
      'STEP-MessageProcessor', // Apenas steps principais do MessageProcessor
      'MILESTONE-', // Milestones são importantes
      'START-', // Início de operações
      'END-', // Fim de operações
      'TOOL-START', 'TOOL-END', 'TOOL-ERROR', // Tools
      'SYSTEM-', // Status de sistemas
      'INTERACTION-Webhook', // Apenas webhooks
      'AI-RESPONSE-' // Respostas da IA
    ];
    
    return criticalPatterns.some(pattern => 
      safeMessage.includes(pattern) || safeComponent.includes(pattern)
    ) || criticalComponents.some(comp => safeComponent.startsWith(comp));
  }

  // Escrever no arquivo de log
  writeToFile(level, logEntry) {
    try {
      const filename = `${this.getCurrentMessageId()}_${level}.log`;
      const filepath = path.join(LOGS_DIR, filename);
      
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Anexar ao arquivo (criar se não existir)
      fs.appendFileSync(filepath, logLine, 'utf8');
      
      // Verificar e limpar logs antigos
      this.cleanOldLogs();
    } catch (error) {
      console.error('Erro ao escrever log:', error);
    }
  }

  // Limpar logs antigos (manter apenas os últimos MAX_LOG_FILES)
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(LOGS_DIR)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(LOGS_DIR, file),
          mtime: fs.statSync(path.join(LOGS_DIR, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime); // Mais recentes primeiro

      // Se temos mais arquivos que o limite, remover os mais antigos
      if (files.length > MAX_LOG_FILES) {
        const filesToDelete = files.slice(MAX_LOG_FILES);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
    }
  }

  // Métodos de conveniência
  error(component, message, data = null) {
    this.log(LOG_LEVELS.ERROR, component, message, data);
  }

  warn(component, message, data = null) {
    this.log(LOG_LEVELS.WARN, component, message, data);
  }

  info(component, message, data = null) {
    this.log(LOG_LEVELS.INFO, component, message, data);
  }

  // Método para logs de performance/timing
  timing(component, message, data = null) {
    this.info(`TIMING-${component}`, message, data);
  }

  // Método para logs de debug (apenas em arquivo, nunca no console)
  debug(component, message, data = null) {
    const timestamp = new Date().toISOString();
    const messageId = this.getCurrentMessageId();
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    const logEntry = {
      timestamp,
      messageId,
      interactionCount: this.interactionCount,
      elapsedTime: `+${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'DEBUG',
      component,
      message,
      activeTools: this.toolStack.map(t => t.name),
      ...(data && { data })
    };

    this.writeToFile('debug', logEntry);
  }

  // Método para marcar marcos importantes na operação (sempre no console - apenas mensagem básica)
  milestone(component, message, data = null) {
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    // Sempre mostrar milestones no console (sem dados detalhados)
    console.log(`🎯 [${this.getCurrentMessageId()}|${this.interactionCount}] MILESTONE-${component}: ${message} (+${elapsedTime}ms)`);
    
    // Dados completos vão apenas para o arquivo - NÃO usar info() para evitar duplicação
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      messageId: this.getCurrentMessageId(),
      interactionCount: this.interactionCount,
      elapsedTime: `+${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'INFO',
      component: `MILESTONE-${component}`,
      message: `🎯 ${message}`,
      activeTools: this.toolStack.map(t => t.name),
      data: {
        ...data,
        sessionTime: `${sessionTime}ms`
      }
    };
    this.writeToFile('info', logEntry);
  }

  // Método para logs de início de operação (sempre no console - apenas mensagem básica)
  start(component, operation, data = null) {
    const sessionTime = this.getSessionElapsedTime();
    console.log(`🚀 [${this.getCurrentMessageId()}|${++this.interactionCount}] START-${component}: ${operation}`);
    
    // Dados completos vão apenas para o arquivo - NÃO usar info() para evitar duplicação
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      messageId: this.getCurrentMessageId(),
      interactionCount: this.interactionCount,
      elapsedTime: `+0ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'INFO',
      component: `START-${component}`,
      message: `🚀 ${operation}`,
      activeTools: this.toolStack.map(t => t.name),
      data: {
        ...data,
        sessionTime: `${sessionTime}ms`
      }
    };
    this.writeToFile('info', logEntry);
  }

  // Método para logs de fim de operação (sempre no console - apenas mensagem básica)  
  end(component, operation, data = null) {
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    console.log(`✅ [${this.getCurrentMessageId()}|${this.interactionCount}] END-${component}: ${operation} - TEMPO TOTAL: ${elapsedTime}ms`);
    
    // Dados completos vão apenas para o arquivo - NÃO usar info() para evitar duplicação
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      messageId: this.getCurrentMessageId(),
      interactionCount: this.interactionCount,
      elapsedTime: `+${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'INFO',
      component: `END-${component}`,
      message: `✅ ${operation}`,
      activeTools: this.toolStack.map(t => t.name),
      data: {
        ...data,
        totalTime: `${elapsedTime}ms`,
        sessionTime: `${sessionTime}ms`
      }
    };
    this.writeToFile('info', logEntry);
  }

  // Método para logs de falha crítica (sempre no console - apenas mensagem básica)
  critical(component, message, data = null) {
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    console.error(`🆘 [${this.getCurrentMessageId()}|${this.interactionCount}] CRITICAL-${component}: ${message} (+${elapsedTime}ms)`);
    
    // Dados completos vão apenas para o arquivo
    this.error(`CRITICAL-${component}`, `🆘 ${message}`, {
      ...data,
      sessionTime: `${sessionTime}ms`
    });
  }

  // Método especial para logar respostas da IA com informações detalhadas
  aiResponse(component, provider, responseData = null, timing = null) {
    const timestamp = new Date().toISOString();
    const messageId = this.getCurrentMessageId();
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    // Extrair informações relevantes da resposta
    const responseInfo = {
      provider: provider || 'unknown',
      hasContent: !!(responseData?.message?.content),
      contentLength: responseData?.message?.content?.length || 0,
      toolCallsCount: responseData?.message?.tool_calls?.length || 0,
      toolNames: responseData?.message?.tool_calls?.map(tc => tc.function.name) || [],
      model: responseData?.model || 'unknown',
      tokens: responseData?.usage || null,
      timing: timing || null
    };
    
    // Mostrar no console info resumida da resposta da IA (sem dados completos)
    const toolsInfo = responseInfo.toolCallsCount > 0 
      ? ` | Tools: ${responseInfo.toolNames.join(', ')}` 
      : '';
    console.log(`🤖 [${messageId}|${this.interactionCount}] AI-RESPONSE-${provider}: ${responseInfo.contentLength}chars${toolsInfo} (+${elapsedTime}ms)`);
    
    // Dados completos vão apenas para o arquivo - NÃO usar writeToFile via info() para evitar duplicação
    const logEntry = {
      timestamp,
      messageId,
      interactionCount: this.interactionCount,
      elapsedTime: `+${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'AI_RESPONSE',
      component: `AI-RESPONSE-${component}`,
      message: `Resposta recebida do ${provider}`,
      responseInfo,
      fullResponse: responseData // Log completo no arquivo
    };

    this.writeToFile('info', logEntry);
  }

  // Método para logs de timing importantes (apenas mensagem básica no console)
  timing(component, message, data = null) {
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    // Mostrar timings importantes no console (sem dados detalhados)
    console.log(`⏱️ [${this.getCurrentMessageId()}|${this.interactionCount}] TIMING-${component}: ${message} (+${elapsedTime}ms)`);
    
    // Dados completos vão apenas para o arquivo - NÃO usar info() para evitar duplicação
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      messageId: this.getCurrentMessageId(),
      interactionCount: this.interactionCount,
      elapsedTime: `+${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'INFO',
      component: `TIMING-${component}`,
      message,
      activeTools: this.toolStack.map(t => t.name),
      data: {
        ...data,
        totalTime: `${elapsedTime}ms`,
        sessionTime: `${sessionTime}ms`
      }
    };
    this.writeToFile('info', logEntry);
  }

  // Método para compatibilidade com a função logError antiga (apenas mensagem básica no console)
  logError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
      context
    };
    
    // Mostrar erro no console (sem dados detalhados)
    const elapsedTime = this.getElapsedTime();
    console.error(`🔴 [${this.getCurrentMessageId()}|${this.interactionCount}] ERROR: ${context}: ${error.message} (+${elapsedTime}ms)`);
    
    // Dados completos vão apenas para o arquivo
    this.error('ERROR', `${context}: ${error.message}`, errorInfo);
  }

  // Método para logar interações específicas (apenas mensagem básica no console)
  interaction(component, type, data = null) {
    this.interactionCount++;
    const sessionTime = this.getSessionElapsedTime();
    
    console.log(`🔄 [${this.getCurrentMessageId()}|${this.interactionCount}] INTERACTION-${component}: ${type}`);
    
    // Dados completos vão apenas para o arquivo - NÃO usar info() para evitar duplicação
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      messageId: this.getCurrentMessageId(),
      interactionCount: this.interactionCount,
      elapsedTime: `+0ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'INFO',
      component: `INTERACTION-${component}`,
      message: type,
      activeTools: this.toolStack.map(t => t.name),
      data: {
        ...data,
        interactionCount: this.interactionCount,
        sessionTime: `${sessionTime}ms`
      }
    };
    this.writeToFile('info', logEntry);
  }

  // Método para logar status de sistemas externos (apenas mensagem básica no console)
  systemStatus(system, status, details = null) {
    const elapsedTime = this.getElapsedTime();
    const sessionTime = this.getSessionElapsedTime();
    
    const statusEmoji = {
      'online': '🟢',
      'offline': '🔴', 
      'warning': '🟡',
      'connecting': '🔵',
      'error': '💥'
    }[status] || '⚪';
    
    console.log(`${statusEmoji} [${this.getCurrentMessageId()}|${this.interactionCount}] SYSTEM-${system}: ${status.toUpperCase()} (+${elapsedTime}ms)`);
    
    // Dados completos vão apenas para o arquivo - NÃO usar info() para evitar duplicação
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      messageId: this.getCurrentMessageId(),
      interactionCount: this.interactionCount,
      elapsedTime: `+${elapsedTime}ms`,
      sessionTime: `${sessionTime}ms`,
      level: 'INFO',
      component: `SYSTEM-${system}`,
      message: status.toUpperCase(),
      activeTools: this.toolStack.map(t => t.name),
      data: {
        ...details,
        systemStatus: status,
        sessionTime: `${sessionTime}ms`
      }
    };
    this.writeToFile('info', logEntry);
  }
}

// Instância singleton do logger
const logger = new Logger();

export default logger;
export { LOG_LEVELS };

// Manter compatibilidade com a função antiga
export function logError(error, context = '') {
  logger.logError(error, context);
}
