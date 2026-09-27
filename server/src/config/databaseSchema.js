import { FoodLog, SavedRecipe, User } from '../models/index.js';

const DATABASE_MODELS = Object.freeze([User, FoodLog, SavedRecipe]);

async function ensureCollection(database, collectionName) {
  try {
    await database.createCollection(collectionName);
  } catch (error) {
    if (error?.code !== 48 && error?.codeName !== 'NamespaceExists') throw error;
  }
}

async function ensureModelIndexes(database, model) {
  const collectionName = model.collection.collectionName;
  await ensureCollection(database, collectionName);

  const collection = database.collection(collectionName);
  for (const [fields, options] of model.schema.indexes()) {
    await collection.createIndex(fields, options);
  }
}

export async function ensureDatabaseSchema(connection) {
  if (!connection?.db) {
    throw new Error('A connected MongoDB database is required to initialize the schema.');
  }

  for (const model of DATABASE_MODELS) {
    await ensureModelIndexes(connection.db, model);
  }
}
