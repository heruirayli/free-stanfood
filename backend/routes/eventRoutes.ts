import express from "express";
import { getCalendar, getEvent, getEvents } from "../controllers/eventController.js";

const router = express.Router();

router.route("/").get(getEvents);
// Before "/:id", which would otherwise read "calendar.ics" as an event id.
router.route("/calendar.ics").get(getCalendar);
router.route("/:id").get(getEvent);

export default router;
