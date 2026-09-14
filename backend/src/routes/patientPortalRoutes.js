import { Router } from "express";
import { activatePortal, inspectActivation, patientPortalLogin, patientPortalSession } from "../controllers/patientPortalController.js";
import { authenticatePatientPortal } from "../middleware/authenticatePatientPortal.js";

export const patientPortalRouter = Router();
patientPortalRouter.get("/activate/:token", inspectActivation);
patientPortalRouter.post("/activate/:token", activatePortal);
patientPortalRouter.post("/login", patientPortalLogin);
patientPortalRouter.get("/session", authenticatePatientPortal, patientPortalSession);
