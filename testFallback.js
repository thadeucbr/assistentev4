import fallbackWebSearch from './src/agents/FallbackWebSearchAgent.js';

async function testFallback() {
  console.log('🔍 Testando FallbackWebSearchAgent...\n');
  
  const query = 'preço Bitcoin hoje';
  console.log(`📋 Testando: "${query}"`);
  
  try {
    const result = await fallbackWebSearch(query);
    
    if (result.error) {
      console.log('❌ Erro:', result.error);
    } else {
      console.log('✅ Sucesso!');
      console.log('📄 Resultado:', result.result?.substring(0, 200) + '...');
      console.log('🔗 Fontes:', result.sources?.slice(0, 2));
      console.log('🌐 Engine:', result.usedEngine);
    }
  } catch (error) {
    console.log('💥 Erro:', error.message);
  }
}

testFallback().then(() => {
  console.log('\n🏁 Teste concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro no teste:', error);
  process.exit(1);
});
