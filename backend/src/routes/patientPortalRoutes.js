import { Router } from "express";
import {
  activatePortal,
  inspectActivation,
  patientPortalAppointments,
  patientPortalBookAppointment,
  patientPortalBookingOptions,
  patientPortalCarePlans,
  patientPortalExport,
  patientPortalLogin,
  patientPortalSession,
} from "../controllers/patientPortalController.js";
import { patientPortalForms, submitPatientPortalForm } from "../controllers/formTemplateController.js";
import {
  portalMessages,
  portalSendMessage,
} from "../controllers/messageController.js";
import { authenticatePatientPortal } from "../middleware/authenticatePatientPortal.js";

export const patientPortalRouter = Router();
patientPortalRouter.get("/activate/:token", inspectActivation);
patientPortalRouter.post("/activate/:token", activatePortal);
patientPortalRouter.post("/login", patientPortalLogin);
patientPortalRouter.get(
  "/session",
  authenticatePatientPortal,
  patientPortalSession,
);
patientPortalRouter.get(
  "/appointments",
  authenticatePatientPortal,
  patientPortalAppointments,
);
patientPortalRouter.get(
  "/booking-options",
  authenticatePatientPortal,
  patientPortalBookingOptions,
);
patientPortalRouter.post(
  "/appointments",
  authenticatePatientPortal,
  patientPortalBookAppointment,
);
patientPortalRouter.get("/messages", authenticatePatientPortal, portalMessages);
patientPortalRouter.post(
  "/messages",
  authenticatePatientPortal,
  portalSendMessage,
);
patientPortalRouter.get(
  "/care-plans",
  authenticatePatientPortal,
  patientPortalCarePlans,
);
patientPortalRouter.get(
  "/export",
  authenticatePatientPortal,
  patientPortalExport,
);
patientPortalRouter.get("/forms", authenticatePatientPortal, patientPortalForms);
patientPortalRouter.post("/forms/:assignedFormId/submit", authenticatePatientPortal, submitPatientPortalForm);
