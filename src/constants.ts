export const DEFAULT_SCORE = -1;

export enum Game {
	WORD_HUNT,
}

export const GameURL: { [key in Game]: string } = {
	[Game.WORD_HUNT]: process.env.WORD_HUNT_URL as string,
};

export const PlayerMax: { [key in Game]: number } = {
	[Game.WORD_HUNT]: Number.MAX_VALUE,
};

export const TurnMax: { [key in Game]: number } = {
	[Game.WORD_HUNT]: 2,
};
