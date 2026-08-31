import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env, validateRuntimeEnv } from "./config/env.js";

async function start() {
  validateRuntimeEnv();
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`Meridian API listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});

