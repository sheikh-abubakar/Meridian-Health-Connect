import { Router } from "express";
import { listRecallRequests, scheduleRecallRequest } from "../controllers/recallRequestController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const recallRequestRouter = Router({ mergeParams: true });
recallRequestRouter.use(authenticate, authorizeLocationAccess, authorizeRoles("frontdesk"));
recallRequestRouter.get("/", listRecallRequests);
recallRequestRouter.post("/:id/schedule", scheduleRecallRequest);
