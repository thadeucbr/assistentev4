import { ChromaClient } from 'chromadb';

const chroma = new ChromaClient({ 
  host: process.env.CHROMA_HOST,
  port: process.env.CHROMA_PORT
 });

export default chroma;