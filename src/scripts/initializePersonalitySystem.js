#!/usr/bin/env node

/**
 * Script para inicializar o sistema de personalidade evolutiva
 * Cria as tabelas necessárias no banco de dados
 */

import { initializePersonalityTables } from '../repository/assistantPersonalityRepository.js';
import logger from '../utils/logger.js';

async function initializePersonalitySystem() {
  try {
    logger.info('PersonalitySetup', '🎭 Inicializando sistema de personalidade evolutiva...');
    
    // Criar índices no MongoDB para otimização
    await initializePersonalityTables();
    
    logger.info('PersonalitySetup', '✅ Sistema de personalidade inicializado com sucesso!');
    logger.info('PersonalitySetup', 'As seguintes funcionalidades foram habilitadas:');
    logger.info('PersonalitySetup', '  • Estado emocional evolutivo do assistente');
    logger.info('PersonalitySetup', '  • Memória de relacionamentos com usuários');
    logger.info('PersonalitySetup', '  • Personalidade adaptativa baseada em interações');
    logger.info('PersonalitySetup', '  • Prompts dinâmicos evolutivos');
    logger.info('PersonalitySetup', '  • Sistema de "sentimentos" próprios do assistente');
    logger.info('PersonalitySetup', '');
    logger.info('PersonalitySetup', '🗃️  Coleções MongoDB criadas:');
    logger.info('PersonalitySetup', '  • assistant_personality (dados principais)');
    logger.info('PersonalitySetup', '  • personality_evolution_log (histórico)');
    logger.info('PersonalitySetup', '');
    logger.info('PersonalitySetup', '🔄 O sistema funcionará automaticamente a partir de agora!');
    
    process.exit(0);
  } catch (error) {
    logger.error('PersonalitySetup', `❌ Erro ao inicializar sistema: ${error.message}`, {
      stack: error.stack
    });
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initializePersonalitySystem();
}

export default initializePersonalitySystem;
