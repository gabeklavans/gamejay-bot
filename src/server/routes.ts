import { FastifyInstance, FastifyReply } from "fastify";
import { Api } from "grammy";
import httpError from "http-errors";
import { sendMsg } from "../bot";
import { Game, TURN_MAX } from "../constants";
import { GameSession, gameSessions } from "./server";
import {
	endSession,
	getGameScore,
	handleJoinSession,
	hashTgCallback,
	setGameScore,
	sortDescendingScore,
} from "./utils";

export default (
	fastify: FastifyInstance,
	opts: any,
	done: (err?: Error | undefined) => void
) => {
	fastify.get<{
		Params: {
			inlineId: string;
			userId: string;
			userName: string;
		};
	}>("/join-game/:inlineId/:userId/:userName", async (req, res) => {
		const { inlineId, userId, userName } = req.params;
		if (!userId) {
			fastify.log.error(`Invalid URL params, userId: ${userId}.`);
			res.send(httpError.BadRequest);
			return;
		}

		const sessionId = hashTgCallback("pingas", inlineId);
		const chatInfo = { inlineId };

		await handleJoinSession(sessionId, chatInfo, userId, userName, res);
	});

	fastify.get<{
		Params: {
			chatId: string;
			messageId: string;
			userId: string;
			userName: string;
		};
	}>("/join-game/:chatId/:messageId/:userId/:userName", async (req, res) => {
		const { chatId, messageId, userId, userName } = req.params;
		if (!userId) {
			fastify.log.error(`Invalid URL params, userId: ${userId}.`);
			res.send(httpError.BadRequest);
			return;
		}

		const sessionId = hashTgCallback(chatId, messageId);
		const chatInfo = { chatId, messageId };

		await handleJoinSession(sessionId, chatInfo, userId, userName, res);
	});

	fastify.post<{
		Params: { sessionId: string; userId: string };
	}>(
		"/result/:sessionId/:userId",
		{
			schema: {
				params: {
					type: "object",
					properties: {
						sessionId: { type: "string" },
						userId: { type: "number" },
					},
				},
				body: {
					type: "object",
					properties: {
						score: { type: "number" },
						words: { type: "array", items: { type: "string" } },
					},
				},
			},
		},
		(req) => {
			const { sessionId, userId } = req.params;

			if (!sessionId || !userId) {
				fastify.log.error(
					`Invalid URL params, sessionId: ${sessionId}, userId: ${userId}.`
				);
				return;
			}
			const gameSession = gameSessions[sessionId];
			const body = req.body as ResultsBody;
			const score: number = body.score;

			if (!gameSession) {
				fastify.log.error(
					`Session with ID ${sessionId} does not exist.`
				);
				return;
			}
			if (!gameSession.scoredUsers[userId]) {
				fastify.log.error(`User ${userId} did not join this game.`);
				return;
			}
			if (gameSession.scoredUsers[userId].score) {
				fastify.log.error(
					`User ${userId} already submitted a score of ${gameSession.scoredUsers[userId]}.`
				);
				return;
			}
			if (score < 0) {
				fastify.log.error(`Score of ${score} is less than 0.`);
				return;
			}

			gameSession.turnCount++;
			gameSession.scoredUsers[userId].score = score;

			calcAndSetHighScores(gameSession, userId).catch(console.error);

			// set game-specific values here
			switch (gameSession.game) {
				case Game.WORD_HUNT:
					gameSession.scoredUsers[userId].words = body.words;
					break;
			}

			if (gameSession.turnCount == TURN_MAX[gameSession.game]) {
				endSession(sessionId);
			}
		}
	);

	done();
};

async function calcAndSetHighScores(gameSession: GameSession, userId: string) {
	const api = new Api(process.env.BOT_API_KEY!);

	const scoreEntries: ScoreEntry[] = Object.entries(gameSession.scoredUsers)
		.map((scoredUser) => {
			return {
				id: scoredUser[0],
				...scoredUser[1],
			};
		})
		// only figure out a winner if there are at least two confirmed scores
		.filter((scoreEntry) => scoreEntry.score != undefined);

	// winner is on top
	scoreEntries.sort(sortDescendingScore);
	const winner = scoreEntries[0];
	console.log(scoreEntries);

	// scores may now require rebalancing
	if (scoreEntries.length > 2) {
		console.log("More than 2 scores==========");

		if (winner.id == userId) {
			// there's a new winner in town, rebalance scores
			const oldWinner = scoreEntries[1];
			const oldWinnerGameScore = await getGameScore(
				gameSession,
				api,
				oldWinner.id
			);

			if (oldWinnerGameScore) {
				// there was an old winner, so take away from them and give to new winner
				const newWinnerGameScore = await getGameScore(
					gameSession,
					api,
					winner.id
				);

				setGameScore(
					gameSession,
					api,
					oldWinner.id,
					oldWinnerGameScore.score - 1,
					true
				);
				setGameScore(
					gameSession,
					api,
					winner.id,
					newWinnerGameScore ? newWinnerGameScore.score + 1 : 1
				);
			} else {
				console.error(
					"Old winner has never won, which should be impossible..."
				);
			}

			// notify everyone of the new winner in town
			// NOTE: this does not work for games made by inline queries,
			// as they don't have chat_id nor send access
			if (gameSession.chatId) {
				const replyMsgId = gameSession.messageId
					? parseInt(gameSession.messageId)
					: undefined;
				sendMsg(
					`${winner.name} took the lead with ${winner.score}!`,
					gameSession.chatId,
					replyMsgId
				);
			}
		}
	} else if (scoreEntries.length > 1) {
		console.log("2 scores==========");
		// only two scores, just get the winner
		const winnerGameScore = await getGameScore(gameSession, api, winner.id);

		await setGameScore(
			gameSession,
			api,
			winner.id,
			winnerGameScore ? winnerGameScore.score + 1 : 1,
			true
		);
	}
}
