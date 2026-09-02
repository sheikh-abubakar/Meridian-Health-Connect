import { Router } from "express";
import { completeTask, createTask, listTasks, recordTaskOutcome } from "../controllers/taskController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const taskRouter = Router({ mergeParams: true });
taskRouter.use(authenticate, authorizeLocationAccess);
taskRouter.get("/", authorizeRoles("admin", "doctor", "frontdesk", "care_coordinator"), listTasks);
taskRouter.post("/", authorizeRoles("doctor", "care_coordinator"), createTask);
taskRouter.patch("/:id/complete", authorizeRoles("doctor", "frontdesk", "care_coordinator"), completeTask);
taskRouter.patch("/:taskId/outcome", authorizeRoles("doctor", "frontdesk", "care_coordinator"), recordTaskOutcome);
