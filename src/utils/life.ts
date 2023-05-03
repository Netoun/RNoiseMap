import { Tile } from "./generate";

export const isAlive = (
  x: number,
  y: number,
  TILES_X: number,
  TILES_Y: number,
  BOARD: Tile[][]
): number => {
  if (x < 0 || x >= TILES_X || y < 0 || y >= TILES_Y) {
    return 0;
  }
  return BOARD[x][y] ? 1 : 0;
};

export const neighboursCount = (
  x: number,
  y: number,
  TILES_X: number,
  TILES_Y: number,
  BOARD: Tile[][]
): number => {
  let count = 0;
  for (const i of [-1, 0, 1]) {
    for (const j of [-1, 0, 1]) {
      if (!(i === 0 && j === 0)) {
        count += isAlive(x + i, y + j, TILES_X, TILES_Y, BOARD);
      }
    }
  }
  return count;
};
