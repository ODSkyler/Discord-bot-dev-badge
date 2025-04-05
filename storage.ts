import { 
  Command, InsertCommand, 
  Log, InsertLog, 
  BotStat, InsertBotStat,
  commands, logs, botStats
} from "@shared/schema";

// Storage interface
export interface IStorage {
  // Commands
  getCommands(): Promise<Command[]>;
  getCommand(id: number): Promise<Command | undefined>;
  getCommandByName(name: string): Promise<Command | undefined>;
  createCommand(command: InsertCommand): Promise<Command>;
  updateCommand(id: number, command: Partial<InsertCommand>): Promise<Command | undefined>;
  deleteCommand(id: number): Promise<boolean>;
  
  // Logs
  getLogs(limit?: number): Promise<Log[]>;
  createLog(log: InsertLog): Promise<Log>;
  
  // Bot Stats
  getBotStats(): Promise<BotStat | undefined>;
  updateBotStats(stats: InsertBotStat): Promise<BotStat>;
}

export class MemStorage implements IStorage {
  private commands: Map<number, Command>;
  private logs: Log[];
  private botStats: BotStat | undefined;
  private commandsIdCounter: number;
  private logsIdCounter: number;

  constructor() {
    this.commands = new Map();
    this.logs = [];
    this.commandsIdCounter = 1;
    this.logsIdCounter = 1;
    
    // Initialize with default commands
    const defaultCommands = [
      {
        name: "ping",
        description: "Checks the bot's response time and health status.",
        usage: "/ping",
        active: true,
      },
      {
        name: "help",
        description: "Displays a list of available commands and their usage.",
        usage: "/help [command]",
        active: true,
      },
      {
        name: "uptime",
        description: "Shows how long the bot has been online without interruption.",
        usage: "/uptime",
        active: true,
      },
      {
        name: "stats",
        description: "Displays bot statistics including servers, users, and commands.",
        usage: "/stats",
        active: true,
      }
    ];
    
    defaultCommands.forEach(cmd => this.createCommand(cmd));
    
    // Initialize with default bot stats
    const now = new Date();
    this.updateBotStats({
      uptime: "0d 0h 0m",
      servers: 0,
      commands: defaultCommands.length,
      memoryUsage: "0 MB",
      apiLatency: 0,
      startedAt: now,
      updatedAt: now
    });
  }
  
  // Commands methods
  async getCommands(): Promise<Command[]> {
    return Array.from(this.commands.values());
  }
  
  async getCommand(id: number): Promise<Command | undefined> {
    return this.commands.get(id);
  }
  
  async getCommandByName(name: string): Promise<Command | undefined> {
    return Array.from(this.commands.values()).find(cmd => cmd.name === name);
  }
  
  async createCommand(command: InsertCommand): Promise<Command> {
    const id = this.commandsIdCounter++;
    const now = new Date();
    const newCommand: Command = { 
      id, 
      ...command, 
      createdAt: now
    };
    this.commands.set(id, newCommand);
    return newCommand;
  }
  
  async updateCommand(id: number, command: Partial<InsertCommand>): Promise<Command | undefined> {
    const existingCommand = this.commands.get(id);
    if (!existingCommand) return undefined;
    
    const updatedCommand = { ...existingCommand, ...command };
    this.commands.set(id, updatedCommand);
    return updatedCommand;
  }
  
  async deleteCommand(id: number): Promise<boolean> {
    return this.commands.delete(id);
  }
  
  // Logs methods
  async getLogs(limit?: number): Promise<Log[]> {
    const sortedLogs = [...this.logs].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return limit ? sortedLogs.slice(0, limit) : sortedLogs;
  }
  
  async createLog(log: InsertLog): Promise<Log> {
    const id = this.logsIdCounter++;
    const newLog: Log = { 
      id, 
      ...log, 
      timestamp: new Date() 
    };
    this.logs.push(newLog);
    return newLog;
  }
  
  // Bot Stats methods
  async getBotStats(): Promise<BotStat | undefined> {
    return this.botStats;
  }
  
  async updateBotStats(stats: InsertBotStat): Promise<BotStat> {
    const id = 1;
    this.botStats = { id, ...stats };
    return this.botStats;
  }
}

export const storage = new MemStorage();
      
