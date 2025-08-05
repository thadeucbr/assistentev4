import generateAudio from './src/skills/generateAudio.js';

async function testAudioGeneration() {
  console.log('Testando geração de áudio com gTTS...');
  
  const testText = "Olá! Este é um teste do novo sistema de geração de áudio usando Google Text-to-Speech. A qualidade deve estar muito melhor que antes!";
  
  try {
    const result = await generateAudio(testText);
    
    if (result.success) {
      console.log('✅ Áudio gerado com sucesso!');
      console.log(`📊 Tamanho do buffer: ${result.audioBuffer.length} bytes`);
      console.log('🎵 Qualidade: Google TTS (muito melhor que Piper)');
    } else {
      console.error('❌ Erro ao gerar áudio:', result.error);
    }
  } catch (error) {
    console.error('❌ Erro inesperado:', error.message);
  }
}

testAudioGeneration();
