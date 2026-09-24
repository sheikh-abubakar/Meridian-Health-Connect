import { Router } from "express";
import {
  activatePortal,
  inspectActivation,
  patientPortalAppointments,
  patientPortalBookAppointment,
  patientPortalCancelAppointment,
  patientPortalBookingOptions,
  patientPortalRescheduleAppointment,
  patientPortalRescheduleOptions,
  patientPortalCarePlans,
  patientPortalExport,
  patientPortalLogin,
  patientPortalNotifications,
  patientPortalPrescriptionPdf,
  patientPortalPrescriptions,
  markPatientPortalNotificationRead,
  patientPortalSession,
} from "../controllers/patientPortalController.js";
import { patientPortalForms, submitPatientPortalForm } from "../controllers/formTemplateController.js";
import {
  portalMessages,
  portalSendMessage,
} from "../controllers/messageController.js";
import { authenticatePatientPortal } from "../middleware/authenticatePatientPortal.js";
import { patientPortalAddMonitoringReading, patientPortalMonitoring } from "../controllers/monitoringController.js";
import { patientPortalBookLabOrder, patientPortalLabOrders, patientPortalViewLabReport } from "../controllers/labController.js";

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
patientPortalRouter.get("/appointments/:id/reschedule-options", authenticatePatientPortal, patientPortalRescheduleOptions);
patientPortalRouter.patch("/appointments/:id/cancel", authenticatePatientPortal, patientPortalCancelAppointment);
patientPortalRouter.post("/appointments/:id/reschedule", authenticatePatientPortal, patientPortalRescheduleAppointment);
patientPortalRouter.get("/notifications", authenticatePatientPortal, patientPortalNotifications);
patientPortalRouter.patch("/notifications/:id/read", authenticatePatientPortal, markPatientPortalNotificationRead);
patientPortalRouter.get("/prescriptions", authenticatePatientPortal, patientPortalPrescriptions);
patientPortalRouter.get("/prescriptions/:encounterId/pdf", authenticatePatientPortal, patientPortalPrescriptionPdf);
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
patientPortalRouter.get("/monitoring", authenticatePatientPortal, patientPortalMonitoring);
patientPortalRouter.post("/monitoring/:enrollmentId/readings", authenticatePatientPortal, patientPortalAddMonitoringReading);
patientPortalRouter.get("/lab-orders", authenticatePatientPortal, patientPortalLabOrders);
patientPortalRouter.post("/lab-orders/:id/book", authenticatePatientPortal, patientPortalBookLabOrder);
patientPortalRouter.get("/lab-orders/:id/report", authenticatePatientPortal, patientPortalViewLabReport);
