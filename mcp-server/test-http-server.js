import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Testar endpoints HTTP do servidor MCP
async function testHttpServer() {
  console.log('🚀 Iniciando teste do servidor HTTP MCP...');
  
  const baseUrl = 'http://localhost:3001';
  
  try {
    // Teste 1: Health check
    console.log('🏥 Testando health check...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);
    
    // Teste 2: Listar tools
    console.log('📋 Testando listagem de tools...');
    const toolsResponse = await fetch(`${baseUrl}/tools`);
    const toolsData = await toolsResponse.json();
    console.log(`✅ Tools encontradas: ${toolsData.count}`);
    toolsData.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    
    // Teste 3: Executar análise de sentimento
    console.log('😊 Testando análise de sentimento...');
    const sentimentResponse = await fetch(`${baseUrl}/tools/sentiment_analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Estou muito feliz hoje!' })
    });
    const sentimentData = await sentimentResponse.json();
    console.log('✅ Análise de sentimento:', sentimentData);
    
    // Teste 4: Teste de tool inexistente
    console.log('❌ Testando tool inexistente...');
    const invalidResponse = await fetch(`${baseUrl}/tools/tool_inexistente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    const invalidData = await invalidResponse.json();
    console.log('✅ Resposta para tool inexistente:', invalidData);
    
    // Teste 5: Métricas
    console.log('📊 Testando métricas...');
    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    const metricsData = await metricsResponse.json();
    console.log('✅ Métricas:', metricsData);
    
    console.log('\n🎉 Todos os testes HTTP concluídos com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
  }
}

// Função para iniciar o servidor e executar os testes
async function runFullTest() {
  console.log('🎬 Iniciando servidor HTTP MCP para testes...');
  
  // Iniciar servidor em background
  const serverProcess = exec('cd /home/thadeu/assistentev4/mcp-server && node http-server.js');
  
  // Aguardar servidor iniciar
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    await testHttpServer();
  } finally {
    console.log('🛑 Encerrando servidor de teste...');
    serverProcess.kill('SIGTERM');
  }
}

// Verificar se deve executar o teste completo ou apenas chamar endpoints
const shouldStartServer = process.argv.includes('--start-server');

if (shouldStartServer) {
  runFullTest().catch(console.error);
} else {
  console.log('📡 Testando endpoints (assumindo servidor já está rodando)...');
  testHttpServer().catch(console.error);
}
