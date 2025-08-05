import smartWebSearch from './src/agents/SmartWebSearchAgent.js';
import logger from './src/utils/logger.js';

async function testSmartWebSearch() {
  console.log('🔍 Testando o SmartWebSearchAgent...\n');
  
  const testQueries = [
    'Qual é o preço atual do Bitcoin hoje?',
    'Últimas notícias sobre inteligência artificial no Brasil',
    'Como está o tempo em São Paulo hoje?'
  ];

  for (const query of testQueries) {
    console.log(`\n📋 Testando consulta: "${query}"`);
    console.log('─'.repeat(60));
    
    try {
      const startTime = Date.now();
      const result = await smartWebSearch(query);
      const endTime = Date.now();
      
      console.log(`⏱️  Tempo de execução: ${endTime - startTime}ms`);
      
      if (result.error) {
        console.log('❌ Erro:', result.error);
        if (result.partialResults) {
          console.log('🔗 URLs parciais:', result.partialResults);
        }
      } else {
        console.log('✅ Sucesso!');
        console.log('📄 Resultado:', result.result?.substring(0, 300) + '...');
        console.log('🔗 Fontes:', result.sources?.slice(0, 3));
      }
    } catch (error) {
      console.log('💥 Erro crítico:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Executar teste
testSmartWebSearch().then(() => {
  console.log('\n🏁 Teste concluído!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Erro no teste:', error);
  process.exit(1);
});
