import { Router } from "express";
import { acceptAiSummary, addAmendment, finalizeEncounter, generateAiSummary, getEncounter, listPatientEncounters, startEncounter, updateDraft } from "../controllers/encounterController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const encounterRouter = Router({ mergeParams: true });
encounterRouter.use(authenticate, authorizeLocationAccess, authorizeRoles("doctor"));
encounterRouter.post("/", startEncounter);
encounterRouter.get("/patient/:patientId", listPatientEncounters);
encounterRouter.get("/:id", getEncounter);
encounterRouter.post("/:id/ai-summary", generateAiSummary);
encounterRouter.patch("/:id/ai-summary", acceptAiSummary);
encounterRouter.patch("/:id", updateDraft);
encounterRouter.patch("/:id/finalize", finalizeEncounter);
encounterRouter.post("/:id/amend", addAmendment);
