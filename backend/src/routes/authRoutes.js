import { Router } from "express";
import { getSession, login } from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";

export const authRouter = Router({ mergeParams: true });

authRouter.post("/login", login);
authRouter.get("/me", authenticate, getSession);

