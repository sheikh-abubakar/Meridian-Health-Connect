import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { resolveTenant } from "./middleware/resolveTenant.js";
import { authRouter } from "./routes/authRoutes.js";
import { publicAuthRouter } from "./routes/publicAuthRoutes.js";
import { userRouter } from "./routes/userRoutes.js";

export const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api/auth", publicAuthRouter);
app.use("/api/:tenantSlug/auth", resolveTenant, authRouter);
app.use("/api/:tenantSlug/users", resolveTenant, userRouter);

app.use(notFoundHandler);
app.use(errorHandler);
