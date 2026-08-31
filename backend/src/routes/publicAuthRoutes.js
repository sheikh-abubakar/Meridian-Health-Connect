import { Router } from "express";
import { discoverTenantAndLogin } from "../controllers/authController.js";

export const publicAuthRouter = Router();

publicAuthRouter.post("/login", discoverTenantAndLogin);
