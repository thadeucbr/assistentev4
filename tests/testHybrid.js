import hybridWebSearch from './src/agents/HybridWebSearchAgent.js';

async function testHybrid() {
  console.log('🔍 Testando HybridWebSearchAgent...\n');
  
  const query = 'preço Bitcoin hoje';
  console.log(`📋 Testando: "${query}"`);
  
  try {
    const result = await hybridWebSearch(query);
    
    if (result.error) {
      console.log('❌ Erro:', result.error);
    } else {
      console.log('✅ Sucesso!');
      console.log('🔧 Método:', result.method);
      console.log('📄 Resultado:', result.result?.substring(0, 300) + '...');
      console.log('🔗 Fontes:', result.sources?.slice(0, 2));
    }
  } catch (error) {
    console.log('💥 Erro:', error.message);
  }
}

testHybrid().then(() => {
  console.log('\n🏁 Teste concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro no teste:', error);
  process.exit(1);
});
