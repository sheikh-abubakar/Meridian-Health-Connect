import { Router } from "express";
import { getLocationAnalytics } from "../controllers/analyticsController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const analyticsRouter = Router({ mergeParams: true });
analyticsRouter.get("/", authenticate, authorizeLocationAccess, authorizeRoles("admin"), getLocationAnalytics);

