import { app } from "./app.js";
import { createServer } from "node:http";
import { connectDatabase } from "./config/database.js";
import { env, validateRuntimeEnv } from "./config/env.js";
import { startRealtimeChangeStream } from "./realtime/changeStream.js";
import { createSocketServer } from "./realtime/socketServer.js";

async function start() {
  validateRuntimeEnv();
  await connectDatabase();
  const server = createServer(app);
  const io = createSocketServer(server);
  startRealtimeChangeStream(io);
  server.listen(env.port, () => {
    console.log(`Meridian API listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
