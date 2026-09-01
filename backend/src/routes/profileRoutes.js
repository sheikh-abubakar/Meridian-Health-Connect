import { Router } from "express";
import { getProfile, updatePassword } from "../controllers/profileController.js";
import { authenticate } from "../middleware/authenticate.js";

export const profileRouter = Router({ mergeParams: true });
profileRouter.use(authenticate);
profileRouter.get("/", getProfile);
profileRouter.patch("/password", updatePassword);

