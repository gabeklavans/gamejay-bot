import { FastifyInstance, FastifyReply } from "fastify";
import { Api } from "grammy";
import httpError from "http-errors";
import { sendMsg } from "../bot";
import { Game, TURN_MAX } from "../constants";
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
	}>("/join-game/:inlineId/:userId/:userName", async (req, res) => {
		const { inlineId, userId, userName } = req.params;
		if (!userId) {
			fastify.log.error(`Invalid URL params, userId: ${userId}.`);
			res.send(httpError.BadRequest);
			return;
		}

		const sessionId = hashTgCallback("pingas", inlineId);
		const chatInfo = { inlineId };

		await handleJoinSession(sessionId, chatInfo, userId, userName, res);
	});

	fastify.get<{
		Params: {
			chatId: string;
			messageId: string;
			userId: string;
			userName: string;
		};
	}>("/join-game/:chatId/:messageId/:userId/:userName", async (req, res) => {
		const { chatId, messageId, userId, userName } = req.params;
		if (!userId) {
			fastify.log.error(`Invalid URL params, userId: ${userId}.`);
			res.send(httpError.BadRequest);
			return;
		}

		const sessionId = hashTgCallback(chatId, messageId);
		const chatInfo = { chatId, messageId };

		await handleJoinSession(sessionId, chatInfo, userId, userName, res);
	});

	fastify.patch<{
		Params: {
			sessionId: string;
			userId: string;
		};
	}>("/start-game/:sessionId/:userId", async (req, res) => {
		const { sessionId, userId } = req.params;

		handlePlayerStart(sessionId, userId);
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
		(req) => {
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
				return;
			}
			if (!gameSession.players[userId]) {
				fastify.log.error(`User ${userId} did not join this game.`);
				return;
			}
			if (gameSession.players[userId].score) {
				fastify.log.error(`User ${userId} already submitted a score of ${gameSession.players[userId]}.`);
				return;
			}
			if (score < 0) {
				fastify.log.error(`Score of ${score} is less than 0.`);
				return;
			}

			gameSession.turnCount++;

			handleNewScore(gameSession, userId, score).catch(console.error);

			gameSession.players[userId].score = score;

			// set game-specific values here
			switch (gameSession.game) {
				case Game.WORD_HUNT:
					gameSession.players[userId].words = body.words;
					break;
			}

			if (gameSession.turnCount == TURN_MAX[gameSession.game]) {
				endSession(sessionId);
			}
		}
	);

	done();
};

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
