import Letter from "./frequency/Letter";
import FrequencyType from "./frequency/FrequencyType";
import LetterData from "./frequency/data/en-GB";

export interface IRandomNumberGenerator {
  Random(): number;
}

class RandomPercentageGenerator implements IRandomNumberGenerator {
  Random(): number {
    return this._getRandomNumber(0, 100000) / 1000;
  }

  _getRandomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}

interface ICumulativeFrequency {
  Letter: string;
  CumulativeFrequency: number;
}

class LetterFrequency {
  private _randomNumberGenerator: IRandomNumberGenerator;
  private _frequencies: Array<ICumulativeFrequency>;

  public get frequencies(): Array<ICumulativeFrequency> {
    return this._frequencies.slice(0).reverse();
  }

  constructor(
    type: FrequencyType,
    randomNumberGenerator: IRandomNumberGenerator | undefined = undefined
  ) {
    this._randomNumberGenerator =
      randomNumberGenerator || new RandomPercentageGenerator();
    let cumulativeFrequency = 100;
    this._frequencies = LetterData.slice(0)
      .reverse()
      .map((e: Letter) => {
        const frequency =
          type == FrequencyType.Dictionary
            ? e.DictionaryFrequency
            : e.TextFrequency;

        const letter = {
          Letter: e.Letter,
          CumulativeFrequency: cumulativeFrequency,
        };

        //.. calculate for next letter
        cumulativeFrequency =
          Math.round(
            (cumulativeFrequency - frequency + Number.EPSILON) * 1000
          ) / 1000;

        return letter;
      });
  }

  random = (): string => {
    const rnd: number = this._randomNumberGenerator.Random();
    return this._frequencies
      .reduce((acc: string, current: ICumulativeFrequency) => {
        if (rnd <= current.CumulativeFrequency) {
          acc = current.Letter;
        }
        return acc;
      }, "A");
  };
}

export class DictionaryFrequency extends LetterFrequency {
  constructor(
    randomNumberGenerator: IRandomNumberGenerator | undefined = undefined
  ) {
    super(FrequencyType.Dictionary, randomNumberGenerator);
  }
}

export class TextFrequency extends LetterFrequency {
  constructor(
    randomNumberGenerator: IRandomNumberGenerator | undefined = undefined
  ) {
    super(FrequencyType.Text, randomNumberGenerator);
  }
}
