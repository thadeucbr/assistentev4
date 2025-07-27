import { ChromaClient } from 'chromadb';

const chroma = new ChromaClient({ path: process.env.CHROMA_URL });

export default chroma;