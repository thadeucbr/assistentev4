#!/usr/bin/env node

import generateImage from '../src/skills/generateImage.js';

async function test() {
  console.log('🎨 Testando geração de imagem com ferramenta nativa OpenAI...');
  const result = await generateImage({ prompt: 'A beautiful sunset over the ocean' });
  
  if (result && result !== false) {
    console.log('✅ Sucesso! Imagem gerada com', result.length, 'caracteres base64');
  } else {
    console.log('❌ Falha na geração');
  }
}

test().catch(console.error);
