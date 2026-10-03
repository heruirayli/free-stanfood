import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config({ quiet: true });

const port = Number(process.env.PORT) || 5000;

// Express 5 hands listen errors (such as the port being taken) to this callback
// instead of throwing, so report them and exit non-zero.
createApp().listen(port, (error) => {
  if (error) {
    console.error(`Could not start the server on port ${port}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Server started on port ${port}`);
});
