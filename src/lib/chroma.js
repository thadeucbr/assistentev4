import { ChromaClient } from 'chromadb';

console.log(`Initializing ChromaClient with host: ${process.env.CHROMA_HOST}, port: ${process.env.CHROMA_PORT}`);
const chroma = new ChromaClient({ 
  host: process.env.CHROMA_HOST,
  port: process.env.CHROMA_PORT
 });

export default chroma;