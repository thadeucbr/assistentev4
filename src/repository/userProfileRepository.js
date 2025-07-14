
import { connectToDb } from '../config/database/mongo.js';

const COLLECTION = 'user_profiles';

export async function getUserProfile(userId) {
  const db = await connectToDb();
  const profile = await db.collection(COLLECTION).findOne({ userId });
  return profile;
}

export async function updateUserProfile(userId, profileData) {
  const db = await connectToDb();
  await db.collection(COLLECTION).updateOne(
    { userId },
    { $set: { ...profileData, updatedAt: new Date() } },
    { upsert: true, $setOnInsert: { createdAt: new Date() } }
  );
}
