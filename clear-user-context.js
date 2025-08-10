#!/usr/bin/env node

import { clearUserContext } from './src/repository/contextRepository.js';
import { connectToDb } from './src/config/database/mongo.js';

async function clearContext() {
  try {
    console.log('🧹 Iniciando limpeza de contexto...');
    
    // Obter ID do usuário dos argumentos da linha de comando
    const userId = process.argv[2];
    
    if (!userId) {
      console.log('❌ Uso: node clear-user-context.js <userId>');
      console.log('💡 Exemplo: node clear-user-context.js 5511999999999');
      process.exit(1);
    }
    
    // Conectar ao banco e limpar contexto
    await clearUserContext(userId);
    
    console.log(`✅ Contexto do usuário ${userId} foi limpo com sucesso!`);
    console.log('🎯 O usuário agora tem um contexto completamente limpo.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao limpar contexto:', error);
    process.exit(1);
  }
}

// Executar limpeza
clearContext();
