import { Bot, InlineKeyboard } from "grammy";

if (!process.env.BOT_API_KEY) {
	console.error("environment misconfigured");
}

const bot = new Bot(process.env.BOT_API_KEY!);

const keyboard = new InlineKeyboard().game("Join session!");

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

bot.command("game", async (ctx) => {
	await ctx.replyWithGame(process.env.WORD_HUNT_SHORTNAME as string, { reply_markup: keyboard });
});

bot.on("message", (ctx) => ctx.reply("Got another message!"));

bot.on("callback_query:game_short_name", async (ctx) => {
	if (ctx.callbackQuery.from.is_bot) {
		// Silly bot, games are for users!
		return;
	}

	console.log(ctx.callbackQuery);
	

	const messageId = ctx.callbackQuery.message
		? ctx.callbackQuery.message.message_id
		: -1;

	await ctx.answerCallbackQuery({
		url: `${process.env.SERVER_URL}/join-game/${ctx.callbackQuery.chat_instance}/${messageId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`,
	});
});

export default function startBot() {
	bot.start();
}
