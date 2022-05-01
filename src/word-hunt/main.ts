import { TextFrequency } from "../correct-frequency-random-letters/index";
const letterGenerator = new TextFrequency();
import dictionaryEn from "dictionary-en";
import nspell from "nspell";
import util from "util";

const DEBUG = true;
const GRID_SIZE = 3;
const tileGrid: Tile[][] = [];
let spell: nspell;

for (let i = 0; i < GRID_SIZE; i++) {
	tileGrid.push([]);
}

export function init() {
	dictionaryEn(getGoodBoard);
}

/**
 * Meant to be passed as a callback to the dictionary-en library
 * @param error Error returned by dictionary-en
 * @param dict Dictionary object returned by dictionary-en
 */
async function getGoodBoard(error: any, dict: any) {
	if (error) throw error;
	spell = nspell(dict);

	let boardWords = new Set<string>();

	while (boardWords.size < 1) {
		if (DEBUG) {
			console.log("generating new board...");
		}

		for (let row = 0; row < GRID_SIZE; row++) {
			for (let col = 0; col < GRID_SIZE; col++) {
				tileGrid[row][col] = {
					letter: letterGenerator.random(),
					row: row,
					col: col,
				};
			}
		}

		// get all the words in the board
		boardWords = await getWordsRecursion();
		if (DEBUG) {
			// eslint-disable-next-line no-console
			console.log(boardWords);
		}
	}

	if (DEBUG) {
		// eslint-disable-next-line no-console
		console.log(tileGrid);
	}
}

async function getWordsRecursion() {
	const boardWords = new Set<string>();
	for (const destTile of tileGrid.flat()) {
		const foundWords = new Set<string>();
		getWordsRecursionHelper(destTile, new Set<Tile>(), "", foundWords);
		console.log(`found for ${destTile.letter}:`);
		console.log(foundWords);
		foundWords.forEach((foundWord) => boardWords.add(foundWord));
	}

	return boardWords;
}

function getWordsRecursionHelper(
	source: Tile,
	visited: Set<Tile>,
	word: string,
	foundWords: Set<string>
) {
	visited.add(source);
	word += source.letter;
	if (word.length >= 3 && spell.correct(word.toLowerCase())) {
		foundWords.add(word);
	}

	for (const neighbor of getTileNeighbors(source.row, source.col)) {
		if (!visited.has(neighbor)) {
			getWordsRecursionHelper(neighbor, visited, word, foundWords);
		}
	}

	word = word[word.length - 1];
	visited.delete(source);
}

function getTileNeighbors(row: number, col: number) {
	const neighbors: Tile[] = [];
	for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
		for (let colOffset = -1; colOffset <= 1; colOffset++) {
			// don't add self as neighbor
			if (!(rowOffset == 0 && colOffset == 0)) {
				const neighborRow = row + rowOffset;
				const neighborCol = col + colOffset;
				if (
					neighborRow >= 0 &&
					neighborRow < GRID_SIZE &&
					neighborCol >= 0 &&
					neighborCol < GRID_SIZE
				) {
					neighbors.push(tileGrid[neighborRow][neighborCol]);
				}
			}
		}
	}

	return neighbors;
}
