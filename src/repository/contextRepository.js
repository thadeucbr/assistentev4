import { connectToDb } from '../config/database/mongo.js';

const COLLECTION = 'user_contexts';

export async function getUserContext(userId) {
  const db = await connectToDb();
  const context = await db.collection(COLLECTION).findOne({ userId });
  return context ? context.context : { messages: [] };
}

export async function updateUserContext(userId, contextData) {
  const db = await connectToDb();
  await db.collection(COLLECTION).updateOne(
    { userId },
    { $set: { context: contextData, updatedAt: new Date() } },
    { upsert: true }
  );
}