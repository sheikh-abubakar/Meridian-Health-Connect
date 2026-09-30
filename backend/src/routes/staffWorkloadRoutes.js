import { Router } from "express";
import { getStaffWorkload } from "../controllers/staffWorkloadController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const staffWorkloadRouter = Router({ mergeParams: true });
staffWorkloadRouter.use(authenticate, authorizeLocationAccess, authorizeRoles("admin"));
staffWorkloadRouter.get("/", getStaffWorkload);
