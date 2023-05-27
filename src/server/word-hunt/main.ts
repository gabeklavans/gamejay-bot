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

async function getBoardWithSolutions(): Promise<Board> {
	let rhetBoard = boards.pop();

	if (!rhetBoard) {
		console.warn("Ran out of boards! Generating a new one...");
		rhetBoard = genBoard();
	}

	// fill up board slots async
	// NOTE: Node is single threaded so this probably won't result in a race condition?
	genBoards();

	return rhetBoard!;
}

function genBoards() {
	// TODO: Maybe implement a timeout error
	while (boards.length < NUM_BOARDS) {
		boards.push(genBoard());
	}
}

function genBoard() {
	let boardWords = new Set<string>();
	let board: string[] = [];
	while (boardWords.size < MIN_WORDS) {
		if (DEBUG) {
			console.log(`generating new board ${board.length + 1}...`);
		}
		board = pfBoggle.generate(GRID_SIZE).map((letter) => letter.slice(0, 1)); // I guess boggle considers QU a letter...
		const solutions = pfBoggle.solve(board);

		boardWords = new Set(solutions.map((solution) => solution.word).filter((word) => word.length > 2));
	}
	return {
		board,
		words: Array.from(boardWords),
	};
}

export default {
	init,
	getBoardWithSolutions,
};
