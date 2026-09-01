import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { resolveLocation } from "./middleware/resolveLocation.js";
import { resolveTenant } from "./middleware/resolveTenant.js";
import { authRouter } from "./routes/authRoutes.js";
import { appointmentRouter } from "./routes/appointmentRoutes.js";
import { analyticsRouter } from "./routes/analyticsRoutes.js";
import { availabilityRouter } from "./routes/availabilityRoutes.js";
import { directoryRouter } from "./routes/directoryRoutes.js";
import { encounterRouter } from "./routes/encounterRoutes.js";
import { carePlanRouter } from "./routes/carePlanRoutes.js";
import { taskRouter } from "./routes/taskRoutes.js";
import { auditLogRouter } from "./routes/auditLogRoutes.js";
import { publicAuthRouter } from "./routes/publicAuthRoutes.js";
import { locationContextRouter } from "./routes/locationContextRoutes.js";
import { overviewRouter } from "./routes/overviewRoutes.js";
import { patientRouter } from "./routes/patientRoutes.js";
import { profileRouter } from "./routes/profileRoutes.js";
import { userRouter } from "./routes/userRoutes.js";

export const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.use("/api/auth", publicAuthRouter);
app.use("/api/:tenantSlug/auth", resolveTenant, authRouter);
app.use("/api/:tenantSlug/profile", resolveTenant, profileRouter);
app.use("/api/:tenantSlug/overview", resolveTenant, overviewRouter);
app.use("/api/:tenantSlug/:locationSlug/context", resolveTenant, resolveLocation, locationContextRouter);
app.use("/api/:tenantSlug/:locationSlug/analytics", resolveTenant, resolveLocation, analyticsRouter);
app.use("/api/:tenantSlug/:locationSlug/users", resolveTenant, resolveLocation, userRouter);
app.use("/api/:tenantSlug/:locationSlug/patients", resolveTenant, resolveLocation, patientRouter);
app.use("/api/:tenantSlug/:locationSlug/availability", resolveTenant, resolveLocation, availabilityRouter);
app.use("/api/:tenantSlug/:locationSlug/appointments", resolveTenant, resolveLocation, appointmentRouter);
app.use("/api/:tenantSlug/:locationSlug/encounters", resolveTenant, resolveLocation, encounterRouter);
app.use("/api/:tenantSlug/:locationSlug/careplans", resolveTenant, resolveLocation, carePlanRouter);
app.use("/api/:tenantSlug/:locationSlug/tasks", resolveTenant, resolveLocation, taskRouter);
app.use("/api/:tenantSlug/:locationSlug/audit-logs", resolveTenant, resolveLocation, auditLogRouter);
app.use("/api/:tenantSlug/:locationSlug", resolveTenant, resolveLocation, directoryRouter);

app.use(notFoundHandler);
app.use(errorHandler);
