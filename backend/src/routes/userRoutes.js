import { Router } from "express";
import { createUser, listUsers } from "../controllers/userController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const userRouter = Router({ mergeParams: true });

userRouter.use(authenticate, authorizeRoles("admin"));
userRouter.get("/", listUsers);
userRouter.post("/", createUser);

