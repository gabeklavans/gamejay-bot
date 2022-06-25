import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import whoRoutes from "./word-hunt/routes";
import mainRoutes from "./routes";
import { Game } from "./constants";

import who from "./word-hunt/main";

const fastify = Fastify({
	logger: { level: "debug" },
});
const validDomains = (process.env.CORS_ACCESS as string).split(",");
fastify.register(fastifyCors, {
	origin: validDomains.length > 1 ? validDomains : validDomains[0],
});
fastify.register(disableCache);

fastify.register(mainRoutes);
fastify.register(whoRoutes, { prefix: "/who" });

export default async function startServer() {
	await who.init();

	fastify.listen(3000, process.env.SERVER_DOMAIN as string, (err) => {
		if (err) {
			fastify.log.error(err);
			process.exit(1);
		}
	});
}

type GameSession = {
	chatId?: string;
	messageId?: string;
	inlineId?: string;
	game: Game;
	board?: Board;
	playerCount: number;
	turnCount: number;
	scoredUsers: {
		[key: string]: { score?: number; words?: string[]; name: string };
	};
	done: boolean;
};

export const gameSessions: {
	[key: string]: GameSession;
} = {};
