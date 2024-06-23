import { createHash } from "crypto";
import { FastifyReply } from "fastify";
import { Api, GrammyError, RawApi } from "grammy";
import { Server, IncomingMessage, ServerResponse } from "http";
import { Game, PLAYER_MAX, GAME_URL, NUM_DAYS_SESSION_EXPIRED, MAX_SESSIONS } from "../constants";
import { GameSession, fastify, gameSessions } from "./server";
import { differenceInDays } from "date-fns";
import { SessionExpiredError } from "./errors";

import who from "./word-hunt/main";

export function setGameScore(
	gameSession: GameSession,
	api: Api<RawApi>,
	userId: string,
	score: number,
	force: boolean = false,
) {
	fastify.log.info(`Changing score of player ${userId} to ${score}, force=${force}`);

	if (gameSession.inlineId) {
		api.setGameScoreInline(gameSession.inlineId, parseInt(userId), score, {
			force,
		}).catch(handleScoreUpdateErr);
	} else if (gameSession.chatId && gameSession.messageId) {
		api.setGameScore(parseInt(gameSession.chatId), parseInt(gameSession.messageId), parseInt(userId), score, {
			force,
		}).catch(handleScoreUpdateErr);
	}
}

export async function getGameScoreObj(gameSession: GameSession, api: Api<RawApi>, userId: string) {
	let gameScores;
	try {
		if (gameSession.inlineId) {
			gameScores = await api.getGameHighScoresInline(gameSession.inlineId, parseInt(userId));
		} else if (gameSession.chatId && gameSession.messageId) {
			gameScores = await api.getGameHighScores(
				parseInt(gameSession.chatId),
				parseInt(gameSession.messageId),
				parseInt(userId),
			);
		}
	} catch (err) {
		fastify.log.error(err);
	}

	const foundScore = gameScores?.find((gameScore) => gameScore.user.id === parseInt(userId));

	fastify.log.debug(`Found score: ${foundScore}`);

	return foundScore;
}

/**
 * Handles incrementing a player's score. If the player has never
 * scored before, will set to 1.
 * @param gameSession
 * @param api Grammy bot API object
 * @param playerId
 */
export async function incrementGameScore(gameSession: GameSession, api: Api<RawApi>, playerId: string) {
	const oldScoreObj = await getGameScoreObj(gameSession, api, playerId);

	setGameScore(gameSession, api, playerId, oldScoreObj ? oldScoreObj.score + 1 : 1);
}

/**
 * Handles decrementing a player's score. Will return early with a warning
 * if the player's score is not found.
 * @param gameSession
 * @param api Grammy bot API object
 * @param playerId
 */
export async function decrementGameScore(gameSession: GameSession, api: Api<RawApi>, playerId: string) {
	const oldScoreObj = await getGameScoreObj(gameSession, api, playerId);

	if (!oldScoreObj) {
		fastify.log.warn(`Player ${playerId} does not have a score`);
		return;
	}

	setGameScore(gameSession, api, playerId, oldScoreObj.score - 1, true);
}

function cleanupExpiredSessions() {
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - NUM_DAYS_SESSION_EXPIRED);

	// TODO: Maybe replace with sorting and binary search
	// if performance ever becomes an issue
	for (const id of Object.keys(gameSessions)) {
		if (gameSessions[id].created < cutoffDate) {
			delete gameSessions[id];
		}
	}
}

export async function handleJoinSession(
	sessionId: string,
	chatInfo: ChatInfo,
	userId: string,
	userName: string,
	res: FastifyReply<Server, IncomingMessage, ServerResponse, any, unknown>,
) {
	if (!gameSessions[sessionId]) {
		// TODO: Start a wordhunt game by default; will need a way to specify the game later
		const sessionCreated = await createSession(Game.WORD_HUNT, chatInfo, sessionId);
		if (!sessionCreated) {
			fastify.log.warn(`handleJoinSession: session ${sessionId} not created`);
			res.redirect("https://http.cat/images/503.jpg");
			return;
		}
	}

	const session = gameSessions[sessionId];
	// add player to session if possible
	// NOTE: this probably isn't a race condition? Node is single-threaded right?
	if (!session.players[userId] && Object.keys(session.players).length < PLAYER_MAX[session.game]) {
		session.players[userId] = {
			words: [],
			name: userName,
			started: false,
			done: false,
		};
	}

	// determine where to redirect the browser
	if (session.players[userId] && !session.players[userId].started) {
		switch (session.game) {
			case Game.WORD_HUNT:
				res.redirect(`${GAME_URL[Game.WORD_HUNT]}?session=${sessionId}&user=${userId}`);
				break;
		}
	} else {
		switch (session.game) {
			case Game.WORD_HUNT:
				res.redirect(`${GAME_URL[Game.WORD_HUNT]}?session=${sessionId}&user=${userId}&spectate=true`);
				break;
		}
		// TODO: implement spectator mode (doesn't matter for word hunt)
	}
}

/**
 * Let's the session know that a player started. This usually means that
 * if the player leaves and comes back, they forfeit their turn.
 * @param sessionId
 * @param userId
 */
export function handlePlayerStart(sessionId: string, userId: string) {
	if (!gameSessions[sessionId]) {
		fastify.log.error("handlePlayerStart: Session not found");
		return false;
	}

	if (!gameSessions[sessionId].players[userId]) {
		fastify.log.error("handlePlayerStart: User not found in session");
		return false;
	}

	gameSessions[sessionId].players[userId].started = true;
	return true;
}

/**
 * As a side-effect, cleans up expired sesisons
 *
 * @param game The game to create a session of
 * @param uid The ID to be used for the session
 * @returns The ID used for the session
 */
export async function createSession(game: Game, chatInfo: ChatInfo, sessionId: string) {
	cleanupExpiredSessions();

	if (Object.keys(gameSessions).length > MAX_SESSIONS) {
		fastify.log.warn(`createSession: max number of sessions (${MAX_SESSIONS}) reached`);
		return false;
	}

	gameSessions[sessionId] = {
		chatId: chatInfo.chatId,
		messageId: chatInfo.messageId,
		inlineId: chatInfo.inlineId,
		game,
		turnCount: 0,
		players: {},
		winnerIds: [],
		done: false,
		created: new Date(),
	};
	switch (game) {
		case Game.WORD_HUNT:
			gameSessions[sessionId].board = await who.getBoardWithSolutions();
			break;
	}
	return true;
}

export function endSession(sessionId: string) {
	const gameSession = gameSessions[sessionId];
	// TODO: maybe report the winner to telegram
	// TODO: Save session to database so we don't have to keep it in memory...
	gameSession.done = true;
	console.log(`Game ${sessionId} over. Saving to database...`);
	// I want this ^ so ppl can go to their games and see things like the scores and potential words (in word hunt)
}

export function getSessionId(messageId: string, chatId: string = "pingas") {
	const hash = createHash("sha1");
	hash.update(chatId);
	hash.update(messageId);
	return hash.digest().toString("base64url");
}

function handleScoreUpdateErr(err: GrammyError) {
	if (err.description.includes("BOT_SCORE_NOT_MODIFIED")) {
		fastify.log.warn("Score not modified");
	} else {
		fastify.log.error(err);
	}
}

export function sortDescendingScore(a: ScoreEntry, b: ScoreEntry) {
	return (b.score ?? Number.MIN_SAFE_INTEGER) - (a.score ?? Number.MIN_SAFE_INTEGER);
}

export function throwIfSessionExpired(sessionId: string) {
	if (
		gameSessions[sessionId] &&
		differenceInDays(new Date(), gameSessions[sessionId].created) >= NUM_DAYS_SESSION_EXPIRED
	) {
		throw new SessionExpiredError(sessionId);
	}
}
