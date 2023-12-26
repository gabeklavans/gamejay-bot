import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import disableCache from "fastify-disablecache";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import whoRoutes from "./word-hunt/routes";
import mainRoutes from "./routes";
import { Game } from "../constants";

import who from "./word-hunt/main";
import { bot } from "../bot";
import { webhookCallback } from "grammy";

export const fastify = Fastify({
	logger: { level: process.env.LOG_LEVEL ?? "debug" },
});
const validDomains = (process.env.CORS_ACCESS as string).split(",");
fastify.register(fastifyCors, {
	origin: validDomains.length > 1 ? validDomains : validDomains[0],
});
fastify.register(disableCache);

fastify.register(swagger, {
	swagger: {
		info: {
			title: "GameJay API",
			description: "Internal API for GameJay server.",
			version: "0.0.1",
		},
		externalDocs: {
			url: "https://swagger.io",
			description: "Find more info here",
		},
		host: "localhost:3000",
		schemes: ["http"],
		consumes: ["application/json"],
		produces: ["application/json"],
	},
});

fastify.register(swaggerUI, {
	routePrefix: "/docs",
	uiConfig: {
		docExpansion: "list",
		deepLinking: true,
	},
	uiHooks: {
		onRequest: function (request, reply, next) {
			next();
		},
		preHandler: function (request, reply, next) {
			next();
		},
	},
	staticCSP: true,
	transformStaticCSP: (header) => header,
	transformSpecification: (swaggerObject, request, reply) => {
		return swaggerObject;
	},
	transformSpecificationClone: true,
});

fastify.register(mainRoutes);
fastify.register(whoRoutes, { prefix: "/who" });

if (process.env.USE_WEBHOOK === "True") {
	fastify.post(
		`/${process.env.WEBHOOK_SECRET}`,
		{
			onError: (req, res, err) => {
				console.error("Error with webhookCallback!");
				if (err.message.includes("Cannot read properties of undefined (reading 'update_id')")) {
					fastify.log.warn("update_id was missing in webhook callback... consider if this is a problem");
				} else {
					throw err;
				}
			},
		},
		webhookCallback(bot, "fastify")
	);
}

fastify.setErrorHandler((err, req, reply) => {
	fastify.log.error(err);

	reply.status(500).send();
});

export default async function startServer() {
	await who.init();

	fastify.listen(
		{
			host: process.env.SERVER_DOMAIN ?? "::",
			port: parseInt(process.env.PORT ?? "3000"),
		},
		async (err) => {
			if (err) {
				fastify.log.fatal(err);
				process.exit(1);
			}
			// await fastify.oas();
			if (process.env.USE_WEBHOOK === "True") {
				await bot.api.setWebhook(`${process.env.SERVER_URL}/${process.env.WEBHOOK_SECRET}`);
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
	turnCount: number;
	players: {
		[key: string]: {
			score?: number;
			words?: string[];
			name: string;
			started: boolean;
			done: boolean; // attempt to prevent post-game score changing
		};
	};
	winnerIds: string[]; // state used for score-keeping
	done: boolean;
};

export const gameSessions: {
	[key: string]: GameSession;
} = {};
