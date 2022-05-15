import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import whoRoutes from "./word-hunt/routes";
import { createHash, randomUUID } from "crypto";
import { Game, GameURL, PlayerMax } from "./constants";

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
}>("/join-game/:chatId/:messageId", async (req, res) => {
	const { chatId, messageId } = req.params;

	const sessionId = hashTgCallback(chatId, messageId);

	if (!gameSessions[sessionId]) {
		// TODO: Start a wordhunt game by default; will need a way to specify the game later
		await startSession(Game.WORD_HUNT, sessionId);
	}

	const session = gameSessions[sessionId];
	// NOTE: this probably isn't a race condition? Node is single-threaded right?
	if (session.playerCount < PlayerMax[session.game]) {
		gameSessions[sessionId].playerCount++;

		switch (gameSessions[sessionId].game) {
			case Game.WORD_HUNT:
				res.redirect(`${GameURL[Game.WORD_HUNT]}?session=${sessionId}`);
				break;
		}
	} else {
		// game is full, go into spectator mode
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
	gameSessions[gameId] = { done: false, game, playerCount: 0, turnCount: 0 };
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
