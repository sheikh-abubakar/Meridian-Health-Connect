import { Router } from "express";
import { createCarePlan, listOwnedCarePlans, listPatientCarePlans, updateCarePlan } from "../controllers/carePlanController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const carePlanRouter = Router({ mergeParams: true });
carePlanRouter.use(authenticate, authorizeLocationAccess);
carePlanRouter.get("/patient/:patientId", authorizeRoles("doctor", "frontdesk", "care_coordinator"), listPatientCarePlans);
carePlanRouter.get("/", authorizeRoles("doctor", "care_coordinator"), listOwnedCarePlans);
carePlanRouter.post("/", authorizeRoles("doctor", "care_coordinator"), createCarePlan);
carePlanRouter.patch("/:id", authorizeRoles("doctor", "care_coordinator"), updateCarePlan);
