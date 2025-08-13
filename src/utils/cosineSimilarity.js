// Centralized cosine similarity utility
// Reused by STM manager and vector store
export function cosineSimilarity(vecA = [], vecB = []) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0, a2 = 0, b2 = 0;
  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    a2 += a * a;
    b2 += b * b;
  }
  const mag = Math.sqrt(a2) * Math.sqrt(b2);
  return mag === 0 ? 0 : dot / mag;
}
