#!/usr/bin/env node

/**
 * Teste para verificar se o GPT-5-nano-2025-08-07 suporta geração de imagens
 * 
 * Este teste verifica:
 * 1. Se o modelo consegue gerar imagens diretamente
 * 2. Se retorna dados base64 de imagem
 * 3. Se funciona como fallback para DALL-E
 * 
 * Usage: node tests/testGPT5NanoImageGeneration.js
 */

import 'dotenv/config';
import { testGPT5NanoImageGeneration, generateImageWithGPT5Nano } from '../src/services/GPT5NanoImageService.js';
import { generateImageWithDallE } from '../src/services/OpenAIDalleService.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🧪 Iniciando testes de geração de imagem GPT-5-nano...\n');

  // Teste 1: Verificar se o modelo suporta geração de imagem
  console.log('📝 Teste 1: Verificando suporte nativo a geração de imagem...');
  const supportTest = await testGPT5NanoImageGeneration("A cute cat wearing a hat");
  
  console.log('Resultado do teste de suporte:');
  console.log('- Suporte nativo:', supportTest.supportsImageGeneration ? '✅' : '❌');
  console.log('- Método:', supportTest.method || 'N/A');
  console.log('- Fallback necessário:', supportTest.fallbackToDalle ? '✅' : '❌');
  
  if (supportTest.error) {
    console.log('- Erro:', supportTest.error);
  }
  
  if (supportTest.response) {
    console.log('- Resposta (primeiros 200 chars):', supportTest.response.substring(0, 200) + '...');
  }
  
  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 2: Tentar gerar uma imagem diretamente
  console.log('🎨 Teste 2: Tentando gerar imagem diretamente com GPT-5-nano...');
  const directGeneration = await generateImageWithGPT5Nano("A beautiful landscape with mountains and a lake at sunset");
  
  console.log('Resultado da geração direta:');
  console.log('- Sucesso:', directGeneration.success ? '✅' : '❌');
  console.log('- Método:', directGeneration.method || 'N/A');
  
  if (directGeneration.success) {
    console.log('- Tamanho da imagem base64:', directGeneration.imageBase64?.length || 0, 'caracteres');
    
    // Salvar a imagem se foi gerada com sucesso
    if (directGeneration.imageBase64) {
      try {
        const imageBuffer = Buffer.from(directGeneration.imageBase64, 'base64');
        const filename = `gpt5nano_test_${Date.now()}.png`;
        const filepath = path.join('tests', 'output', filename);
        
        // Criar diretório se não existir
        const outputDir = path.dirname(filepath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, imageBuffer);
        console.log('- Imagem salva em:', filepath);
      } catch (saveError) {
        console.log('- Erro ao salvar imagem:', saveError.message);
      }
    }
  } else {
    console.log('- Erro:', directGeneration.error);
    console.log('- Fallback necessário:', directGeneration.fallbackRequired ? '✅' : '❌');
  }
  
  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 3: Comparar com DALL-E (se necessário)
  if (!directGeneration.success) {
    console.log('🔄 Teste 3: Testando fallback para DALL-E...');
    
    try {
      const dalleResult = await generateImageWithDallE({
        prompt: "A beautiful landscape with mountains and a lake at sunset"
      });
      
      console.log('Resultado do fallback DALL-E:');
      console.log('- Sucesso:', dalleResult.success ? '✅' : '❌');
      
      if (dalleResult.success) {
        console.log('- Tamanho da imagem base64:', dalleResult.imageBase64?.length || 0, 'caracteres');
        console.log('- Modelo usado:', dalleResult.model);
        console.log('- Prompt original:', dalleResult.originalPrompt);
        
        if (dalleResult.revisedPrompt && dalleResult.revisedPrompt !== dalleResult.originalPrompt) {
          console.log('- Prompt revisado:', dalleResult.revisedPrompt.substring(0, 100) + '...');
        }
        
        // Salvar a imagem DALL-E para comparação
        if (dalleResult.imageBase64) {
          try {
            const imageBuffer = Buffer.from(dalleResult.imageBase64, 'base64');
            const filename = `dalle_fallback_test_${Date.now()}.png`;
            const filepath = path.join('tests', 'output', filename);
            
            fs.writeFileSync(filepath, imageBuffer);
            console.log('- Imagem DALL-E salva em:', filepath);
          } catch (saveError) {
            console.log('- Erro ao salvar imagem DALL-E:', saveError.message);
          }
        }
      } else {
        console.log('- Erro DALL-E:', dalleResult.error);
      }
      
    } catch (dalleError) {
      console.log('- Erro ao testar DALL-E:', dalleError.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Testes concluídos!');
  
  // Resumo final
  console.log('\n📊 RESUMO DOS TESTES:');
  console.log('1. GPT-5-nano suporte nativo:', supportTest.supportsImageGeneration ? '✅ SIM' : '❌ NÃO');
  console.log('2. Geração direta funcionou:', directGeneration.success ? '✅ SIM' : '❌ NÃO');
  console.log('3. Fallback DALL-E disponível:', process.env.OPENAI_API_KEY ? '✅ SIM' : '❌ NÃO');
  
  console.log('\n💡 RECOMENDAÇÃO:');
  if (directGeneration.success) {
    console.log('   Use IMAGE_PROVIDER=openai-gpt5-nano para usar o GPT-5-nano diretamente');
  } else if (supportTest.fallbackToDalle) {
    console.log('   Use IMAGE_PROVIDER=openai-gpt5-nano (com fallback automático para DALL-E)');
    console.log('   ou IMAGE_PROVIDER=openai-dalle para usar DALL-E diretamente');
  } else {
    console.log('   Use IMAGE_PROVIDER=stable-diffusion ou configure a API DALL-E');
  }
}

// Executar os testes
main().catch(error => {
  console.error('❌ Erro durante os testes:', error);
  process.exit(1);
});
