// Entry point: builds the app and starts the HTTP server.
import createApp from "./src/app.js";
import { info, success } from "./src/util/logger.js";

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  info(`Environment: ${process.env.NODE_ENV || "development"}`);
  success(`Server running on http://localhost:${PORT}`);
});
