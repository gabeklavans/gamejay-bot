import pfBoggle from "pf-boggle";

const DEBUG = true;
const GRID_SIZE = 4;
let board: string[] = [];

export async function init() {
	let boardWords = new Set<string>();

	while (boardWords.size < 1) {
		if (DEBUG) {
			console.log("generating new board...");
		}
		board = pfBoggle.generate(GRID_SIZE);
		const solutions = pfBoggle.solve(board);
		boardWords = new Set(
			solutions
				.map((solution) => solution.word)
				.filter((word) => word.length > 2)
		);
	}

	if (DEBUG) {
		console.log(boardWords);
		// eslint-disable-next-line no-console
		console.log(board);
	}
}
