import { Router } from "express";
import { acknowledgeMonitoringAlert, addStaffReading, adherenceEnrollments, createMonitoringOutreachTask, endMonitoring, enrollPatientMonitoring, listPatientMonitoring } from "../controllers/monitoringController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const monitoringRouter = Router({ mergeParams: true });
monitoringRouter.use(authenticate, authorizeLocationAccess);
monitoringRouter.get("/patient/:patientId", authorizeRoles("doctor", "care_coordinator", "frontdesk", "admin"), listPatientMonitoring);
monitoringRouter.post("/patient/:patientId", authorizeRoles("doctor"), enrollPatientMonitoring);
monitoringRouter.post("/patient/:patientId/enrollments/:enrollmentId/readings", authorizeRoles("doctor"), addStaffReading);
monitoringRouter.patch("/readings/:readingId/acknowledge", authorizeRoles("doctor"), acknowledgeMonitoringAlert);
monitoringRouter.patch("/enrollments/:enrollmentId/end", authorizeRoles("doctor"), endMonitoring);
monitoringRouter.get("/adherence", authorizeRoles("care_coordinator"), adherenceEnrollments);
monitoringRouter.post("/enrollments/:enrollmentId/outreach-task", authorizeRoles("care_coordinator"), createMonitoringOutreachTask);
