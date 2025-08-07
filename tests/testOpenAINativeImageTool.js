#!/usr/bin/env node

/**
 * Teste para verificar a ferramenta nativa de geração de imagem da OpenAI
 * 
 * Este teste verifica:
 * 1. Se o modelo consegue usar function calling para gerar imagens
 * 2. Se a ferramenta é ativada corretamente
 * 3. Se o fallback para DALL-E funciona
 * 
 * Usage: node tests/testOpenAINativeImageTool.js
 */

import 'dotenv/config';
import { generateImageWithOpenAITool, testOpenAIImageTool } from '../src/services/OpenAIImageToolService.js';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🧪 TESTE DA FERRAMENTA NATIVA DE GERAÇÃO DE IMAGEM DA OPENAI');
  console.log('='.repeat(60));

  // Teste 1: Verificar se o modelo suporta a ferramenta
  console.log('\n📝 Teste 1: Verificando suporte à ferramenta nativa...');
  const supportTest = await testOpenAIImageTool("A cute cartoon cat");
  
  console.log('Resultado do teste de suporte:');
  console.log('- Suporte nativo:', supportTest.supportsNativeTool ? '✅' : '❌');
  console.log('- Método:', supportTest.method || 'N/A');
  
  if (supportTest.error) {
    console.log('- Erro:', supportTest.error);
  }
  
  if (supportTest.details) {
    console.log('- Detalhes:');
    console.log('  - Sucesso:', supportTest.details.success ? '✅' : '❌');
    
    if (supportTest.details.success) {
      console.log('  - Tamanho da imagem:', supportTest.details.imageBase64?.length || 0, 'caracteres');
      console.log('  - Prompt original:', supportTest.details.originalPrompt);
      console.log('  - Prompt processado:', supportTest.details.processedPrompt);
      
      if (supportTest.details.revisedPrompt) {
        console.log('  - Prompt revisado:', supportTest.details.revisedPrompt.substring(0, 100) + '...');
      }
    }
  }
  
  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 2: Gerar uma imagem mais complexa
  if (supportTest.supportsNativeTool) {
    console.log('🎨 Teste 2: Gerando imagem complexa com ferramenta nativa...');
    
    const complexPrompt = "A futuristic cyberpunk city at night with neon lights, flying cars, and towering skyscrapers reflected in wet streets";
    
    const complexResult = await generateImageWithOpenAITool(complexPrompt);
    
    console.log('Resultado da geração complexa:');
    console.log('- Sucesso:', complexResult.success ? '✅' : '❌');
    console.log('- Método:', complexResult.method || 'N/A');
    
    if (complexResult.success) {
      console.log('- Tamanho da imagem:', complexResult.imageBase64?.length || 0, 'caracteres');
      console.log('- Parâmetros usados:', JSON.stringify(complexResult.parameters, null, 2));
      
      // Salvar a imagem
      if (complexResult.imageBase64) {
        try {
          const imageBuffer = Buffer.from(complexResult.imageBase64, 'base64');
          const filename = `openai_native_tool_complex_${Date.now()}.png`;
          const outputDir = path.join('tests', 'output');
          
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          const filepath = path.join(outputDir, filename);
          fs.writeFileSync(filepath, imageBuffer);
          console.log('- Imagem salva em:', filepath);
        } catch (saveError) {
          console.log('- Erro ao salvar:', saveError.message);
        }
      }
    } else {
      console.log('- Erro:', complexResult.error);
      console.log('- Fallback necessário:', complexResult.fallbackRequired ? '✅' : '❌');
    }
  } else {
    console.log('⏭️  Pulando teste 2 - ferramenta nativa não suportada');
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 3: Diferentes estilos e parâmetros
  console.log('🎭 Teste 3: Testando diferentes estilos...');
  
  const styleTests = [
    { prompt: "A serene mountain landscape", expectedStyle: "natural" },
    { prompt: "A vibrant abstract art piece with bold colors", expectedStyle: "vivid" },
    { prompt: "A minimalist black and white photograph", expectedStyle: "natural" }
  ];

  for (const [index, test] of styleTests.entries()) {
    console.log(`\n  Teste 3.${index + 1}: ${test.prompt}`);
    
    try {
      const styleResult = await generateImageWithOpenAITool(test.prompt);
      
      console.log('  - Resultado:', styleResult.success ? '✅' : '❌');
      
      if (styleResult.success) {
        console.log('  - Estilo detectado:', styleResult.parameters?.style || 'N/A');
        console.log('  - Tamanho escolhido:', styleResult.parameters?.size || 'N/A');
        console.log('  - Qualidade:', styleResult.parameters?.quality || 'N/A');
        
        // Salvar apenas a primeira imagem de estilo para economizar espaço
        if (index === 0 && styleResult.imageBase64) {
          try {
            const imageBuffer = Buffer.from(styleResult.imageBase64, 'base64');
            const filename = `openai_native_tool_style_${Date.now()}.png`;
            const outputDir = path.join('tests', 'output');
            const filepath = path.join(outputDir, filename);
            
            fs.writeFileSync(filepath, imageBuffer);
            console.log('  - Imagem de exemplo salva em:', filepath);
          } catch (saveError) {
            console.log('  - Erro ao salvar:', saveError.message);
          }
        }
      } else {
        console.log('  - Erro:', styleResult.error);
      }
    } catch (error) {
      console.log('  - Erro crítico:', error.message);
    }
    
    // Pausa entre testes de estilo
    if (index < styleTests.length - 1) {
      console.log('  ⏳ Aguardando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Relatório final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO FINAL - FERRAMENTA NATIVA OPENAI');
  console.log('='.repeat(60));
  
  console.log('\n🔍 RESULTADOS PRINCIPAIS:');
  console.log('1. Suporte à ferramenta nativa:', supportTest.supportsNativeTool ? '✅ SIM' : '❌ NÃO');
  console.log('2. Function calling funciona:', supportTest.details?.success ? '✅ SIM' : '❌ NÃO');
  console.log('3. Fallback DALL-E disponível:', process.env.OPENAI_API_KEY ? '✅ SIM' : '❌ NÃO');
  
  console.log('\n💡 RECOMENDAÇÕES:');
  if (supportTest.supportsNativeTool) {
    console.log('   ✅ Use IMAGE_PROVIDER=openai-native-tool para aproveitar a ferramenta nativa');
    console.log('   ✅ A ferramenta escolhe automaticamente os melhores parâmetros');
    console.log('   ✅ Fallback para DALL-E está configurado para casos de erro');
  } else {
    console.log('   ⚠️  A ferramenta nativa não está funcionando com este modelo');
    console.log('   💡 Use IMAGE_PROVIDER=openai-dalle para DALL-E direto');
    console.log('   💡 Ou IMAGE_PROVIDER=stable-diffusion para geração local');
  }
  
  console.log('\n🔧 CONFIGURAÇÕES ATUAIS:');
  console.log(`   OPENAI_MODEL: ${process.env.OPENAI_MODEL}`);
  console.log(`   IMAGE_PROVIDER: ${process.env.IMAGE_PROVIDER}`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '❌ Não configurada'}`);
  
  const outputDir = path.join('tests', 'output');
  if (fs.existsSync(outputDir)) {
    console.log(`\n📁 Imagens geradas salvas em: ${outputDir}`);
  }
  
  console.log('\n🏁 Teste da ferramenta nativa concluído!');
}

// Executar os testes
main().catch(error => {
  console.error('❌ Erro durante os testes:', error);
  process.exit(1);
});
