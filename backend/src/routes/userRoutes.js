import { Router } from "express";
import { createUser, listUsers, removeUser } from "../controllers/userController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const userRouter = Router({ mergeParams: true });

userRouter.use(authenticate, authorizeLocationAccess, authorizeRoles("admin"));
userRouter.get("/", listUsers);
userRouter.post("/", createUser);
userRouter.delete("/:id", removeUser);
