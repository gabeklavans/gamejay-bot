export enum Game {
	WORD_HUNT,
}

export const GameURL: { [key in Game]: string } = {
	[Game.WORD_HUNT]: "http://localhost:8081",
};

export const PlayerMax: { [key in Game]: number } = {
	[Game.WORD_HUNT]: 2,
};

export const TurnMax: { [key in Game]: number } = {
	[Game.WORD_HUNT]: 2,
};
