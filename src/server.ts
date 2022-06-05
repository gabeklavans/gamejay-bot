import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import httpError from "http-errors";
import whoRoutes from "./word-hunt/routes";
import { createHash, randomUUID } from "crypto";
import { DEFAULT_SCORE, Game, GameURL, PlayerMax, TurnMax } from "./constants";

import who from "./word-hunt/main";

const fastify = Fastify({
	logger: { level: "debug" },
});
fastify.register(fastifyCors, {
	origin: true,
});
fastify.register(disableCache);

// register game routes
fastify.register(whoRoutes, { prefix: "/who" });

fastify.get<{
	Params: {
		chatId: string;
		messageId: string;
		userId: string;
	};
}>("/join-game/:chatId/:messageId/:userId", async (req, res) => {
	const { chatId, messageId, userId } = req.params;
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
		!session.scores[userId] &&
		session.playerCount < PlayerMax[session.game]
	) {
		const session = gameSessions[sessionId];
		session.playerCount++;
		session.scores[userId] = {
			score: DEFAULT_SCORE,
			words: [],
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
	const session = gameSessions[sessionId];
	const body: any = JSON.parse(req.body as string);
	const score: number = body.score;

	if (!session) {
		fastify.log.error(`Session with ID ${sessionId} does not exist.`);
		return;
	}
	if (!session.scores[userId]) {
		fastify.log.error(`User ${userId} did not join this game.`);
		return;
	}
	if (session.scores[userId].score !== DEFAULT_SCORE) {
		fastify.log.error(
			`User ${userId} already submitted a score of ${session.scores[userId]}.`
		);
		return;
	}
	if (score < 0) {
		fastify.log.error(`Score of ${score} is less than 0.`);
		return;
	}

	session.turnCount++;
	session.scores[userId].score = score;

	// set game-specific values here
	switch (session.game) {
		case Game.WORD_HUNT:
			session.scores[userId].words = body.words;
			break;
	}

	if (session.turnCount == TurnMax[session.game]) {
		// TODO: report the winner to telegram
		// TODO: Save session to database so we don't have to keep it in memory...
		session.done = true;
		fastify.log.debug(`Game ${sessionId} over. Saving to database...`);
		// I want this ^ so ppl can go to their games and see things like the scores and potential words (in word hunt)
	}
});

export default async function startServer() {
	await who.init();

	fastify.listen(3000, (err) => {
		if (err) {
			fastify.log.error(err);
			process.exit(1);
		}
	});
}

export const gameSessions: {
	[key: string]: {
		game: Game;
		board?: Board;
		playerCount: number;
		turnCount: number;
		scores: { [key: string]: { score: number; words?: string[] } };
		done: boolean;
	};
} = {};

/**
 *
 * @param game The game to join a session of
 * @param uid The ID to be used for the session
 * @returns The ID used for the session
 */
export async function startSession(game: Game, uid?: string) {
	const gameId = uid ? uid : randomUUID();
	gameSessions[gameId] = {
		game,
		playerCount: 0,
		turnCount: 0,
		scores: {},
		done: false,
	};
	switch (game) {
		case Game.WORD_HUNT:
			gameSessions[gameId].board = await who.getBoardWithSolutions();
			break;
	}
	return gameId;
}

function hashTgCallback(chatId: string, messageId: string) {
	const hash = createHash("sha1");
	hash.update(chatId);
	hash.update(messageId);
	return hash.digest().toString("base64url");
}
