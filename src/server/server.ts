import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import oas from "fastify-oas";
import whoRoutes from "./word-hunt/routes";
import mainRoutes from "./routes";
import { Game } from "../constants";

import who from "./word-hunt/main";
import { bot } from "../bot";
import { webhookCallback } from "grammy";

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

if (process.env.NODE_ENV === "production") {
	fastify.post(
		`/${process.env.WEBHOOK_SECRET}`,
		{
			onError: (req, res, err) => {
				console.error("Error with webookCallback!");
				if (
					err.message.includes(
						"Cannot read properties of undefined (reading 'update_id')"
					)
				) {
					fastify.log.warn(
						"update_id was missing in webhook callback... consider if this is a problem"
					);
				} else {
					throw err;
				}
			},
		},
		webhookCallback(bot, "fastify")
	);
}

fastify.setErrorHandler((err, req, res) => {
	fastify.log.error(err);

	res.status(500).send();
});

export default async function startServer() {
	await who.init();

	fastify.listen(
		process.env.PORT ?? 3000,
		process.env.SERVER_DOMAIN ?? "::",
		async (err) => {
			if (err) {
				fastify.log.fatal(err);
				process.exit(1);
			}
			await fastify.oas();
			if (process.env.NODE_ENV === "production") {
				await bot.api.setWebhook(
					`${process.env.SERVER_URL}/${process.env.WEBHOOK_SECRET}`
				);
				console.log("Bot webhook set");
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
