import { connectDatabase, disconnectDatabase, getDatabaseName } from '../config/db.js';
import { ensureDatabaseSchema } from '../config/databaseSchema.js';

async function checkDatabase() {
  let currentStep = 'connecting';

  try {
    const connection = await connectDatabase();

    currentStep = 'pinging the NutriLens database';
    await connection.db.command({ ping: 1 });

    currentStep = 'creating the NutriLens collections and indexes';
    await ensureDatabaseSchema(connection);

    console.log(
      `Atlas connection verified. The ${getDatabaseName()} database and NutriLens indexes are ready.`,
    );
  } catch (error) {
    const failureLocation = error.stack?.split('\n')[1]?.trim();
    console.error(
      `Atlas connection check failed while ${currentStep} (${error.name || 'unknown error'}: ${error.message || 'No details available'}).`,
    );
    if (failureLocation) console.error(`Failure location: ${failureLocation}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

await checkDatabase();
