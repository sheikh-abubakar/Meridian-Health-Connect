import { Router } from "express";
import { activatePortal, inspectActivation, patientPortalAppointments, patientPortalBookAppointment, patientPortalBookingOptions, patientPortalLogin, patientPortalSession } from "../controllers/patientPortalController.js";
import { authenticatePatientPortal } from "../middleware/authenticatePatientPortal.js";

export const patientPortalRouter = Router();
patientPortalRouter.get("/activate/:token", inspectActivation);
patientPortalRouter.post("/activate/:token", activatePortal);
patientPortalRouter.post("/login", patientPortalLogin);
patientPortalRouter.get("/session", authenticatePatientPortal, patientPortalSession);
patientPortalRouter.get("/appointments", authenticatePatientPortal, patientPortalAppointments);
patientPortalRouter.get("/booking-options", authenticatePatientPortal, patientPortalBookingOptions);
patientPortalRouter.post("/appointments", authenticatePatientPortal, patientPortalBookAppointment);
