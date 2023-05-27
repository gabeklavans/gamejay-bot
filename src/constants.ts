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

export const GAME_START_BUTTON_TEXT = "Play now!"