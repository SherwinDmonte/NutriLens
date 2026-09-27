import { createServer } from 'node:http';

import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { ensureDatabaseSchema } from './config/databaseSchema.js';
import { assertAuthConfiguration, env } from './config/env.js';

let httpServer;
let isShuttingDown = false;

async function startServer() {
  assertAuthConfiguration();
  const connection = await connectDatabase();
  await ensureDatabaseSchema(connection);
  httpServer = createServer(createApp());

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(env.port, () => {
      httpServer.off('error', reject);
      console.log(`NutriLens API listening on http://localhost:${env.port}`);
      resolve();
    });
  });
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received. Closing the NutriLens API.`);

  const forcedExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out.');
    process.exit(1);
  }, 10_000);
  forcedExitTimer.unref();

  try {
    if (httpServer?.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }

    await disconnectDatabase();
    clearTimeout(forcedExitTimer);
    process.exit(0);
  } catch (error) {
    clearTimeout(forcedExitTimer);
    console.error(`The API could not shut down cleanly (${error.name || 'unknown error'}).`);
    process.exit(1);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

startServer().catch((error) => {
  console.error(
    `NutriLens API startup failed (${error.name || 'configuration error'}). Check the server environment and Atlas access settings.`,
  );
  process.exitCode = 1;
});
