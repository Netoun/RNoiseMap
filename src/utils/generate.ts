import { NoiseFunction2D, createNoise2D } from "simplex-noise";

import alea from "alea";
import { HSL } from "three";

const seedHeight = alea("seedHeight");
const seedMoisture = alea("seedMoisture");
const seedHeat = alea("seedHeat");

const noise2DHeight = createNoise2D(seedHeight);
const noise2DMoisture = createNoise2D(seedMoisture);
const noise2DHeat = createNoise2D(seedHeat);

export const CHUNK_SIZE = 50;
export const TILE_SIZE = 10;

export interface ChunkPosition {
  x: number;
  y: number;
}

export type Biome =
  | "desert"
  | "forest"
  | "grassland"
  | "jungle"
  | "mountains"
  | "ocean"
  | "tundra"
  | "beach"
  | "ice";

export const BiomePreset: {
  [key in Biome]: {
    minHeight: number;
    minMoisture: number;
    minHeat: number;
  };
} = {
  desert: {
    minHeight: 0.2,
    minMoisture: -0.5,
    minHeat: 0.6,
  },
  forest: {
    minHeight: 0.1,
    minMoisture: 0.2,
    minHeat: -0.4,
  },
  grassland: {
    minHeight: 0.1,
    minMoisture: -0.6,
    minHeat: -0.6,
  },
  jungle: {
    minHeight: 0.1,
    minMoisture: 0,
    minHeat: 0.2,
  },
  mountains: {
    minHeight: 0.4,
    minMoisture: -1,
    minHeat: -1,
  },
  ocean: {
    minHeight: 2,
    minMoisture: 2,
    minHeat: 2,
  },
  beach: {
    minHeight: -0.1,
    minMoisture: -1,
    minHeat: -1,
  },
  ice: {
    minHeight: 0,
    minMoisture: -1,
    minHeat: -1,
  },
  tundra: {
    minHeight: 0.2,
    minMoisture: 0.8,
    minHeat: -0.8,
  },
};

export type Offset = {
  x: number;
  y: number;
};

export type Tile = {
  x: number;
  y: number;
  posX: number;
  posY: number;
  h: number;
  w: number;
  values: number[];
  biome: Biome;
  neighbors?: Tile[];
};

export const colors: { [key in Biome]: HSL } = {
  ocean: { h: 200, s: 70, l: 45 },
  ice: { h: 200, s: 20, l: 85 },
  grassland: { h: 100, s: 60, l: 40 },
  desert: { h: 35, s: 80, l: 75 },
  beach: { h: 45, s: 70, l: 70 },
  mountains: { h: 0, s: 30, l: 60 },
  forest: { h: 120, s: 70, l: 25 },
  jungle: { h: 140, s: 80, l: 20 },
  tundra: { h: 200, s: 25, l: 75 },
};

interface ScreenPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function calculateVisibleChunks(
  screen: ScreenPosition
): ChunkPosition[] {
  const GRID_SIZE = CHUNK_SIZE * TILE_SIZE;

  const startX = 1 + Math.floor((screen.x * TILE_SIZE) / GRID_SIZE);
  const endX = Math.floor((screen.x * TILE_SIZE - screen.width) / GRID_SIZE);
  const startY = 1 + Math.floor((screen.y * TILE_SIZE) / GRID_SIZE);
  const endY = Math.floor((screen.y * TILE_SIZE - screen.height) / GRID_SIZE);

  const visibleChunks: ChunkPosition[] = [];
  for (let x = startX; x >= endX; x--) {
    for (let y = startY; y >= endY; y--) {
      visibleChunks.push({
        x,
        y,
      });
    }
  }

  return visibleChunks;
}

export function calculateMissingChunks(
  visibleChunks: ChunkPosition[],
  loadedChunks: ChunkPosition[]
): ChunkPosition[] {
  const missingChunks: ChunkPosition[] = [];
  for (const visibleChunk of visibleChunks) {
    if (
      !loadedChunks.some(
        (loadedChunk) =>
          loadedChunk.x === visibleChunk.x * -CHUNK_SIZE &&
          loadedChunk.y === visibleChunk.y * -CHUNK_SIZE
      )
    ) {
      missingChunks.push(visibleChunk);
    }
  }

  return missingChunks;
}

export function getBiome(
  height: number,
  moisture: number,
  heat: number
): Biome {
  if (height < 0) {
    return "ocean";
  }

  let biome: Biome = "ocean";

  for (const _biomeKey in BiomePreset) {
    const _biome = BiomePreset[_biomeKey as Biome];

    if (_biomeKey === "ocean") {
      continue;
    }

    if (
      (height >= _biome.minHeight ||
        BiomePreset[biome].minHeight <= _biome.minHeight) &&
      (moisture >= _biome.minMoisture ||
        BiomePreset[biome].minMoisture <= _biome.minMoisture) &&
      (heat >= _biome.minHeat || BiomePreset[biome].minHeat <= _biome.minHeat)
    ) {
      biome = _biomeKey as Biome;
      break;
    }
  }

  return (biome ? biome : "ocean") as Biome;
}

type BiomeTransition = {
  from: Biome;
  to: Biome;
  blend: number;
};

const TRANSITION_DISTANCE = 0.2;

export const getColor = (biome: Biome, value: number, neighbors?: Tile[]) => {
  const baseColor = colors[biome];
  
  if (!neighbors) {
    return `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
  }

  const transitions: BiomeTransition[] = neighbors
    .filter(n => n && n.biome !== biome)
    .map(n => ({
      from: biome,
      to: n.biome,
      blend: Math.max(0, TRANSITION_DISTANCE - Math.abs(value - n.values[0]))
    }));

  if (transitions.length === 0) {
    return `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
  }

  const strongestTransition = transitions.reduce((prev, curr) => 
    prev.blend > curr.blend ? prev : curr
  );

  const toColor = colors[strongestTransition.to];
  const blendFactor = strongestTransition.blend / TRANSITION_DISTANCE;

  const h = baseColor.h + (toColor.h - baseColor.h) * blendFactor;
  const s = baseColor.s + (toColor.s - baseColor.s) * blendFactor;
  const l = baseColor.l + (toColor.l - baseColor.l) * blendFactor;

  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
};

export function fBm(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  scale = 0.01,
  amplitude = 0.8,
  frequency = 1,
  total = 0
): number {
  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency * scale, y * frequency * scale) * amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return total;
}

export const generateMapGround = (
  offset: Offset = { x: 0, y: 0 }
): Tile[][] => {
  const chunk = [];
  for (let x = 0; x < CHUNK_SIZE; x++) {
    const row = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const _x = x - offset.x;
      const _y = y - offset.y;
      const height = fBm(noise2DHeight, _x, _y, 8, 0.5);
      const moisture = fBm(noise2DMoisture, _x, _y, 4, 0.5, 0.01, 0.5);
      const heat = fBm(noise2DHeat, _x, _y, 8, 0.5, 0.01, 0.6);

      const biome = getBiome(height, moisture, heat);
      row.push({
        x: _x,
        y: _y,
        posX: _x * TILE_SIZE,
        posY: _y * TILE_SIZE,
        w: TILE_SIZE,
        h: TILE_SIZE,
        values: [height, moisture, heat],
        biome: biome,
      });
    }
    chunk.push(row);
  }

  return chunk;
};

// export const generateMapLife = (
//   xSize: number,
//   ySize: number,
//   offset: Offset,
//   border: number
// ) => {
//   return Array.from({ length: xSize }).map((_, x) => {
//     return Array.from({ length: ySize }).map((_, y) => {
//       const _x = x - border;
//       const _y = y - border;
//       const valueGround = fBm(_x - offset.x, _y - offset.y, 8, 0.5);

//       const biome = getBiome(value);

//       return {
//         x: _x,
//         y: _y,
//         posX: _x * TILE_SIZE,
//         posY: _y * TILE_SIZE,
//         w: TILE_SIZE,
//         h: TILE_SIZE,
//         value: value,
//         biome: biome,
//       };
//     });
//   });
// };
