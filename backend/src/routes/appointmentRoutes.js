import { Router } from "express";
import { checkInAppointment, createAppointment, listAppointments } from "../controllers/appointmentController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const appointmentRouter = Router({ mergeParams: true });
appointmentRouter.use(authenticate, authorizeLocationAccess);
appointmentRouter.get("/", authorizeRoles("admin", "frontdesk", "doctor"), listAppointments);
appointmentRouter.post("/", authorizeRoles("frontdesk"), createAppointment);
appointmentRouter.patch("/:id/check-in", authorizeRoles("frontdesk"), checkInAppointment);
