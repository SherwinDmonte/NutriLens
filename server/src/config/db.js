import mongoose from 'mongoose';

import { env } from './env.js';

mongoose.set('bufferCommands', false);

const DATABASE_STATES = Object.freeze({
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
});

let connectionPromise;
let listenersRegistered = false;

function registerConnectionListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('connected', () => {
    console.log(`MongoDB connected to the ${env.mongodbDatabase} database.`);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected.');
  });

  mongoose.connection.on('error', (error) => {
    console.error(`MongoDB connection error (${error.name || 'unknown error'}).`);
  });
}

export async function connectDatabase() {
  if (!env.mongodbUri) {
    throw new Error(
      'MONGODB_URI is missing. Copy server/.env.example to server/.env and add the Atlas connection string.',
    );
  }

  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  registerConnectionListeners();

  connectionPromise = mongoose
    .connect(env.mongodbUri, {
      dbName: env.mongodbDatabase,
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
    })
    .then(() => mongoose.connection)
    .catch((error) => {
      connectionPromise = undefined;
      throw error;
    });

  return connectionPromise;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  connectionPromise = undefined;
}

export function getDatabaseStatus() {
  return DATABASE_STATES[mongoose.connection.readyState] || 'unknown';
}

export function getDatabaseName() {
  return env.mongodbDatabase;
}
