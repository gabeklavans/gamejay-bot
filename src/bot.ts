import { Bot, GrammyError, InlineKeyboard } from "grammy";
import { GAME_LIST, GAME_START_BUTTON_TEXT } from "./constants";
import { getSessionId, throwIfSessionExpired } from "./server/utils";
import { SessionExpiredError } from "./server/errors";

if (!process.env.BOT_API_KEY) {
	console.error("environment misconfigured");
}

if (process.env.BOT_API_KEY == null) throw Error("Telegram bot API token is missing.");
export const bot = new Bot(process.env.BOT_API_KEY!);

const startingInlineKeyboard = new InlineKeyboard().game(GAME_START_BUTTON_TEXT);

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

bot.command("game", async (ctx) => {
	await ctx.replyWithGame(process.env.WORD_HUNT_SHORTNAME as string, {
		reply_markup: startingInlineKeyboard,
	});
});

bot.on("callback_query:game_short_name", async (ctx) => {
	if (ctx.callbackQuery.from.is_bot) {
		// Silly bot, games are for users!
		return;
	}

	console.log("User starting a game...");
	console.log(ctx.callbackQuery.from);

	try {
		if (ctx.callbackQuery.message) {
			const chatId = ctx.callbackQuery.message.chat.id;
			const messageId = ctx.callbackQuery.message.message_id;
			const sessionId = getSessionId(messageId.toString(), chatId.toString());
			throwIfSessionExpired(sessionId);
			const url = `${process.env.SERVER_URL}/join-game/${chatId}/${messageId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`;
			await ctx.answerCallbackQuery({ url });
		}
		if (ctx.callbackQuery.inline_message_id) {
			const inlineId = ctx.callbackQuery.inline_message_id;
			const sessionId = getSessionId(inlineId.toString());
			throwIfSessionExpired(sessionId);
			const url = `${process.env.SERVER_URL}/join-game/${inlineId}/${ctx.callbackQuery.from.id}/${ctx.callbackQuery.from.first_name}`;
			await ctx.answerCallbackQuery({ url });
		} else {
			await ctx.answerCallbackQuery({
				text: `This game has gone missing... Try starting a new one!.`,
				show_alert: true,
			});
		}
	} catch (err) {
		if (err instanceof SessionExpiredError) {
			return await ctx.answerCallbackQuery({
				text: "This game has expired. Try starting a new one!",
				show_alert: true,
			});
		}

		console.error(err);

		ctx.answerCallbackQuery({
			text: `Something went wrong...`,
		}).catch((err: GrammyError) => {
			console.error(err);
		});
	}
});

// Use the default callback handler to just display its text data.
// So far, it just displays the score of the player whose button was clicked.
bot.on("callback_query:data", (ctx) => {
	ctx.answerCallbackQuery({
		text: ctx.callbackQuery.data,
		cache_time: 24 * 60 * 60, // 1 day
	});
});

bot.on("inline_query", (ctx) => {
	const query = ctx.inlineQuery.query;
	ctx.answerInlineQuery(
		searchGames(query).map((shortName, idx) => {
			return {
				type: "game",
				id: idx.toString(),
				game_short_name: shortName,
				reply_markup: startingInlineKeyboard,
			};
		}),
	).catch(console.error);
});

export function sendMsg(msg: string, chatId: string, replyMsgId?: number): void {
	bot.api.sendMessage(chatId, msg, { reply_to_message_id: replyMsgId });
}

function searchGames(query?: string) {
	if (!query) {
		return GAME_LIST.map((game) => game.shortName);
	} else {
		return GAME_LIST.filter((game) => game.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(
			(game) => game.shortName,
		);
	}
}

export default function startBot() {
	if (process.env.USE_WEBHOOK !== "True") {
		bot.start();
		console.log("Bot started polling-mode");
	}
}
