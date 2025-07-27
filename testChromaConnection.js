import { ChromaClient } from 'chromadb';
import 'dotenv/config'; // Carrega as variáveis de ambiente
import { OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';

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
      path: `http://${host}:${port}`,
    });

    // Tenta listar as coleções para verificar a conexão inicial
    const collections = await client.listCollections();
    console.log('Conexão com ChromaDB bem-sucedida!');
    console.log('Coleções existentes (antes do teste):', collections);

    const testCollectionName = 'test_collection_temp';

    // 1. Tenta criar uma coleção (ou obter se já existe)
    console.log(`
Tentando criar/obter coleção: ${testCollectionName}`);
    const embeddings = new OpenAIEmbeddings();
    const vectorStore = new Chroma(embeddings, {
      collectionName: testCollectionName,
      client: client,
    });
    console.log(`Coleção '${testCollectionName}' criada/obtida com sucesso.`);

    // 2. Tenta adicionar um documento
    console.log('Tentando adicionar um documento...');
    const docId = 'test_doc_1';
    await vectorStore.addDocuments([
      {
        pageContent: 'Este é um documento de teste para verificar a funcionalidade do ChromaDB.',
        metadata: { id: docId, type: 'test' },
      },
    ]);
    console.log(`Documento '${docId}' adicionado com sucesso.`);

    // 3. Tenta recuperar o documento
    console.log('Tentando recuperar o documento...');
    const query = 'documento de teste';
    const results = await vectorStore.similaritySearch(query, 1);
    console.log('Recuperação de documento bem-sucedida!');
    console.log('Resultados da busca:', results.map(r => r.pageContent));

    // 4. Tenta excluir a coleção (limpeza)
    console.log(`
Tentando excluir coleção: ${testCollectionName}`);
    await client.deleteCollection({ name: testCollectionName });
    console.log(`Coleção '${testCollectionName}' excluída com sucesso.`);

  } catch (error) {
    console.error('Erro ao conectar ou interagir com ChromaDB:', error.message);
    console.error('Detalhes do erro:', error);
  }
}

testChromaConnection();