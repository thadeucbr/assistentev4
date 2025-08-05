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
  }

  // Gerar um novo ID único para cada mensagem/operação
  generateMessageId() {
    this.currentMessageId = uuidv4().substring(0, 8); // Usar apenas os primeiros 8 caracteres
    this.startTime = Date.now();
    return this.currentMessageId;
  }

  // Definir um ID específico (útil para operações que já têm um ID)
  setMessageId(messageId) {
    this.currentMessageId = messageId;
    this.startTime = Date.now();
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

  // Função principal de logging
  log(level, component, message, data = null) {
    const timestamp = new Date().toISOString();
    const messageId = this.getCurrentMessageId();
    const elapsedTime = this.getElapsedTime();
    
    const logEntry = {
      timestamp,
      messageId,
      elapsedTime: `+${elapsedTime}ms`,
      level: level.toUpperCase(),
      component,
      message,
      ...(data && { data })
    };

    // Escrever no arquivo
    this.writeToFile(level, logEntry);
    
    // Mostrar no console apenas logs importantes (ERROR e alguns INFO críticos)
    if (level === LOG_LEVELS.ERROR || this.shouldShowInConsole(component, message)) {
      const consoleMessage = `[${messageId}] ${component} ${message} (+${elapsedTime}ms)`;
      
      switch (level) {
        case LOG_LEVELS.ERROR:
          console.error(`🔴 ${consoleMessage}`, data || '');
          break;
        case LOG_LEVELS.WARN:
          console.warn(`🟡 ${consoleMessage}`, data || '');
          break;
        case LOG_LEVELS.INFO:
          console.log(`🔵 ${consoleMessage}`, data || '');
          break;
      }
    }
  }

    // Determinar se deve ser mostrado no console
  shouldShowInConsole(level, message, component) {
    // Verificar se message e component são strings válidas
    const safeMessage = typeof message === 'string' ? message : '';
    const safeComponent = typeof component === 'string' ? component : '';
    
    // Sempre mostrar erros críticos
    const criticalPatterns = [
      'ERRO CRÍTICO',
      'Fallback',
      'Mensagem autorizada',
      'Erro ao'
    ];
    
    return criticalPatterns.some(pattern => 
      safeMessage.includes(pattern) || safeComponent.includes('ERROR') || safeComponent.includes('CRITICAL')
    );
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
    
    const logEntry = {
      timestamp,
      messageId,
      elapsedTime: `+${elapsedTime}ms`,
      level: 'DEBUG',
      component,
      message,
      ...(data && { data })
    };

    this.writeToFile('debug', logEntry);
  }

  // Método para marcar marcos importantes na operação
  milestone(component, message, data = null) {
    this.info(`MILESTONE-${component}`, `🎯 ${message}`, data);
  }

  // Método para logs de início de operação
  start(component, operation, data = null) {
    this.info(`START-${component}`, `🚀 ${operation}`, data);
  }

  // Método para logs de fim de operação
  end(component, operation, data = null) {
    this.info(`END-${component}`, `✅ ${operation}`, data);
  }

  // Método para logs de falha crítica
  critical(component, message, data = null) {
    this.error(`CRITICAL-${component}`, `🆘 ${message}`, data);
  }

  // Método para compatibilidade com a função logError antiga
  logError(error, context = '') {
    this.error('ERROR', `${context}: ${error.message}`, {
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
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
