import { Router } from "express";
import { addWaitlist, listWaitlist, removeWaitlist } from "../controllers/waitlistController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";
export const waitlistRouter = Router({ mergeParams: true });
waitlistRouter.use(authenticate, authorizeLocationAccess, authorizeRoles("frontdesk"));
waitlistRouter.get("/", listWaitlist); waitlistRouter.post("/", addWaitlist); waitlistRouter.delete("/:id", removeWaitlist);
