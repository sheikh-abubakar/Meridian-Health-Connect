import { app } from "./app.js";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { connectDatabase } from "./config/database.js";
import { env, validateRuntimeEnv } from "./config/env.js";
import { startRealtimeChangeStream } from "./realtime/changeStream.js";
import { createSocketServer } from "./realtime/socketServer.js";

async function start() {
  validateRuntimeEnv();
  await connectDatabase();
  const server = createServer(app);
  const io = createSocketServer(server);
  const changeStream = startRealtimeChangeStream(io);
  server.requestTimeout = 30000;
  server.headersTimeout = 35000;
  server.keepAliveTimeout = 5000;

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; shutting down gracefully`);
    const forcedExit = setTimeout(() => process.exit(1), 10000);
    forcedExit.unref();
    await changeStream.close().catch(() => undefined);
    await new Promise((resolve) => io.close(resolve));
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    clearTimeout(forcedExit);
    process.exit(0);
  }
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));

  server.listen(env.port, env.host, () => {
    console.log(`Meridian API listening on ${env.host}:${env.port} (${env.nodeEnv})`);
  });
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
