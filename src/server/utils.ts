import { createHash, randomUUID } from "crypto";
import { FastifyReply } from "fastify";
import { Api, GrammyError, RawApi } from "grammy";
import { Server, IncomingMessage, ServerResponse } from "http";
import { Game, PLAYER_MAX, GAME_URL } from "../constants";
import { GameSession, gameSessions } from "./server";

import who from "./word-hunt/main";

export function setGameScore(
	gameSession: GameSession,
	api: Api<RawApi>,
	userId: string,
	score: number,
	force: boolean = false
) {
	if (gameSession.inlineId) {
		api.setGameScoreInline(gameSession.inlineId, parseInt(userId), score, {
			force,
		}).catch(handleScoreUpdateErr);
	} else if (gameSession.chatId && gameSession.messageId) {
		api.setGameScore(
			parseInt(gameSession.chatId),
			parseInt(gameSession.messageId),
			parseInt(userId),
			score,
			{ force }
		).catch(handleScoreUpdateErr);
	}
}

export async function getGameScore(
	gameSession: GameSession,
	api: Api<RawApi>,
	userId: string
) {
	let gameScores;
	try {
		if (gameSession.inlineId) {
			gameScores = await api.getGameHighScoresInline(
				gameSession.inlineId,
				parseInt(userId)
			);
		} else if (gameSession.chatId && gameSession.messageId) {
			gameScores = await api.getGameHighScores(
				parseInt(gameSession.chatId),
				parseInt(gameSession.messageId),
				parseInt(userId)
			);
		}
	} catch (err) {
		console.error(err);
	}

	console.log(gameScores);

	return gameScores?.find(
		(gameScore) => gameScore.user.id.toString() === userId
	);
}

export async function handleJoinSession(
	sessionId: string,
	chatInfo: ChatInfo,
	userId: string,
	userName: string,
	res: FastifyReply<Server, IncomingMessage, ServerResponse, any, unknown>
) {
	if (!gameSessions[sessionId]) {
		// TODO: Start a wordhunt game by default; will need a way to specify the game later
		await startSession(Game.WORD_HUNT, chatInfo, sessionId);
	}

	const session = gameSessions[sessionId];
	// NOTE: this probably isn't a race condition? Node is single-threaded right?
	if (
		!session.scoredUsers[userId] &&
		session.playerCount < PLAYER_MAX[session.game]
	) {
		const session = gameSessions[sessionId];
		session.playerCount++;
		session.scoredUsers[userId] = {
			words: [],
			name: userName,
		};

		switch (gameSessions[sessionId].game) {
			case Game.WORD_HUNT:
				res.redirect(
					`${
						GAME_URL[Game.WORD_HUNT]
					}?session=${sessionId}&user=${userId}`
				);
				break;
		}
	} else {
		// game is full, go into spectator mode
		switch (gameSessions[sessionId].game) {
			case Game.WORD_HUNT:
				res.redirect(
					`${
						GAME_URL[Game.WORD_HUNT]
					}?session=${sessionId}&user=${userId}&spectate=true`
				);
				break;
		}
		// TODO: implement spectator mode
	}
}

/**
 *
 * @param game The game to join a session of
 * @param uid The ID to be used for the session
 * @returns The ID used for the session
 */
export async function startSession(
	game: Game,
	chatInfo: ChatInfo,
	uid?: string
) {
	const gameId = uid ? uid : randomUUID();
	gameSessions[gameId] = {
		chatId: chatInfo.chatId,
		messageId: chatInfo.messageId,
		inlineId: chatInfo.inlineId,
		game,
		playerCount: 0,
		turnCount: 0,
		scoredUsers: {},
		done: false,
	};
	switch (game) {
		case Game.WORD_HUNT:
			gameSessions[gameId].board = await who.getBoardWithSolutions();
			break;
	}
	return gameId;
}

export function endSession(sessionId: string) {
	const gameSession = gameSessions[sessionId];
	// TODO: report the winner to telegram
	// TODO: Save session to database so we don't have to keep it in memory...
	gameSession.done = true;
	console.log(`Game ${sessionId} over. Saving to database...`);
	// I want this ^ so ppl can go to their games and see things like the scores and potential words (in word hunt)
}

export function hashTgCallback(chatId: string, messageId: string) {
	const hash = createHash("sha1");
	hash.update(chatId);
	hash.update(messageId);
	return hash.digest().toString("base64url");
}

function handleScoreUpdateErr(err: GrammyError) {
	if (err.description.includes("BOT_SCORE_NOT_MODIFIED")) {
		console.warn("Score not modified");
	} else {
		console.error(err);
	}
}

export function sortDescendingScore(a: ScoreEntry, b: ScoreEntry) {
	return (
		(b.score ?? Number.MIN_SAFE_INTEGER) -
		(a.score ?? Number.MIN_SAFE_INTEGER)
	);
}
