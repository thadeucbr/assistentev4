#!/usr/bin/env node

/**
 * Script de teste para análise de imagens
 * Testa os provedores Ollama (local) e OpenAI (remoto) para análise de imagens
 */

import 'dotenv/config';
import analyzeImage from './src/skills/analyzeImage.js';
import { testOpenAIVision } from './src/services/OpenAIVisionService.js';

console.log('🔍 TESTE DE ANÁLISE DE IMAGENS');
console.log('===============================\n');

// Verificar configurações
console.log('📋 Configurações atuais:');
console.log(`IMAGE_ANALYSIS_PROVIDER: ${process.env.IMAGE_ANALYSIS_PROVIDER || 'não definido'}`);
console.log(`AI_PROVIDER: ${process.env.AI_PROVIDER || 'não definido'}`);
console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
console.log(`OPENAI_VISION_MODEL: ${process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini (padrão)'}`);
console.log(`OLLAMA_IMAGE_ANALYZE_MODEL: ${process.env.OLLAMA_IMAGE_ANALYZE_MODEL || 'llava (padrão)'}`);
console.log(`OLLAMA_ANALYZE_URL: ${process.env.OLLAMA_ANALYZE_URL || 'http://localhost:11434/api/generate (padrão)'}`);
console.log();

async function testProvider(providerName) {
  console.log(`🧪 Testando provedor: ${providerName.toUpperCase()}`);
  console.log('-'.repeat(40));
  
  // Temporariamente definir o provedor para teste
  const originalProvider = process.env.IMAGE_ANALYSIS_PROVIDER;
  process.env.IMAGE_ANALYSIS_PROVIDER = providerName;
  
  try {
    if (providerName === 'openai') {
      // Teste específico para OpenAI Vision
      console.log('Executando teste de conectividade OpenAI Vision...');
      const visionTest = await testOpenAIVision();
      
      if (visionTest.success) {
        console.log('✅ Teste de conectividade OpenAI Vision passou!');
        console.log(`Resposta: ${visionTest.details?.content?.substring(0, 100)}...`);
        console.log(`Modelo usado: ${visionTest.details?.model}`);
        console.log(`Tokens usados: ${JSON.stringify(visionTest.details?.usage)}`);
      } else {
        console.log('❌ Teste de conectividade OpenAI Vision falhou!');
        console.log(`Erro: ${visionTest.error}`);
      }
    } else {
      console.log('Para Ollama, é necessário fornecer um ID de imagem real do WhatsApp.');
      console.log('Este teste requer uma integração ativa com o WhatsApp.');
    }
    
  } catch (error) {
    console.error(`❌ Erro no teste do provedor ${providerName}:`, error.message);
  } finally {
    // Restaurar configuração original
    if (originalProvider) {
      process.env.IMAGE_ANALYSIS_PROVIDER = originalProvider;
    } else {
      delete process.env.IMAGE_ANALYSIS_PROVIDER;
    }
  }
  
  console.log();
}

async function runTests() {
  // Testar OpenAI se a chave estiver configurada
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk') {
    await testProvider('openai');
  } else {
    console.log('⚠️  OPENAI_API_KEY não configurada - pulando teste OpenAI');
    console.log();
  }
  
  // Sempre testar Ollama (mesmo que não esteja rodando)
  await testProvider('ollama');
  
  console.log('🏁 Testes concluídos!');
  console.log('\nPara usar um provedor específico, configure:');
  console.log('IMAGE_ANALYSIS_PROVIDER=ollama  # Para processamento local');
  console.log('IMAGE_ANALYSIS_PROVIDER=openai  # Para processamento remoto');
}

// Executar testes
runTests().catch(console.error);
