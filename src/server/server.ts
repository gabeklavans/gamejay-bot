import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import oas from "fastify-oas";
import whoRoutes from "./word-hunt/routes";
import mainRoutes from "./routes";
import { Game } from "../constants";

import who from "./word-hunt/main";
import { bot } from "../bot";

const fastify = Fastify({
	logger: { level: "debug" },
});
const validDomains = (process.env.CORS_ACCESS as string).split(",");
fastify.register(fastifyCors, {
	origin: validDomains.length > 1 ? validDomains : validDomains[0],
});
fastify.register(disableCache);

fastify.register(oas, {
	routePrefix: "/docs",
	swagger: {
		info: {
			title: "GameJay API",
			description: "Internal API for GameJay server.",
			version: "0.0.1",
		},
		servers: [
			{
				url: "http://192.168.1.42:3000",
				description: "Melinoe",
			},
			{
				url: "http://leet.dabe.tech:3000",
				description: "L33t server",
			},
		],
		externalDocs: {
			url: "https://swagger.io",
			description: "Find more info here",
		},
		consumes: ["application/json"],
		produces: ["application/json"],
	},
	exposeRoute: true,
});

fastify.register(mainRoutes);
fastify.register(whoRoutes, { prefix: "/who" });

export default async function startServer() {
	await who.init();

	fastify.listen(
		3000,
		(process.env.SERVER_DOMAIN as string) ?? undefined,
		async (err) => {
			if (err) {
				fastify.log.error(err);
				process.exit(1);
			}
			await fastify.oas();
			if (process.env.NODE_ENV === "production") {
				await bot.api.setWebhook(
					`${process.env.SERVER_URL}/${process.env.BOT_API_KEY}`
				);
			}
		}
	);
}

export type GameSession = {
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
