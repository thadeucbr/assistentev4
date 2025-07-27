import { ChromaClient } from 'chromadb';
import 'dotenv/config'; // Carrega as variáveis de ambiente

async function testChromaConnection() {
  const host = process.env.CHROMA_HOST;
  const port = process.env.CHROMA_PORT;

  if (!host || !port) {
    console.error('Erro: CHROMA_HOST ou CHROMA_PORT não definidos no .env');
    return;
  }

  console.log(`Tentando conectar ao ChromaDB em: http://${host}:${port}`);

  try {
    const client = new ChromaClient({
      host: host,
      port: port,
    });

    // Tenta listar as coleções para verificar a conexão
    const collections = await client.listCollections();
    console.log('Conexão com ChromaDB bem-sucedida!');
    console.log('Coleções existentes:', collections);
  } catch (error) {
    console.error('Erro ao conectar ou interagir com ChromaDB:', error.message);
    console.error('Detalhes do erro:', error);
  }
}

testChromaConnection();