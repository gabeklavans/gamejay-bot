import "dotenv/config";
import { Bot } from "grammy";

if (!process.env.BOT_API_KEY) {
	console.error("environment misconfigured");
}

const bot = new Bot(process.env.BOT_API_KEY!);

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

bot.command("game", async (ctx) => {
	await ctx.replyWithGame("WordHunt");
});

bot.on("message", (ctx) => ctx.reply("Got another message!"));

bot.on("callback_query:game_short_name", async (ctx) => {
	await ctx.answerCallbackQuery({ url: "http://192.168.0.42:8081" });
});

export default function startBot() {
	bot.start();
}
