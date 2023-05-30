import { FastifyInstance, FastifyReply } from "fastify";
import { Api, InlineKeyboard } from "grammy";
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
			if (gameSession.players[userId].score) {
				fastify.log.error(`User ${userId} already submitted a score of ${gameSession.players[userId]}.`);
				return reply.status(500).send();
			}
			if (score < 0) {
				fastify.log.error(`Score of ${score} is less than 0.`);
				return reply.status(500).send();
			}

			gameSession.turnCount++;

			handleNewScore(gameSession, userId, score).catch(console.error);

			gameSession.players[userId].score = score;

			updateInlineKeyboard(gameSession);

			// set game-specific values here
			switch (gameSession.game) {
				case Game.WORD_HUNT:
					gameSession.players[userId].words = body.words;
					break;
			}

			if (gameSession.turnCount == TURN_MAX[gameSession.game]) {
				endSession(sessionId);
			}

			reply.status(200).send();
		}
	);

	done();
};

function updateInlineKeyboard(gameSession: GameSession) {
	const inlineKeyboard = new InlineKeyboard().game(GAME_START_BUTTON_TEXT).row();
	Object.values(gameSession.players).forEach((player, idx) => {
		inlineKeyboard.text(`${player.name}: ${player.score ?? "DNF"}`);
		if (idx % 2 == 1) inlineKeyboard.row();
	});

	if (gameSession.inlineId) {
		bot.api.editMessageReplyMarkupInline(gameSession.inlineId, { reply_markup: inlineKeyboard });
	} else if (gameSession.chatId && gameSession.messageId) {
		bot.api.editMessageReplyMarkup(gameSession.chatId, parseInt(gameSession.messageId), {
			reply_markup: inlineKeyboard,
		});
	} else {
		fastify.log.error(`updateInlineKeyboard: game session doesn't have an associated message`);
	}
}

async function handleNewScore(gameSession: GameSession, scoringPlayerId: string, newScore: number) {
	const botApi = new Api(process.env.BOT_API_KEY!);

	const oldScoredPlayers = Object.entries(gameSession.players)
		.filter((scoredPlayer) => scoredPlayer[1].score != undefined)
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
