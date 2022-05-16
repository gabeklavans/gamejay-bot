import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import httpError from "http-errors";
import whoRoutes from "./word-hunt/routes";
import { createHash, randomUUID } from "crypto";
import { DEFAULT_SCORE, Game, GameURL, PlayerMax } from "./constants";

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
	Params: JoinParams;
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
		session.scores[userId] = DEFAULT_SCORE;

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
		// TODO: replace with selected game
		res.send(`You have entered spectator mode for ${Game[Game.WORD_HUNT]}`);
		// TODO: implement spectator mode
	}
});

export default async function startServer() {
	await who.init();

	fastify.listen(3000, "127.0.0.1", (err) => {
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
		scores: { [key: string]: number };
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
