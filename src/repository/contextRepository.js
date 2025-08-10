import { connectToDb } from '../config/database/mongo.js';

const COLLECTION = 'user_contexts';

export async function getUserContext(userId) {
  const db = await connectToDb();
  const context = await db.collection(COLLECTION).findOne({ userId });
  return context ? context.context : { messages: [] };
}

const MAX_MESSAGES = 10; // Define o tamanho da janela deslizante

export async function updateUserContext(userId, contextData) {
  const db = await connectToDb();

  // Aplica a janela deslizante
  if (contextData.messages.length > MAX_MESSAGES) {
    contextData.messages = contextData.messages.slice(-MAX_MESSAGES);
  }

  await db.collection(COLLECTION).updateOne(
    { userId },
    { $set: { context: contextData, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function clearUserContext(userId) {
  const db = await connectToDb();
  await db.collection(COLLECTION).updateOne(
    { userId },
    { $set: { context: { messages: [] }, updatedAt: new Date() } },
    { upsert: true }
  );
}