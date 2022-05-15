import { FastifyInstance } from "fastify";
import { gameSessions } from "../server";
import httpError from "http-errors";
import { TurnMax } from "../constants";

export default (
	fastify: FastifyInstance,
	opts: any,
	done: (err?: Error | undefined) => void
) => {
	fastify.get<{
		Params: { sessionId: string };
	}>("/board/:sessionId", (req, res) => {
		const rhetBoard = gameSessions[req.params.sessionId].board;
		if (!rhetBoard) {
			res.send(httpError.InternalServerError);
			return;
		}
		res.send(rhetBoard);
		return;
	});

	fastify.post<{
		Params: { sessionId: string };
	}>("/result/:sessionId", (req, res) => {
		const session = gameSessions[req.params.sessionId];
		if (session) {
			session.turnCount++;
			if (session.turnCount == TurnMax[session.game]) {
				// game is done, calculate winner
				// TODO: ^
				console.log("============ It's over.");
			}
		}
		const body: {
			score: number;
			words: string[];
		} = JSON.parse(req.body as string);
		fastify.log.debug(`User got a score of ${body.score}!!!\nWith words:`);
		fastify.log.debug(body.words);
		fastify.log.debug("===========");
	});

	done();
};
