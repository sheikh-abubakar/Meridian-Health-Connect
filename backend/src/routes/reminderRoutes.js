import { Router } from "express";
import { listReminders } from "../controllers/reminderController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
export const reminderRouter = Router({ mergeParams: true });
reminderRouter.get("/", authenticate, authorizeLocationAccess, authorizeRoles("admin", "frontdesk", "doctor"), listReminders);
