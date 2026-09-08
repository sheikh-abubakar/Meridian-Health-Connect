import { Router } from "express";
import { cancelAppointment, checkInAppointment, createAppointment, listAppointments, markNoShow } from "../controllers/appointmentController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const appointmentRouter = Router({ mergeParams: true });
appointmentRouter.use(authenticate, authorizeLocationAccess);
appointmentRouter.get("/", authorizeRoles("admin", "frontdesk", "doctor"), listAppointments);
appointmentRouter.post("/", authorizeRoles("frontdesk"), createAppointment);
appointmentRouter.patch("/:id/check-in", authorizeRoles("frontdesk"), checkInAppointment);
appointmentRouter.patch("/:id/cancel", authorizeRoles("frontdesk"), cancelAppointment);
appointmentRouter.patch("/:id/no-show", authorizeRoles("frontdesk"), markNoShow);
