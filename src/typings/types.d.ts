declare module "pf-boggle" {
	function generate(size: number = 4, dice: any[] = []): string[];
	function solve(
		board: string[],
		dictionary: string[] = []
	): { word: string; sequence: number[] }[];

	export { generate, solve };
}

declare module "fastify-disablecache";

type Board = {
	board: string[];
	words: string[];
};

type ChatInfo = {
	chatId?: string;
	messageId?: string;
	inlineId?: string;
};

type ResultsBody = {
	score: number;
	words: string[];
};

type ScoreEntry = {
	score?: number;
	words?: string[];
	name: string;
	id: string;
};
