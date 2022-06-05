import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import who from "./word-hunt/main";
import { createHash, randomUUID } from "crypto";

enum Game {
	WORD_HUNT,
}

const fastify = Fastify({
	logger: true,
});
fastify.register(fastifyCors, {
	origin: true,
});
fastify.register(disableCache);

fastify.get("/board", async (req, res) => {
	const rhetBoard = await who.getBoardWithSolutions();
	res.send(rhetBoard);
});

fastify.get<{
	Params: WordHuntParams;
}>("/join-game/:chatId/:messageId", (req, res) => {
	const { chatId, messageId } = req.params;

	const sessionId = hashTgCallback(chatId, messageId);

	if (!sessions[sessionId]) {
		startSession(Game.WORD_HUNT, sessionId);
	}

	switch (sessions[sessionId].game) {
		case Game.WORD_HUNT:
			res.redirect(`http://leet.dabe.tech:8081?session=${sessionId}`);
			return;
	}
});

fastify.post("/result", (req, res) => {
	const body: {
		score: number;
		words: string[];
	} = JSON.parse(req.body as string);
	console.log(`User got a score of ${body.score}!!!\nWith words:`);
	console.log(body.words);
	console.log("===========");
});

export default async function startServer() {
	await who.init();

	fastify.listen(3000, "192.168.0.42", (err) => {
		if (err) {
			fastify.log.error(err);
			process.exit(1);
		}
	});
}

const sessions: {
	[key: string]: {
		game: Game;
		done: boolean;
	};
} = {};

/**
 *
 * @param game The game to join a session of
 * @param uid The ID to be used for the session
 * @returns The ID used for the session
 */
export function startSession(game: Game, uid?: string) {
	const gameId = uid ? uid : randomUUID();
	sessions[gameId] = { done: false, game };
	return gameId;
}

function hashTgCallback(chatId: string, messageId: string) {
	const hash = createHash("sha1");
	hash.update(chatId);
	hash.update(messageId);
	return hash.digest().toString("base64url");
}
