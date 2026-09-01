import { Router } from "express";
import { getTenantOverview } from "../controllers/locationController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const overviewRouter = Router({ mergeParams: true });

overviewRouter.get("/", authenticate, authorizeRoles("admin"), getTenantOverview);

