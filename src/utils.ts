import { createHash } from "crypto";
import { gameSessions } from "./server";

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
