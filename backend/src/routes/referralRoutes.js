import { Router } from "express";
import { closeReferralLoop, createReferral, incomingReferrals, myReferrals, patientReferrals, referralOptions, updateReferralStatus } from "../controllers/referralController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const referralRouter = Router({ mergeParams: true });
referralRouter.use(authenticate, authorizeLocationAccess);
referralRouter.get("/options", authorizeRoles("doctor"), referralOptions);
referralRouter.get("/me", authorizeRoles("doctor"), myReferrals);
referralRouter.get("/incoming", authorizeRoles("frontdesk", "admin"), incomingReferrals);
referralRouter.get("/patient/:patientId", authorizeRoles("frontdesk", "admin", "doctor", "care_coordinator"), patientReferrals);
referralRouter.post("/", authorizeRoles("doctor"), createReferral);
referralRouter.patch("/:id/status", authorizeRoles("doctor"), updateReferralStatus);
referralRouter.patch("/:id/close-loop", authorizeRoles("doctor"), closeReferralLoop);
