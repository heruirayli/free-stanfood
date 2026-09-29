import express from "express";
import { getEvent, getEvents } from "../controllers/eventController.js";

const router = express.Router();

router.route("/").get(getEvents);
router.route("/:id").get(getEvent);

export default router;
