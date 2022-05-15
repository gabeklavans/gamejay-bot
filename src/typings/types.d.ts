declare module "pf-boggle" {
	function generate(size: number = 4, dice: any[] = []): string[];
	function solve(
		board: string[],
		dictionary: string[] = []
	): { word: string; sequence: number[] }[];

	export { generate, solve };
}

declare module "fastify-disablecache";

interface JoinParams {
	chatId: string;
	messageId: string;
}

type Board = {
	board: string[];
	words: string[];
};
