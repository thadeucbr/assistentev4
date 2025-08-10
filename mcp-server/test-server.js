import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Testa o servidor MCP usando stdio
function testMCPServer() {
  const serverPath = join(__dirname, 'index.js');
  
  console.log('🚀 Iniciando teste do servidor MCP...');
  
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Teste básico: listar tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  console.log('📤 Enviando requisição para listar tools...');
  
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

  let responseData = '';
  
  server.stdout.on('data', (data) => {
    responseData += data.toString();
    
    try {
      const lines = responseData.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.trim()) {
          const response = JSON.parse(line);
          console.log('📥 Resposta do servidor:', JSON.stringify(response, null, 2));
        }
      }
    } catch (error) {
      console.log('📡 Dados recebidos (não JSON):', data.toString());
    }
  });

  server.stderr.on('data', (data) => {
    console.log('⚠️ Log do servidor:', data.toString());
  });

  server.on('close', (code) => {
    console.log(`🔚 Servidor encerrado com código: ${code}`);
  });

  // Teste de tool específica após 2 segundos
  setTimeout(() => {
    const callToolRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'sentiment_analysis',
        arguments: {
          text: 'Estou muito feliz hoje!'
        }
      }
    };

    console.log('📤 Testando análise de sentimento...');
    server.stdin.write(JSON.stringify(callToolRequest) + '\n');
  }, 2000);

  // Encerrar teste após 10 segundos
  setTimeout(() => {
    console.log('🔚 Encerrando teste...');
    server.kill('SIGTERM');
  }, 10000);
}

// Executar teste
testMCPServer();
