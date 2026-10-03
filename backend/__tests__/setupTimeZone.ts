// Runs the suite in a zone far from campus, so code that leans on the host's
// zone instead of America/Los_Angeles fails here too, even on a Pacific machine.
// (Node applies TZ changes at runtime; tests that need another zone set and restore it.)
process.env.TZ = "Asia/Tokyo";
