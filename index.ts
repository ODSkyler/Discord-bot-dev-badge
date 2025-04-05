import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initDiscordBot, cleanup, getDiscordClient } from "./discord";
import { storage } from "./storage";
import { setTimeout } from "timers/promises";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Process-level error handlers for stability
process.on("uncaughtException", async (error) => {
  console.error("Uncaught Exception:", error);
  
  try {
    // Log the error
    await storage.createLog({
      eventType: "Error",
      server: "-",
      user: "-",
      details: `Uncaught Exception: ${error.message}`
    });
    
    // For critical errors that would normally crash the application,
    // we log but don't exit to keep the bot running
    console.log("Application recovered from uncaught exception");
  } catch (logError) {
    console.error("Failed to log uncaught exception:", logError);
  }
});

process.on("unhandledRejection", async (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  
  try {
    // Log the error
    await storage.createLog({
      eventType: "Error",
      server: "-",
      user: "-",
      details: `Unhandled Rejection: ${reason}`
    });
  } catch (logError) {
    console.error("Failed to log unhandled rejection:", logError);
  }
});

// Initialize Discord bot
initDiscordBot(storage);

// Setup anti-sleep mechanism to keep the bot online
const setupKeepAlive = (server: any) => {
  const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
  
  setInterval(() => {
    // Log keep-alive message
    log("Keep-alive ping to prevent application from sleeping");
    
    // Simple self-ping to keep the application awake
    fetch(`http://localhost:5000/api/status`)
      .then(() => log("Keep-alive pong received"))
      .catch(err => log(`Keep-alive error: ${err.message}`));
    
    // Check Discord client status
    const client = getDiscordClient();
    if (client && !client.isReady()) {
      log("Discord client is not ready, attempting to reconnect...");
      // Let the reconnect logic in discord/index.ts handle the reconnection
    }
  }, KEEP_ALIVE_INTERVAL);
  
  log("Keep-alive mechanism initialized");
};

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Initialize keep-alive mechanism after server starts
    setupKeepAlive(server);
  });
})();
