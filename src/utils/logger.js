import fs from 'fs';
import path from 'path';

/**
 * Função auxiliar para fazer logs de erro
 * Gera um arquivo txt com timestamp contendo o erro
 * @param {Error} error - O objeto de erro
 * @param {string} context - Contexto onde o erro ocorreu (opcional)
 */
export function logError(error, context = '') {
  try {
    // Criar timestamp para o nome do arquivo
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `error-${timestamp}.txt`;
    
    // Diretório de logs
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Criar diretório se não existir
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Caminho completo do arquivo
    const filePath = path.join(logsDir, fileName);
    
    // Conteúdo do log
    const logContent = `
=== ERROR LOG ===
Timestamp: ${new Date().toISOString()}
Context: ${context}
Message: ${error.message}
Stack: ${error.stack}
Name: ${error.name}
${error.cause ? `Cause: ${error.cause}` : ''}
================
`;

    // Escrever o arquivo
    fs.writeFileSync(filePath, logContent, 'utf8');
    
    // Também imprimir no console para debug
    console.error(`Error logged to: ${filePath}`);
    console.error(`Context: ${context}`);
    console.error(`Message: ${error.message}`);
    
  } catch (logError) {
    // Se falhar ao fazer log, apenas imprimir no console
    console.error('Failed to write error log:', logError);
    console.error('Original error:', error);
  }
}

export default logError;
