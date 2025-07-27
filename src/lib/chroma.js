import { ChromaClient } from 'chromadb';

const chroma = new ChromaClient({ 
  path: `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`
 });

export default chroma;

export default chroma;