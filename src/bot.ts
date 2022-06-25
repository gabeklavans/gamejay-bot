import { Api, Bot, GrammyError, InlineKeyboard } from "grammy";

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

	try {
		if (ctx.callbackQuery.message) {
			const chatId = ctx.callbackQuery.message.chat.id;
			const messageId = ctx.callbackQuery.message.message_id;
			await ctx.answerCallbackQuery({
				url: `${process.env.SERVER_URL}/join-game/${chatId}/${messageId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`,
			});
		}
		if (ctx.callbackQuery.inline_message_id) {
			const inlineId = ctx.callbackQuery.inline_message_id;
			await ctx.answerCallbackQuery({
				url: `${process.env.SERVER_URL}/join-game/${inlineId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`,
			});
		} else {
			await ctx.answerCallbackQuery({
				text: `This game has gone missing... Try creating a new game request.`,
				show_alert: true,
			});
		}
	} catch (err) {
		console.error(err);
		ctx.answerCallbackQuery({
			text: `Something went wrong...`,
		}).catch((err: GrammyError) => {
			console.error(err);
		});
	}
});

bot.on("inline_query", (ctx) => {
	ctx.answerInlineQuery([
		{
			type: "game",
			id: "1",
			game_short_name: "who",
		},
	]).catch(console.error);
});

export default function startBot() {
	bot.start();
}
