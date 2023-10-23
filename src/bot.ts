import { Bot, GrammyError, InlineKeyboard } from "grammy";
import { GAME_LIST, GAME_START_BUTTON_TEXT } from "./constants";
import { decrementGameScore, incrementGameScore, setGameScore } from "./server/utils";
import { fastify, GameSession } from "./server/server";
import { Game } from "./constants"

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

bot.command("reset", async (ctx) => {
	if (process.env.NODE_ENV !== "development") {
		fastify.log.warn(`User "${ctx.msg.from}" tried to use "reset"!`);
		return;
	}

	const repliedMsgId = ctx.msg.reply_to_message?.message_id;
	if (!repliedMsgId) {
		ctx.reply("Please reply to a valid game message!");
		return;
	}

	const spoofSession: GameSession = {
		game: Game.WORD_HUNT,	
		turnCount: 0,
		messageId: repliedMsgId.toString(),
		chatId: ctx.chat.id.toString(),
		players: {},
		winnerIds: [],
		done: true
	}

	setGameScore(spoofSession, bot.api, ctx.msg.from!.id.toString(), 0, true);

	await ctx.reply("reset youre score to 0!");
});

bot.command("dec", async (ctx) => {
	if (process.env.NODE_ENV !== "development") {
		fastify.log.warn(`User "${ctx.msg.from}" tried to use "dec"!`);
		return;
	}

	const repliedMsgId = ctx.msg.reply_to_message?.message_id;
	if (!repliedMsgId) {
		ctx.reply("Please reply to a valid game message!");
		return;
	}

	const spoofSession: GameSession = {
		game: Game.WORD_HUNT,	
		turnCount: 0,
		messageId: repliedMsgId.toString(),
		chatId: ctx.chat.id.toString(),
		players: {},
		winnerIds: [],
		done: true
	}

	await decrementGameScore(spoofSession, bot.api, ctx.msg.from!.id.toString());

	await ctx.reply("decremented your score!");
});

bot.command("inc", async (ctx) => {
	if (process.env.NODE_ENV !== "development") {
		fastify.log.warn(`User "${ctx.msg.from}" tried to use "inc"!`);
		return;
	}

	const repliedMsgId = ctx.msg.reply_to_message?.message_id;
	if (!repliedMsgId) {
		ctx.reply("please reply to a valid game message!");
		return;
	}

	const spoofSession: GameSession = {
		game: Game.WORD_HUNT,	
		turnCount: 0,
		messageId: repliedMsgId.toString(),
		chatId: ctx.chat.id.toString(),
		players: {},
		winnerIds: [],
		done: true
	}

	await incrementGameScore(spoofSession, bot.api, ctx.msg.from!.id.toString());

	await ctx.reply("incremented your score!");
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
	const query = ctx.inlineQuery.query;
	ctx.answerInlineQuery(
		searchGames(query).map((shortName, idx) => {
			return {
				type: "game",
				id: idx.toString(),
				game_short_name: shortName,
				reply_markup: startingInlineKeyboard
			};
		})
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
			(game) => game.shortName
		);
	}
}

export default function startBot() {
	if (process.env.NODE_ENV === "development") {
		bot.start();
		console.log("Bot started polling-mode");
	}
}
