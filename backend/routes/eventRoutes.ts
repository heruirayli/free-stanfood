import express from "express";
import { getCalendar, getEvent, getEvents, getStatus } from "../controllers/eventController.js";

const router = express.Router();

router.route("/").get(getEvents);
// Before "/:id", which would otherwise read these as event ids.
router.route("/calendar.ics").get(getCalendar);
router.route("/status").get(getStatus);
router.route("/:id").get(getEvent);

export default router;
