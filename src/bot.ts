import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";

if (!process.env.BOT_API_KEY) {
	console.error("environment misconfigured");
}

const bot = new Bot(process.env.BOT_API_KEY!);

const keyboard = new InlineKeyboard().game("Join session!");

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

bot.command("game", async (ctx) => {
	await ctx.replyWithGame("WordHunt", { reply_markup: keyboard });
});

bot.on("message", (ctx) => ctx.reply("Got another message!"));

bot.on("callback_query:game_short_name", async (ctx) => {
	const messageId = ctx.callbackQuery.message
		? ctx.callbackQuery.message.message_id
		: -1;
	const sessionId = await ctx.answerCallbackQuery({
		url: `http://127.0.0.1:3000/join-game/${ctx.callbackQuery.chat_instance}/${messageId}`,
	});
});

export default function startBot() {
	bot.start();
}
