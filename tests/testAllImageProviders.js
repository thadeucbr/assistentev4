#!/usr/bin/env node

/**
 * Teste integrado de geração de imagem com diferentes provedores
 * 
 * Este script testa todos os provedores disponíveis:
 * - GPT-5-nano (novo)
 * - OpenAI DALL-E
 * - Stable Diffusion (existente)
 * 
 * Usage: node tests/testAllImageProviders.js
 */

import 'dotenv/config';
import generateImage from '../src/skills/generateImage.js';
import fs from 'fs';
import path from 'path';

async function testProvider(providerName, prompt) {
  console.log(`\n🎨 Testando provedor: ${providerName.toUpperCase()}`);
  console.log(`📝 Prompt: "${prompt}"`);
  
  // Definir temporariamente o provedor
  const originalProvider = process.env.IMAGE_PROVIDER;
  process.env.IMAGE_PROVIDER = providerName;
  
  try {
    const startTime = Date.now();
    const result = await generateImage({ prompt });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️  Tempo: ${duration}s`);
    
    if (result && result !== false) {
      console.log('✅ Sucesso!');
      console.log(`📏 Tamanho da imagem: ${result.length} caracteres (base64)`);
      
      // Salvar a imagem
      try {
        const imageBuffer = Buffer.from(result, 'base64');
        const filename = `test_${providerName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        const outputDir = path.join('tests', 'output');
        
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const filepath = path.join(outputDir, filename);
        fs.writeFileSync(filepath, imageBuffer);
        console.log(`💾 Imagem salva: ${filepath}`);
      } catch (saveError) {
        console.log(`❌ Erro ao salvar: ${saveError.message}`);
      }
      
      return { success: true, duration, size: result.length };
    } else {
      console.log('❌ Falhou - resultado vazio ou false');
      return { success: false, duration, error: 'Resultado vazio' };
    }
    
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`❌ Erro após ${duration}s:`, error.message);
    return { success: false, duration, error: error.message };
  } finally {
    // Restaurar o provedor original
    process.env.IMAGE_PROVIDER = originalProvider;
  }
}

async function main() {
  console.log('🧪 TESTE INTEGRADO DE PROVEDORES DE IMAGEM');
  console.log('='.repeat(50));
  
  const testPrompt = "A serene Japanese garden with cherry blossoms, koi pond, and traditional bridge";
  const providers = [
    'openai-native-tool',
    'openai-gpt5-nano',
    'openai-dalle', 
    'stable-diffusion'
  ];
  
  const results = {};
  
  // Testar cada provedor
  for (const provider of providers) {
    try {
      results[provider] = await testProvider(provider, testPrompt);
    } catch (error) {
      console.log(`❌ Erro crítico no provedor ${provider}:`, error.message);
      results[provider] = { success: false, error: error.message, duration: 0 };
    }
    
    // Pausa entre testes
    if (provider !== providers[providers.length - 1]) {
      console.log('\n⏳ Aguardando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Relatório final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RELATÓRIO FINAL DOS TESTES');
  console.log('='.repeat(50));
  
  let successCount = 0;
  let fastestProvider = null;
  let fastestTime = Infinity;
  
  for (const [provider, result] of Object.entries(results)) {
    const status = result.success ? '✅ SUCESSO' : '❌ FALHA';
    const time = result.duration ? `${result.duration}s` : 'N/A';
    const size = result.size ? `${result.size} chars` : 'N/A';
    
    console.log(`\n${provider.toUpperCase()}:`);
    console.log(`  Status: ${status}`);
    console.log(`  Tempo: ${time}`);
    console.log(`  Tamanho: ${size}`);
    
    if (result.error) {
      console.log(`  Erro: ${result.error}`);
    }
    
    if (result.success) {
      successCount++;
      if (result.duration < fastestTime) {
        fastestTime = result.duration;
        fastestProvider = provider;
      }
    }
  }
  
  console.log('\n' + '='.repeat(30));
  console.log('🏆 ESTATÍSTICAS GERAIS:');
  console.log(`Provedores testados: ${providers.length}`);
  console.log(`Sucessos: ${successCount}`);
  console.log(`Taxa de sucesso: ${((successCount / providers.length) * 100).toFixed(1)}%`);
  
  if (fastestProvider) {
    console.log(`Provedor mais rápido: ${fastestProvider} (${fastestTime}s)`);
  }
  
  console.log('\n💡 RECOMENDAÇÕES:');
  
  if (results['openai-gpt5-nano']?.success) {
    console.log('✅ GPT-5-nano funcionou! Configure IMAGE_PROVIDER=openai-gpt5-nano');
  } else if (results['openai-dalle']?.success) {
    console.log('✅ DALL-E disponível como alternativa: IMAGE_PROVIDER=openai-dalle');
  } else if (results['stable-diffusion']?.success) {
    console.log('✅ Stable Diffusion funcionando: IMAGE_PROVIDER=stable-diffusion');
  } else {
    console.log('⚠️  Nenhum provedor funcionou completamente. Verifique as configurações.');
  }
  
  // Verificar configurações
  console.log('\n🔧 CONFIGURAÇÕES ATUAIS:');
  console.log(`AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  console.log(`IMAGE_PROVIDER: ${process.env.IMAGE_PROVIDER}`);
  console.log(`OPENAI_MODEL: ${process.env.OPENAI_MODEL}`);
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
  console.log(`SDAPI_URL: ${process.env.SDAPI_URL}`);
  
  console.log('\n🏁 Teste concluído!');
  
  const outputDir = path.join('tests', 'output');
  if (fs.existsSync(outputDir)) {
    console.log(`\n📁 Imagens geradas salvas em: ${outputDir}`);
  }
}

main().catch(error => {
  console.error('❌ Erro crítico durante os testes:', error);
  process.exit(1);
});
