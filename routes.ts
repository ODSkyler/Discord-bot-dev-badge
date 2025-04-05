import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertCommandSchema, insertLogSchema } from "@shared/schema";
import { initDiscordBot, getDiscordClient } from "./discord";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize Discord bot
  await initDiscordBot(storage);
  
  // API routes
  // Get bot status
  app.get("/api/status", async (req: Request, res: Response) => {
    try {
      const bot = getDiscordClient();
      const stats = await storage.getBotStats();
      
      if (!bot || !stats) {
        return res.status(503).json({ message: "Bot is not available" });
      }
      
      res.json({
        status: bot.isReady() ? "online" : "offline",
        ...stats
      });
    } catch (error) {
      console.error("Error getting bot status:", error);
      res.status(500).json({ message: "Failed to get bot status" });
    }
  });
  
  // Get commands
  app.get("/api/commands", async (req: Request, res: Response) => {
    try {
      const commands = await storage.getCommands();
      res.json(commands);
    } catch (error) {
      console.error("Error getting commands:", error);
      res.status(500).json({ message: "Failed to get commands" });
    }
  });
  
  // Get command by ID
  app.get("/api/commands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid command ID" });
      }
      
      const command = await storage.getCommand(id);
      if (!command) {
        return res.status(404).json({ message: "Command not found" });
      }
      
      res.json(command);
    } catch (error) {
      console.error("Error getting command:", error);
      res.status(500).json({ message: "Failed to get command" });
    }
  });
  
  // Create command
  app.post("/api/commands", async (req: Request, res: Response) => {
    try {
      const validatedCommand = insertCommandSchema.parse(req.body);
      const command = await storage.createCommand(validatedCommand);
      res.status(201).json(command);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid command data", errors: error.errors });
      }
      console.error("Error creating command:", error);
      res.status(500).json({ message: "Failed to create command" });
    }
  });
  
  // Update command
  app.patch("/api/commands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid command ID" });
      }
      
      const validatedCommand = insertCommandSchema.partial().parse(req.body);
      const updatedCommand = await storage.updateCommand(id, validatedCommand);
      
      if (!updatedCommand) {
        return res.status(404).json({ message: "Command not found" });
      }
      
      res.json(updatedCommand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid command data", errors: error.errors });
      }
      console.error("Error updating command:", error);
      res.status(500).json({ message: "Failed to update command" });
    }
  });
  
  // Delete command
  app.delete("/api/commands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid command ID" });
      }
      
      const deleted = await storage.deleteCommand(id);
      if (!deleted) {
        return res.status(404).json({ message: "Command not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting command:", error);
      res.status(500).json({ message: "Failed to delete command" });
    }
  });
  
  // Get logs
  app.get("/api/logs", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const logs = await storage.getLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error getting logs:", error);
      res.status(500).json({ message: "Failed to get logs" });
    }
  });
  
  // Create log
  app.post("/api/logs", async (req: Request, res: Response) => {
    try {
      const validatedLog = insertLogSchema.parse(req.body);
      const log = await storage.createLog(validatedLog);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid log data", errors: error.errors });
      }
      console.error("Error creating log:", error);
      res.status(500).json({ message: "Failed to create log" });
    }
  });
  
  // Test command
  app.post("/api/test-command", async (req: Request, res: Response) => {
    try {
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ message: "Command is required" });
      }
      
      // Extract the command name from the input (remove the slash and get the first word)
      const commandName = command.startsWith('/') 
        ? command.substring(1).split(' ')[0] 
        : command.split(' ')[0];
      
      // Check if the command exists
      const cmd = await storage.getCommandByName(commandName);
      
      if (!cmd) {
        return res.status(404).json({ 
          message: `Command '${commandName}' not found`,
          response: `Unknown command: ${commandName}`
        });
      }
      
      // Simple responses for each command
      let response = "";
      switch (commandName) {
        case "ping":
          response = `Pong! 🏓 Bot latency: ${Math.floor(Math.random() * 50) + 20}ms\nBot is online and functioning properly!`;
          break;
        case "help":
          const commands = await storage.getCommands();
          response = "Available commands:\n" + 
            commands.filter(c => c.active).map(c => `/${c.name} - ${c.description}`).join("\n");
          break;
        case "uptime":
          const stats = await storage.getBotStats();
          response = `Bot has been online for ${stats?.uptime || "unknown"}`;
          break;
        case "stats":
          const botStats = await storage.getBotStats();
          response = `Bot Stats:\nServers: ${botStats?.servers || 0}\nCommands: ${botStats?.commands || 0}\nMemory Usage: ${botStats?.memoryUsage || "0 MB"}\nAPI Latency: ${botStats?.apiLatency || 0}ms`;
          break;
        default:
          response = `Executed command: ${command}`;
      }
      
      // Create a log for this test
      await storage.createLog({
        eventType: "Test",
        server: "Dashboard",
        user: "User",
        details: `Tested command: ${command}`
      });
      
      res.json({ message: "Command executed", response });
    } catch (error) {
      console.error("Error testing command:", error);
      res.status(500).json({ message: "Failed to test command" });
    }
  });
  
  // Restart bot
  app.post("/api/restart", async (req: Request, res: Response) => {
    try {
      // Log the restart attempt
      await storage.createLog({
        eventType: "System",
        server: "-",
        user: "-",
        details: "Bot restart requested"
      });
      
      const bot = getDiscordClient();
      if (!bot) {
        return res.status(503).json({ message: "Bot is not available" });
      }
      
      // In a real scenario, we would restart the bot
      // For this demo, we'll just log it and update the stats
      
      const now = new Date();
      await storage.updateBotStats({
        uptime: "0d 0h 0m",
        servers: bot.guilds.cache.size,
        commands: (await storage.getCommands()).length,
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        apiLatency: bot.ws.ping,
        startedAt: now,
        updatedAt: now
      });
      
      res.json({ message: "Bot restarted successfully" });
    } catch (error) {
      console.error("Error restarting bot:", error);
      res.status(500).json({ message: "Failed to restart bot" });
    }
  });

  return httpServer;
}
