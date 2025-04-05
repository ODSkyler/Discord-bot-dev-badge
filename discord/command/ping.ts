import { CommandInteraction } from "discord.js";
import { IDiscordCommand } from "@shared/schema";

export const name = "ping";
export const description = "Checks the bot's response time and health status.";

export const execute = async (interaction: CommandInteraction): Promise<void> => {
  const sent = await interaction.reply({ content: "Pinging...", fetchReply: true });
  
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = interaction.client.ws.ping;
  
  await interaction.editReply(`Pong! 🏓\nBot latency: ${latency}ms\nAPI latency: ${apiLatency}ms`);
};
