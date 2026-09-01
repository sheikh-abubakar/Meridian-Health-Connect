import { Router } from "express";
import { listAuditLogs } from "../controllers/auditLogController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const auditLogRouter = Router({ mergeParams: true });
auditLogRouter.get("/", authenticate, authorizeLocationAccess, authorizeRoles("admin"), listAuditLogs);
