import { Router } from "express";
import { listDoctors, listStaff } from "../controllers/directoryController.js";
import { listMyPatients } from "../controllers/doctorPatientController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const directoryRouter = Router({ mergeParams: true });
directoryRouter.get("/doctors", authenticate, authorizeLocationAccess, authorizeRoles("frontdesk"), listDoctors);
directoryRouter.get("/staff-directory", authenticate, authorizeLocationAccess, authorizeRoles("doctor", "care_coordinator"), listStaff);
directoryRouter.get("/my-patients", authenticate, authorizeLocationAccess, authorizeRoles("doctor"), listMyPatients);
