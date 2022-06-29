import { FastifyInstance } from "fastify";
import { gameSessions } from "../server";
import httpError from "http-errors";

export default (
	fastify: FastifyInstance,
	opts: any,
	done: (err?: Error | undefined) => void
) => {
	fastify.get<{
		Params: { sessionId: string };
	}>("/board/:sessionId", (req, res) => {
		const { sessionId } = req.params;

		const rhetBoard = gameSessions[sessionId].board;
		if (!rhetBoard) {
			res.send(httpError.InternalServerError);
			return;
		}
		
		res.send(rhetBoard);
	});

	fastify.get<{
		Params: { sessionId: string };
	}>("/session/:sessionId", (req, res) => {
		const { sessionId } = req.params;

		const session = gameSessions[sessionId];

		if (!session) {
			res.send(httpError.NotFound);
			return;
		}

		const sessionView = {
			board: session.board,
			scoredUsers: session.scoredUsers,
			done: session.done,
		};

		res.send(sessionView);
	});

	done();
};
