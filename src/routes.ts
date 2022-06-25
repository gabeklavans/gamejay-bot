import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import httpError from "http-errors";
import { Game, GameURL, PlayerMax, TurnMax } from "./constants";
import { gameSessions } from "./server";
import { endSession, hashTgCallback } from "./utils";
import who from "./word-hunt/main";

export default (
	fastify: FastifyInstance,
	opts: any,
	done: (err?: Error | undefined) => void
) => {
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

		if (!gameSessions[sessionId]) {
			// TODO: Start a wordhunt game by default; will need a way to specify the game later
			await startSession(Game.WORD_HUNT, sessionId);
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
	});

	fastify.post<{
		Params: { sessionId: string; userId: string };
	}>("/result/:sessionId/:userId", (req, res) => {
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

/**
 *
 * @param game The game to join a session of
 * @param uid The ID to be used for the session
 * @returns The ID used for the session
 */
async function startSession(game: Game, uid?: string) {
	const gameId = uid ? uid : randomUUID();
	gameSessions[gameId] = {
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
