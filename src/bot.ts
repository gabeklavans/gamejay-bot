import "dotenv/config";
import { Bot } from "grammy";

if (!process.env.BOT_API_KEY) {
	console.error("environment misconfigured");
}

const bot = new Bot(process.env.BOT_API_KEY!);

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

bot.on("message", (ctx) => ctx.reply("Got another message!"));

export default function startBot() {
	bot.start();
}
