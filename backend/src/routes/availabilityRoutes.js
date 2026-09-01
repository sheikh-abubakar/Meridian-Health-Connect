import { Router } from "express";
import { getDoctorAvailability, setOwnAvailability } from "../controllers/availabilityController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const availabilityRouter = Router({ mergeParams: true });
availabilityRouter.use(authenticate, authorizeLocationAccess);
availabilityRouter.put("/", authorizeRoles("doctor"), setOwnAvailability);
availabilityRouter.post("/", authorizeRoles("doctor"), setOwnAvailability);
availabilityRouter.get("/:doctorId", authorizeRoles("admin", "frontdesk", "doctor"), getDoctorAvailability);

