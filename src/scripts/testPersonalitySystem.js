#!/usr/bin/env node

/**
 * Script de teste para validar o sistema de personalidade
 */

import PersonalityOrchestrator from '../core/personality/PersonalityOrchestrator.js';
import logger from '../utils/logger.js';

async function testPersonalitySystem() {
  try {
    logger.info('PersonalityTest', '🧪 Iniciando teste do sistema de personalidade');
    
    const orchestrator = new PersonalityOrchestrator();
    
    // Teste 1: Inicialização
    logger.info('PersonalityTest', '🔧 Teste 1: Inicializando sistema...');
    await orchestrator.initialize();
    
    // Teste 2: Processamento de interação
    logger.info('PersonalityTest', '🔧 Teste 2: Processando interação...');
    const result = await orchestrator.processPersonalityInteraction(
      'test_user',
      'Olá, como você está?',
      'positivo',
      { messageType: 'text', hasImage: false }
    );
    
    logger.info('PersonalityTest', '✅ Resultado da interação:', {
      mood: result.mood,
      formationLevel: result.personality_formation,
      evolutionApplied: result.evolution_applied
    });
    
    // Teste 3: Construção de prompt
    logger.info('PersonalityTest', '🔧 Teste 3: Construindo prompt...');
    const promptResult = await orchestrator.buildPersonalityPrompt(
      'test_user',
      { name: 'Usuário Teste' },
      'Contexto de teste',
      '',
      null
    );
    
    logger.info('PersonalityTest', '✅ Prompt construído:', {
      promptLength: promptResult.prompt?.content?.length || 0,
      mood: promptResult.personalityMetadata.mood,
      formationLevel: promptResult.personalityMetadata.formation_level
    });
    
    logger.info('PersonalityTest', '🎉 Todos os testes passaram com sucesso!');
    process.exit(0);
    
  } catch (error) {
    logger.error('PersonalityTest', `❌ Erro durante teste: ${error.message}`, {
      stack: error.stack
    });
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  testPersonalitySystem();
}

export default testPersonalitySystem;
