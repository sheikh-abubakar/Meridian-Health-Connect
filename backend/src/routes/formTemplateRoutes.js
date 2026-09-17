import { Router } from "express";
import { createFormTemplate, listFormTemplates, updateFormTemplate } from "../controllers/formTemplateController.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorizeLocationAccess } from "../middleware/authorizeLocationAccess.js";
import { authorizeRoles } from "../middleware/authorizeRoles.js";

export const formTemplateRouter = Router({ mergeParams: true });
formTemplateRouter.use(authenticate, authorizeLocationAccess);
// Front-desk needs a read-only list to assign a branch's approved forms.
// Building or changing a legal/consent template remains Admin-only.
formTemplateRouter.get("/", authorizeRoles("admin", "frontdesk"), listFormTemplates);
formTemplateRouter.post("/", authorizeRoles("admin"), createFormTemplate);
formTemplateRouter.patch("/:id", authorizeRoles("admin"), updateFormTemplate);
