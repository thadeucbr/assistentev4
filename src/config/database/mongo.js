import { MongoClient } from 'mongodb';

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
    return JSON.stringify(err)
  }
}