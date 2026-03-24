import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "Relay",
    version: "0.4.0",
    timestamp: new Date().toISOString(),
  });
});

export default app;
