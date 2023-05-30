import { FastifyInstance } from "fastify";
import { gameSessions } from "../server";
import httpError from "http-errors";

export default (fastify: FastifyInstance, opts: any, done: (err?: Error | undefined) => void) => {
	fastify.get<{
		Params: { sessionId: string };
	}>("/board/:sessionId", (req, reply) => {
		const { sessionId } = req.params;

		const rhetBoard = gameSessions[sessionId].board;
		if (!rhetBoard) {
			reply.send(httpError.InternalServerError);
			return;
		}

		reply.send(rhetBoard);
	});

	fastify.get<{
		Params: { sessionId: string };
	}>("/session/:sessionId", (req, reply) => {
		const { sessionId } = req.params;

		const session = gameSessions[sessionId];

		if (!session) {
			reply.send(httpError.NotFound);
			return;
		}

		const sessionView = {
			board: session.board,
			scoredUsers: session.players,
			done: session.done,
		};

		reply.send(sessionView);
	});

	done();
};
