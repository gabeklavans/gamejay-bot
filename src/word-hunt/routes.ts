import { FastifyInstance } from "fastify";
import { gameSessions } from "../server";
import httpError from "http-errors";
import { DEFAULT_SCORE, TurnMax } from "../constants";

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
		Params: { sessionId: string; userId: string };
	}>("/result/:sessionId/:userId", (req, res) => {
		const { sessionId, userId } = req.params;
		if (!sessionId || !userId) {
			fastify.log.error(
				`Invalid URL params, sessionId: ${sessionId}, userId: ${userId}.`
			);
			return;
		}
		const session = gameSessions[sessionId];
		const { score, words } = JSON.parse(req.body as string) as {
			score: number;
			words: string[];
		};

		// TODO: generalize these error for all games... they should work for all
		if (!session) {
			fastify.log.error(`Session with ID ${sessionId} does not exist.`);
			return;
		}
		if (!session.scores[userId]) {
			fastify.log.error(`User ${userId} did not join this game.`);
			return;
		}
		if (session.scores[userId] !== DEFAULT_SCORE) {
			fastify.log.error(
				`User ${userId} already submitted a score of ${session.scores[userId]}.`
			);
			return;
		}
		if (score < 0) {
			fastify.log.error(`Score of ${score} is less than 0.`);
			return;
		}

		session.turnCount++;
		session.scores[userId] = score;

		console.log(`User ${userId} got a score of ${score}!!!\nWith words:`);
		console.log(words);

		if (session.turnCount == TurnMax[session.game]) {
			// TODO: report the winner to telegram
			// TODO: Save session to database so we don't have to keep it in memory...
			fastify.log.debug(`Game ${sessionId} over. Saving to database...`);
			// I want this ^ so ppl can go to their games and see things like the scores and potential words
		}
	});

	done();
};
