import logger from '../utils/logger.js';

/**
 * Exemplo de como usar o novo sistema de logging
 * Este arquivo demonstra as melhores práticas para logging
 */

async function exemploProcessamentoMensagem() {
  // 1. Sempre gerar um messageId no início do processamento
  const messageId = logger.generateMessageId();
  console.log(`🆔 MessageId gerado: ${messageId}`);
  
  // 2. Log de início do processamento (aparecerá no console)
  logger.start('ExemploProcess', 'Iniciando processamento da mensagem');
  
  // 3. Logs de debug para acompanhar o fluxo (apenas em arquivo)
  logger.debug('ExemploProcess', 'Carregando dados do usuário...');
  
  // Simular algum processamento
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 4. Log de timing para performance
  logger.timing('ExemploProcess', 'Dados do usuário carregados');
  
  // 5. Log de milestone para marcos importantes
  logger.milestone('ExemploProcess', 'Usuário autenticado com sucesso');
  
  // 6. Simular um warning
  logger.warn('ExemploProcess', 'Cache expirado, recarregando dados');
  
  // 7. Mais debug
  logger.debug('ExemploProcess', 'Processando análise de sentimento...', {
    texto: 'exemplo de texto',
    algoritmo: 'sentiment-analysis-v2'
  });
  
  // Simular processamento
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // 8. Log de sucesso
  logger.info('ExemploProcess', 'Análise de sentimento concluída', {
    resultado: 'positivo',
    confiança: 0.87
  });
  
  // 9. Log de fim do processamento (aparecerá no console)
  logger.end('ExemploProcess', 'Processamento da mensagem concluído com sucesso');
  
  return messageId;
}

async function exemploComErro() {
  const messageId = logger.generateMessageId();
  
  logger.start('ExemploErro', 'Simulando processo com erro');
  
  try {
    // Simular alguma operação que falha
    logger.debug('ExemploErro', 'Tentando conectar com API externa...');
    
    // Simular erro
    throw new Error('Falha na conexão com API externa');
    
  } catch (error) {
    // 10. Log de erro crítico (aparecerá no console)
    logger.critical('ExemploErro', 'Falha crítica no processamento', {
      errorMessage: error.message,
      stack: error.stack,
      apiEndpoint: 'https://api.exemplo.com/data'
    });
    
    // 11. Log de fallback
    logger.warn('ExemploErro', 'Usando dados em cache como fallback');
    
    return messageId;
  }
}

async function main() {
  console.log('🚀 Demonstração do Sistema de Logging\n');
  
  // Executar exemplos
  const messageId1 = await exemploProcessamentoMensagem();
  console.log(`✅ Exemplo 1 concluído. MessageId: ${messageId1}\n`);
  
  const messageId2 = await exemploComErro();
  console.log(`⚠️ Exemplo 2 concluído. MessageId: ${messageId2}\n`);
  
  console.log('📋 Para visualizar os logs gerados, use:');
  console.log(`   npm run logs -- --message-id ${messageId1}`);
  console.log(`   npm run logs -- --message-id ${messageId2}`);
  console.log('   npm run logs:list');
  console.log('   npm run logs:errors');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { exemploProcessamentoMensagem, exemploComErro };
