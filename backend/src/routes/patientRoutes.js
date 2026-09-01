import { Router } from "express";
import { createPatient, getPatient, listPatients, searchPatients } from "../controllers/patientController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const patientRouter = Router({ mergeParams: true });
patientRouter.use(authenticate, authorizeLocationAccess);
patientRouter.get("/", authorizeRoles("frontdesk"), listPatients);
patientRouter.get("/search", authorizeRoles("frontdesk"), searchPatients);
patientRouter.get("/:id", authorizeRoles("frontdesk", "doctor", "care_coordinator"), getPatient);
patientRouter.post("/", authorizeRoles("frontdesk"), createPatient);
