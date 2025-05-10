import { connectToDb } from '../config/database/mongo.js';
import parseScheduledTime from '../utils/parseScheduledTime.js';
const COLLECTION = 'reminders';

export async function getReminders(userId) {
  const db = await connectToDb();
  const reminders = await db.collection(COLLECTION).find({ userId }).toArray();
  return reminders.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
}

export async function getAllReminders() {
  const db = await connectToDb();
  const reminders = await db.collection(COLLECTION).find({}).toArray();
  return reminders.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
}

export async function addReminder(userId, message, scheduledTime, title = '', description = '') {
  const db = await connectToDb();
  const reminder = {
    userId,
    message,
    scheduledTime: parseScheduledTime(scheduledTime),
    title,
    description,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  try {
    const result = await db.collection(COLLECTION).insertOne(reminder);
    // Dependendo da versão do driver, pode ser necessário acessar result.ops[0] ou result.insertedId
    return { ...reminder, _id: result.insertedId };
  } catch (err) {
    throw new Error(`Failed to add reminder: ${err.message}`);
  }
}

export async function updateReminder(reminderId, updates) {
  const db = await connectToDb();
  
  try {
    const result = await db.collection(COLLECTION).findOneAndUpdate(
      { _id: reminderId },
      { $set: updates },
      { returnDocument: 'after' }
    );
    
    return result.value;
  } catch (err) {
    throw new Error(`Failed to update reminder: ${err.message}`);
  }
}

export async function deleteReminder(reminderId) {
  const db = await connectToDb();
  
  try {
    const result = await db.collection(COLLECTION).deleteOne({ _id: reminderId });
    return result.deletedCount > 0;
  } catch (err) {
    throw new Error(`Failed to delete reminder: ${err.message}`);
  }
}

export async function deleteAllReminders(userId) {
  const db = await connectToDb();
  
  try {
    const result = await db.collection(COLLECTION).deleteMany({ userId });
    return result.deletedCount;
  } catch (err) {
    throw new Error(`Failed to delete reminders: ${err.message}`);
  }
}
