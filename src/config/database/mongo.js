import { MongoClient } from 'mongodb';
import logError from '../../utils/logger.js';

let client;
let db;

export async function connectToDb() {
  try {
    if (db) return db;
    const uri = process.env.MONGO_URI || 'mongodb://mongodb:27017';
    const dbName = process.env.MONGO_DB || 'whatsapp';
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    return db;
  } catch (err) {
    logError(err, 'connectToDb - Failed to connect to MongoDB');
    return JSON.stringify(err)
  }
}