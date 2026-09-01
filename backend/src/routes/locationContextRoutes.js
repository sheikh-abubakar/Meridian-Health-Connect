import { Router } from "express";
import { getLocationContext } from "../controllers/locationController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";

export const locationContextRouter = Router({ mergeParams: true });

locationContextRouter.get("/", authenticate, authorizeLocationAccess, getLocationContext);

