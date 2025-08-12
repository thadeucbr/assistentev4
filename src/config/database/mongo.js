import { MongoClient } from 'mongodb';
import { logError } from '../../utils/logger.js';

let client;
let db;

export async function connectToDb() {
  try {
    if (db) return db;
    
    // Usar o nome correto do container MongoDB
    const uri = process.env.MONGO_URI || 'mongodb://llm-mongodb:27017';
    const dbName = process.env.MONGO_DB || 'whatsapp';
    
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    
    return db;
  } catch (err) {
    logError(err, 'connectToDb - Failed to connect to MongoDB');
    // Lançar erro em vez de retornar string
    throw new Error(`MongoDB connection failed: ${err.message}`);
  }
}