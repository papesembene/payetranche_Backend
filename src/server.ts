import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";

const app = createApp();

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`PayTranche API running on port ${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`${signal} received. Closing PayTranche API...`);
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
