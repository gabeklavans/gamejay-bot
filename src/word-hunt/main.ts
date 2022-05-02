import pfBoggle from "pf-boggle";

const DEBUG = false;
const GRID_SIZE = 4;
const MIN_WORDS = 30;
const NUM_BOARDS = 10;

const boards: { board: string[]; words: string[] }[] = [];

async function init() {
	await genBoards();

	if (DEBUG) {
		// eslint-disable-next-line no-console
		console.log(boards);
	}
}

async function getBoardWithSolutions() {
	let rhetBoard = boards.pop();

	if (!rhetBoard) {
		console.warn("Ran out of boards! Generating more...");
		// TODO: Create gen primative where it just makes a single board
		// Use prmative here, and make genBoards call primative
		await genBoards();
		rhetBoard = boards.pop();
	}

	// fill up board slots async
	genBoards();

	return rhetBoard!;
}

async function genBoards() {
	// TODO: Maybe implement a timeout error
	while (boards.length < NUM_BOARDS) {
		let boardWords = new Set<string>();
		let board: string[] = [];
		while (boardWords.size < MIN_WORDS) {
			if (DEBUG) {
				console.log(`generating new board ${board.length + 1}...`);
			}
			board = pfBoggle.generate(GRID_SIZE);
			const solutions = pfBoggle.solve(board);

			boardWords = new Set(
				solutions
					.map((solution) => solution.word)
					.filter((word) => word.length > 2)
			);
		}
		boards.push({
			board,
			words: Array.from(boardWords),
		});
	}
}

export default {
	init,
	getBoardWithSolutions,
};
