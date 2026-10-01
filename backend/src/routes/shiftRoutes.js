import { Router } from "express";
import { attendanceReport, clockIn, clockOut, coverageStatus, deleteShiftSchedule, listShiftSchedule, myShift, saveShiftSchedule } from "../controllers/shiftController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const shiftRouter = Router({ mergeParams: true });
shiftRouter.use(authenticate, authorizeLocationAccess);
shiftRouter.get("/schedule", authorizeRoles("admin", "frontdesk"), listShiftSchedule);
shiftRouter.put("/schedule", authorizeRoles("admin"), saveShiftSchedule);
shiftRouter.delete("/schedule/:id", authorizeRoles("admin"), deleteShiftSchedule);
shiftRouter.get("/me", authorizeRoles("frontdesk"), myShift);
shiftRouter.post("/clock-in", authorizeRoles("frontdesk"), clockIn);
shiftRouter.post("/clock-out", authorizeRoles("frontdesk"), clockOut);
shiftRouter.get("/report", authorizeRoles("admin"), attendanceReport);
shiftRouter.get("/coverage", authorizeRoles("admin"), coverageStatus);
