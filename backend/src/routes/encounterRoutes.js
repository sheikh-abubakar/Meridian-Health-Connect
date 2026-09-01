import { Router } from "express";
import { addAmendment, finalizeEncounter, getEncounter, listPatientEncounters, startEncounter, updateDraft } from "../controllers/encounterController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const encounterRouter = Router({ mergeParams: true });
encounterRouter.use(authenticate, authorizeLocationAccess, authorizeRoles("doctor"));
encounterRouter.post("/", startEncounter);
encounterRouter.get("/patient/:patientId", listPatientEncounters);
encounterRouter.get("/:id", getEncounter);
encounterRouter.patch("/:id", updateDraft);
encounterRouter.patch("/:id/finalize", finalizeEncounter);
encounterRouter.post("/:id/amend", addAmendment);

