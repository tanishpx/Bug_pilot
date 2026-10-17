import express from "express";
import { requireUser } from "../middleware/auth.js";
import {
  getBugs,
  getBugById,
  createBug,
  updateBug,
  deleteBug,
  getInvestigationNotes,
  addInvestigationNote,
  getPublicForm,
  submitFeedback,
} from "../controllers/bugController.js";

const router = express.Router();

// Public feedback form endpoints (mounted before /:id parameter)
router.get("/public/:formId", getPublicForm);
router.post("/public/:formId/submit", submitFeedback);

// Investigation Notes Endpoints (mounted before /:id)
router.get("/:id/notes", requireUser, getInvestigationNotes);
router.post("/:id/notes", requireUser, addInvestigationNote);

// REST Bug Endpoints
router.get("/", requireUser, getBugs);
router.post("/", requireUser, createBug);
router.get("/:id", requireUser, getBugById);
router.put("/:id", requireUser, updateBug);
router.patch("/:id", requireUser, updateBug);
router.delete("/:id", requireUser, deleteBug);

export default router;
