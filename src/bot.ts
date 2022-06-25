import { Api, Bot, InlineKeyboard } from "grammy";

if (!process.env.BOT_API_KEY) {
	console.error("environment misconfigured");
}

const bot = new Bot(process.env.BOT_API_KEY!);

const keyboard = new InlineKeyboard().game("Join session!");

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

bot.command("game", async (ctx) => {
	await ctx.replyWithGame(process.env.WORD_HUNT_SHORTNAME as string, {
		reply_markup: keyboard,
	});
});

bot.on("callback_query:game_short_name", async (ctx) => {
	if (ctx.callbackQuery.from.is_bot) {
		// Silly bot, games are for users!
		return;
	}

	console.log(ctx.callbackQuery);

	let chatId;
	let messageId;
	let isInline = false;

	if (ctx.callbackQuery.message) {
		chatId = ctx.callbackQuery.message.chat.id;
		messageId = ctx.callbackQuery.message.message_id;
	}
	if (ctx.callbackQuery.inline_message_id) {
		chatId = ctx.callbackQuery.chat_instance;
		messageId = ctx.callbackQuery.inline_message_id;
		isInline = true;
	} else {
		await ctx.answerCallbackQuery({
			text: `This game has gone missing... Try creating a new game request.`,
			show_alert: true,
		});
		return;
	}

	await ctx.answerCallbackQuery({
		url: `${process.env.SERVER_URL}/join-game/${chatId}/${messageId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}/${isInline}`,
	});
});

bot.on("inline_query", (ctx) => {
	ctx.answerInlineQuery([
		{
			type: "game",
			id: "1",
			game_short_name: "who",
		},
	]);
});

export default function startBot() {
	bot.start();
}
