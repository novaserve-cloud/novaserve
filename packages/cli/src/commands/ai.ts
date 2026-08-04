import { Command } from "commander";
import { logger } from "../utils/logger.js";
import { ConfigParser } from "@novaserve/core";
import readline from "readline";

export const aiCommand = () => {
  return new Command("ai")
    .description("Launch the NovaServe AI assistant")
    .action(async () => {
      logger.info("Starting Nova AI Assistant...");
      
      const apiKey = process.env.NOVA_AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        logger.warn("No AI API key found. Please set NOVA_AI_API_KEY.");
        logger.info("Running in demo/offline mode.");
      }

      try {
        const parser = new ConfigParser(process.cwd());
        const app = await parser.load();
        
        logger.success(`Loaded context for app: ${app.name} (${app.resources.length} resources)`);
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
          prompt: '\\x1b[36m✨ nova-ai > \\x1b[0m'
        });

        console.log("\\nType 'exit' or 'quit' to leave.\\n");
        rl.prompt();

        rl.on('line', (line) => {
          const input = line.trim();
          if (input === 'exit' || input === 'quit') {
            rl.close();
            return;
          }

          if (input.length > 0) {
            console.log(`\\n\\x1b[32mNova AI:\\x1b[0m I see you have ${app.resources.length} resources. based on your config, I recommend checking out the dashboard to visualize your topology.`);
            console.log(`I can help you add a new API route or database if you'd like.\\n`);
          }
          rl.prompt();
        }).on('close', () => {
          logger.info("Nova AI session ended.");
          process.exit(0);
        });
        
      } catch (error) {
        logger.error(`Failed to initialize AI context: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
};
