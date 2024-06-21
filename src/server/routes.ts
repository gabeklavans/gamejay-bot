import { FastifyInstance, FastifyReply } from "fastify";
import { Api, GrammyError, InlineKeyboard } from "grammy";
import httpError from "http-errors";
import { bot } from "../bot";
import { GAME_START_BUTTON_TEXT, Game, TURN_MAX } from "../constants";
import { GameSession, fastify, gameSessions } from "./server";
import {
	decrementGameScore,
	endSession,
	handleJoinSession,
	handlePlayerStart,
	hashTgCallback,
	incrementGameScore,
} from "./utils";

export default (fastify: FastifyInstance, opts: any, done: (err?: Error | undefined) => void) => {
	fastify.get<{
		Params: {
			inlineId: string;
			userId: string;
			userName: string;
		};
	}>("/join-game/:inlineId/:userId/:userName", async (req, reply) => {
		const { inlineId, userId, userName } = req.params;
		if (!userId) {
			fastify.log.error(`Invalid URL params, userId: ${userId}.`);
			reply.send(httpError.BadRequest);
			return;
		}

		const sessionId = hashTgCallback("pingas", inlineId);
		const chatInfo = { inlineId };

		await handleJoinSession(sessionId, chatInfo, userId, userName, reply);
	});

	fastify.get<{
		Params: {
			chatId: string;
			messageId: string;
			userId: string;
			userName: string;
		};
	}>("/join-game/:chatId/:messageId/:userId/:userName", async (req, reply) => {
		const { chatId, messageId, userId, userName } = req.params;
		if (!userId) {
			fastify.log.error(`Invalid URL params, userId: ${userId}.`);
			reply.send(httpError.BadRequest);
			return;
		}

		const sessionId = hashTgCallback(chatId, messageId);
		const chatInfo = { chatId, messageId };

		await handleJoinSession(sessionId, chatInfo, userId, userName, reply);
	});

	fastify.patch<{
		Params: {
			sessionId: string;
			userId: string;
		};
	}>("/start-game/:sessionId/:userId", async (req, reply) => {
		const { sessionId, userId } = req.params;

		const success = handlePlayerStart(sessionId, userId);

		reply.status(success ? 200 : 500).send();
	});

	fastify.post<{
		Params: { sessionId: string; userId: string };
	}>(
		"/result/:sessionId/:userId",
		{
			schema: {
				params: {
					type: "object",
					properties: {
						sessionId: { type: "string" },
						userId: { type: "number" },
					},
				},
				body: {
					type: "object",
					properties: {
						partial: { type: "boolean" }, // support for mid-turn updates
						score: { type: "number" },
						words: { type: "array", items: { type: "string" } },
					},
				},
			},
		},
		(req, reply) => {
			const { sessionId, userId } = req.params;

			if (!sessionId || !userId) {
				fastify.log.error(`Invalid URL params, sessionId: ${sessionId}, userId: ${userId}.`);
				return;
			}
			const gameSession = gameSessions[sessionId];
			const body = req.body as ResultsBody;
			const score: number = body.score;

			if (!gameSession) {
				fastify.log.error(`Session with ID ${sessionId} does not exist.`);
				return reply.status(500).send();
			}
			if (!gameSession.players[userId]) {
				fastify.log.error(`User ${userId} did not join this game.`);
				return reply.status(500).send();
			}

			const player = gameSession.players[userId];

			if (player.done) {
				fastify.log.error(`User ${userId} already submitted a final score of ${player}.`);
				return reply.status(500).send();
			}
			if (score < 0) {
				fastify.log.error(`Score of ${score} is less than 0.`);
				return reply.status(500).send();
			}

			player.score = score;

			if (!body.partial) {
				handleNewScore(gameSession, userId, score).catch(console.error);
				player.done = true;
			}

			updateInlineKeyboard(gameSession);

			// perform game-specific actions here
			// this includes turn-increment logic
			switch (gameSession.game) {
				case Game.WORD_HUNT:
					player.words = body.words;
					break;
			}

			if (gameSession.turnCount == TURN_MAX[gameSession.game]) {
				endSession(sessionId);
			}

			reply.status(200).send();
		},
	);

	done();
};

function updateInlineKeyboard(gameSession: GameSession) {
	const inlineKeyboard = new InlineKeyboard().game(GAME_START_BUTTON_TEXT).row();
	Object.values(gameSession.players)
		// sort in descending score order
		.sort((b, a) => {
			if ((!a.done && !b.done) || (!a.score && !b.score)) {
				return 0;
			} else if (!b.done || !b.score) {
				return 1;
			} else if (!a.done || !a.score) {
				return -1;
			} else {
				return a.score - b.score;
			}
		})
		// only show top 8, everyone else needs to train harder
		.slice(0, 8)
		.forEach((player, idx) => {
			let inlineText = `${player.done ? idx + 1 : ".."}. ${player.name}`;
			if (idx === 0 && Object.values(gameSession.players).filter((p) => p.done).length >= 2) {
				inlineText += " 🏆";
			}
			inlineKeyboard.text(inlineText);
			if (idx % 2 == 1) inlineKeyboard.row();
		});

	function handleEditErr(err: GrammyError) {
		if (err.description.includes("exactly the same")) {
			fastify.log.debug("inline button unchanged");
		} else {
			fastify.log.error(err);
		}
	}

	if (gameSession.inlineId) {
		bot.api
			.editMessageReplyMarkupInline(gameSession.inlineId, { reply_markup: inlineKeyboard })
			.catch(handleEditErr);
	} else if (gameSession.chatId && gameSession.messageId) {
		bot.api
			.editMessageReplyMarkup(gameSession.chatId, parseInt(gameSession.messageId), {
				reply_markup: inlineKeyboard,
			})
			.catch(handleEditErr);
	} else {
		fastify.log.error(`updateInlineKeyboard: game session doesn't have an associated message`);
	}
}

async function handleNewScore(gameSession: GameSession, scoringPlayerId: string, newScore: number) {
	const botApi = new Api(process.env.BOT_API_KEY!);

	const oldScoredPlayers = Object.entries(gameSession.players)
		.filter((scoredPlayer) => scoredPlayer[1].done)
		.map((scoredPlayer) => {
			return {
				id: scoredPlayer[0],
				score: scoredPlayer[1].score as number,
			};
		});

	if (oldScoredPlayers.length < 1) {
		fastify.log.info("Not enough scored players to determine winner");
		return;
	}

	// handle this edge-case up front to make the rest of the logic work
	if (oldScoredPlayers.length == 1 && oldScoredPlayers[0].score >= newScore) {
		fastify.log.info(`First scoring player ${oldScoredPlayers[0].id} won`);

		gameSession.winnerIds = [oldScoredPlayers[0].id];
		await incrementGameScore(gameSession, botApi, oldScoredPlayers[0].id);
	}

	const oldHighScore = Math.max(...oldScoredPlayers.map((scoredPlayer) => scoredPlayer.score as number));

	if (newScore == oldHighScore) {
		fastify.log.info(`Player ${scoringPlayerId} tied with [${gameSession.winnerIds}]`);

		gameSession.winnerIds.push(scoringPlayerId);
		await incrementGameScore(gameSession, botApi, scoringPlayerId);
	} else if (newScore > oldHighScore) {
		fastify.log.info(`Player ${scoringPlayerId} beat old score of ${oldHighScore} with ${newScore}`);

		for (const oldWinnerId of gameSession.winnerIds) {
			await decrementGameScore(gameSession, botApi, oldWinnerId);
		}

		gameSession.winnerIds = [scoringPlayerId];

		await incrementGameScore(gameSession, botApi, scoringPlayerId);
	}
}
