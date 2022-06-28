import { randomUUID } from "crypto";
import { FastifyInstance, FastifyReply } from "fastify";
import { Api, GrammyError, RawApi } from "grammy";
import { Server, IncomingMessage, ServerResponse } from "http";
import httpError from "http-errors";
import { Game, GameURL, PlayerMax, TurnMax } from "./constants";
import { GameSession, gameSessions } from "./server";
import { endSession, hashTgCallback } from "./utils";
import who from "./word-hunt/main";

export default (
	fastify: FastifyInstance,
	opts: any,
	done: (err?: Error | undefined) => void
) => {
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

	fastify.post<{
		Params: { sessionId: string; userId: string };
	}>("/result/:sessionId/:userId", async (req, res) => {
		const { sessionId, userId } = req.params;

		if (!sessionId || !userId) {
			fastify.log.error(
				`Invalid URL params, sessionId: ${sessionId}, userId: ${userId}.`
			);
			return;
		}
		const gameSession = gameSessions[sessionId];
		const body: any = JSON.parse(req.body as string);
		const score: number = body.score;

		if (!gameSession) {
			fastify.log.error(`Session with ID ${sessionId} does not exist.`);
			return;
		}
		if (!gameSession.scoredUsers[userId]) {
			fastify.log.error(`User ${userId} did not join this game.`);
			return;
		}
		if (gameSession.scoredUsers[userId].score) {
			fastify.log.error(
				`User ${userId} already submitted a score of ${gameSession.scoredUsers[userId]}.`
			);
			return;
		}
		if (score < 0) {
			fastify.log.error(`Score of ${score} is less than 0.`);
			return;
		}

		gameSession.turnCount++;
		gameSession.scoredUsers[userId].score = score;
		const api = new Api(process.env.BOT_API_KEY!);

		const scoreEntries = Object.entries(gameSession.scoredUsers);
		// figure out a winner/new winner
		if (scoreEntries.length > 2) {
			// there are more than 2 players now, so need to rebalance scores
			scoreEntries.sort(
				(a, b) =>
					(a[1].score ?? Number.MIN_SAFE_INTEGER) -
					(b[1].score ?? Number.MIN_SAFE_INTEGER)
			);
			const winner = scoreEntries[0];
			if (winner[0] == userId) {
				const oldWinner = scoreEntries[1];
				const oldWinnerGameScore = (
					await getGameScore(gameSession, api, oldWinner[0])
				)?.find(
					(gameScore) => gameScore.user.id.toString() === oldWinner[0]
				);
				const newWinnerGameScore = (
					await getGameScore(gameSession, api, winner[0])
				)?.find(
					(gameScore) => gameScore.user.id.toString() === winner[0]
				);
				if (oldWinnerGameScore) {
					// there was an old winner, so take away from them and give to new winner
					setGameScore(
						gameSession,
						api,
						oldWinner[0],
						oldWinnerGameScore.score - 1,
						true
					);
					setGameScore(
						gameSession,
						api,
						winner[0],
						newWinnerGameScore ? newWinnerGameScore.score + 1 : 1,
						true
					);
				} else {
					console.error(
						"Old winner has never won, which should be impossible..."
					);
				}
			}
		} else if (scoreEntries.length > 1) {
			// only two players, just get the winner

			// make sure both players finished
			if (scoreEntries.every((entry) => entry[1].score)) {
				scoreEntries.sort(
					(a, b) =>
						(a[1].score ?? Number.MIN_SAFE_INTEGER) -
						(b[1].score ?? Number.MIN_SAFE_INTEGER)
				);

				const winner = scoreEntries[0];
				if (winner[1].score) {
					const winnerGameScore = (
						await getGameScore(gameSession, api, winner[0])
					)?.find(
						(gameScore) =>
							gameScore.user.id.toString() === winner[0]
					);
					setGameScore(
						gameSession,
						api,
						winner[0],
						winnerGameScore ? winnerGameScore.score + 1 : 1,
						true
					);
				}
			}
		}

		// set game-specific values here
		switch (gameSession.game) {
			case Game.WORD_HUNT:
				gameSession.scoredUsers[userId].words = body.words;
				break;
		}

		if (gameSession.turnCount == TurnMax[gameSession.game]) {
			endSession(sessionId);
		}
	});

	done();
};

function setGameScore(
	gameSession: GameSession,
	api: Api<RawApi>,
	userId: string,
	score: number,
	force: boolean = false
) {
	if (gameSession.inlineId) {
		api.setGameScoreInline(gameSession.inlineId, parseInt(userId), score, {
			force,
		}).catch(handleScoreUpdateErr);
	} else if (gameSession.chatId && gameSession.messageId) {
		api.setGameScore(
			parseInt(gameSession.chatId),
			parseInt(gameSession.messageId),
			parseInt(userId),
			score,
			{ force }
		).catch(handleScoreUpdateErr);
	}
}

async function getGameScore(
	gameSession: GameSession,
	api: Api<RawApi>,
	userId: string
) {
	try {
		if (gameSession.inlineId) {
			return await api.getGameHighScoresInline(
				gameSession.inlineId,
				parseInt(userId)
			);
		} else if (gameSession.chatId && gameSession.messageId) {
			return await api.getGameHighScores(
				parseInt(gameSession.chatId),
				parseInt(gameSession.messageId),
				parseInt(userId)
			);
		}
	} catch (err) {
		console.error(err);
	}
}

async function handleJoinSession(
	sessionId: string,
	chatInfo: ChatInfo,
	userId: string,
	userName: string,
	res: FastifyReply<Server, IncomingMessage, ServerResponse, any, unknown>
) {
	if (!gameSessions[sessionId]) {
		// TODO: Start a wordhunt game by default; will need a way to specify the game later
		await startSession(Game.WORD_HUNT, chatInfo, sessionId);
	}

	const session = gameSessions[sessionId];
	// NOTE: this probably isn't a race condition? Node is single-threaded right?
	if (
		!session.scoredUsers[userId] &&
		session.playerCount < PlayerMax[session.game]
	) {
		const session = gameSessions[sessionId];
		session.playerCount++;
		session.scoredUsers[userId] = {
			words: [],
			name: userName,
		};

		switch (gameSessions[sessionId].game) {
			case Game.WORD_HUNT:
				res.redirect(
					`${
						GameURL[Game.WORD_HUNT]
					}?session=${sessionId}&user=${userId}`
				);
				break;
		}
	} else {
		// game is full, go into spectator mode
		switch (gameSessions[sessionId].game) {
			case Game.WORD_HUNT:
				res.redirect(
					`${
						GameURL[Game.WORD_HUNT]
					}?session=${sessionId}&user=${userId}&spectate=true`
				);
				break;
		}
		// TODO: implement spectator mode
	}
}

/**
 *
 * @param game The game to join a session of
 * @param uid The ID to be used for the session
 * @returns The ID used for the session
 */
async function startSession(game: Game, chatInfo: ChatInfo, uid?: string) {
	const gameId = uid ? uid : randomUUID();
	gameSessions[gameId] = {
		chatId: chatInfo.chatId,
		messageId: chatInfo.messageId,
		inlineId: chatInfo.inlineId,
		game,
		playerCount: 0,
		turnCount: 0,
		scoredUsers: {},
		done: false,
	};
	switch (game) {
		case Game.WORD_HUNT:
			gameSessions[gameId].board = await who.getBoardWithSolutions();
			break;
	}
	return gameId;
}

function handleScoreUpdateErr(err: GrammyError) {
	if (err.description.includes("BOT_SCORE_NOT_MODIFIED")) {
		console.warn("Score not modified");
	} else {
		console.error(err);
	}
}
