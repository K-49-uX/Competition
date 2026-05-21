import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import dns from 'node:dns';
import { config } from './config.js';

let memoryServer = null;

// Atlas (mongodb+srv://) requires SRV/TXT lookups. Some local resolvers
// (corporate networks, captive portals, IPv6 misconfig) cannot answer SRV
// queries, producing ESERVFAIL. Force public resolvers so SRV always works.
if (config.mongoUri.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
}

async function startMemoryMongo() {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const dbPath = path.resolve(process.cwd(), 'data', 'mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'afya',
      dbPath,            // persist to disk so users + appointments survive restarts
      storageEngine: 'wiredTiger',
    },
  });
  console.log(`[db] using local persistent MongoDB at ${dbPath}`);
  return memoryServer.getUri('afya');
}

async function tryConnect(uri, { timeoutMs = 3000 } = {}) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    // Connection pool tuning for high concurrency (e.g. login surges).
    // Default is 100; bumping helps when many requests block on Mongo at once.
    maxPoolSize: Number(process.env.MONGO_POOL_SIZE) || 200,
    minPoolSize: Number(process.env.MONGO_MIN_POOL) || 10,
    socketTimeoutMS: 45_000,
  });
}

export async function connectDb() {
  mongoose.set('strictQuery', true);
  const uri = config.mongoUri;

  if (uri.startsWith('memory:') || process.env.MONGO_MODE === 'memory') {
    const memUri = await startMemoryMongo();
    await tryConnect(memUri, { timeoutMs: 15_000 });
    console.log('[db] connected (memory mode)');
    return;
  }

  try {
    await tryConnect(uri, { timeoutMs: 15_000 });
    console.log(`[db] connected to ${uri.replace(/\/\/.*@/, '//***@')}`);
  } catch (err) {
    console.warn(`[db] could not reach ${uri}: ${err.message}`);
    console.warn('[db] falling back to local persistent MongoDB (data/mongo)');
    const memUri = await startMemoryMongo();
    await tryConnect(memUri, { timeoutMs: 15_000 });
    console.log('[db] connected (memory fallback)');
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

