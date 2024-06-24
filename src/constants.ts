import { code, fmt, link } from "@grammyjs/parse-mode";

export enum Game {
	WORD_HUNT,
}

export const GAME_LIST = [
	{
		name: "Word Hunt Online",
		shortName: "who",
	},
];

export const GAME_URL: { [key in Game]: string } = {
	[Game.WORD_HUNT]: process.env.WORD_HUNT_URL as string,
};

export const PLAYER_MAX: { [key in Game]: number } = {
	[Game.WORD_HUNT]: Number.MAX_VALUE,
};

export const TURN_MAX: { [key in Game]: number } = {
	[Game.WORD_HUNT]: Number.MAX_VALUE,
};

export const GAME_START_BUTTON_TEXT = "Play now!";

export const MAX_SESSIONS = 10000;
export const NUM_DAYS_SESSION_EXPIRED = 3;

export const WELCOME_MESSAGE = fmt`Welcome!

This bot is best used in ${link(
	"Inline Mode",
	"https://telegram.org/blog/inline-bots",
)}. Just go to your chat then type the name of the bot with a space at the end: ${code(
	"@gamejaybot ",
)} and a list of games should show up! You can search through the games by continuing to type your search query. Then, tap on the one you want to start and it will send a new game to the chat you're in.

Currently, Word Hunt Online is the only game available for GameJay, but more are planned to be added!`;
