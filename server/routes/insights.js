import express from "express";
import { requireUser } from "../middleware/auth.js";
import { getInsights } from "../controllers/insightsController.js";

const router = express.Router();

router.get("/", requireUser, getInsights);

export default router;