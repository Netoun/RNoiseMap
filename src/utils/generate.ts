import alea from "alea";
import { NoiseFunction2D, createNoise2D } from "simplex-noise";

import { HSL } from "three";

let noise2DHeight: NoiseFunction2D;
let noise2DMoisture: NoiseFunction2D;
let noise2DHeat: NoiseFunction2D;
let noise2DRivers: NoiseFunction2D;
let noise2DRegions: NoiseFunction2D;

const biomeCache = new Map<string, Biome>();
const colorCache = new Map<string, string>();

export function initializeNoise(seed: string) {
  const seedHeight = alea(seed + "_height");
  const seedMoisture = alea(seed + "_moisture");
  const seedHeat = alea(seed + "_heat");
  const seedRivers = alea(seed + "_rivers");
  const seedRegions = alea(seed + "_regions");
  
  noise2DHeight = createNoise2D(seedHeight);
  noise2DMoisture = createNoise2D(seedMoisture);
  noise2DHeat = createNoise2D(seedHeat);
  noise2DRivers = createNoise2D(seedRivers);
  noise2DRegions = createNoise2D(seedRegions);
}

export const CHUNK_SIZE = 50;
export const TILE_SIZE = 10;

export interface ChunkPosition {
  x: number;
  y: number;
}

export type Biome =
  | "deep_ocean"
  | "shallow_ocean"
  | "desert"
  | "savanna"
  | "forest"
  | "rainforest"
  | "grassland"
  | "jungle"
  | "mountains"
  | "snow_mountains"
  | "tundra"
  | "beach"
  | "ice"
  | "river"
  | "lake";

export const BiomePreset: {
  [key in Biome]: {
    minHeight: number;
    minMoisture: number;
    minHeat: number;
    maxHeight?: number;
  };
} = {
  deep_ocean: {
    minHeight: -1,
    maxHeight: -0.5,
    minMoisture: -1,
    minHeat: -1,
  },
  shallow_ocean: {
    minHeight: -0.5,
    maxHeight: -0.1,
    minMoisture: -1,
    minHeat: -1,
  },
  desert: {
    minHeight: 0.2,
    minMoisture: -0.5,
    minHeat: 0.6,
  },
  savanna: {
    minHeight: 0.1,
    minMoisture: -0.2,
    minHeat: 0.4,
  },
  forest: {
    minHeight: 0.1,
    minMoisture: 0.2,
    minHeat: -0.4,
  },
  rainforest: {
    minHeight: 0.1,
    minMoisture: 0.6,
    minHeat: 0.2,
  },
  grassland: {
    minHeight: 0.1,
    minMoisture: -0.6,
    minHeat: -0.6,
  },
  jungle: {
    minHeight: 0.1,
    minMoisture: 0.4,
    minHeat: 0.2,
  },
  mountains: {
    minHeight: 0.4,
    minMoisture: -1,
    minHeat: -0.2,
  },
  snow_mountains: {
    minHeight: 0.5,
    minMoisture: -1,
    minHeat: -0.8,
  },
  tundra: {
    minHeight: 0.2,
    minMoisture: 0.8,
    minHeat: -0.8,
  },
  beach: {
    minHeight: -0.1,
    maxHeight: 0.1,
    minMoisture: -1,
    minHeat: -1,
  },
  ice: {
    minHeight: -0.1,
    minMoisture: -1,
    minHeat: -0.9,
  },
  river: {
    minHeight: -0.2,
    maxHeight: 0.3,
    minMoisture: 0.3,
    minHeat: -1,
  },
  lake: {
    minHeight: -0.3,
    maxHeight: 0.1,
    minMoisture: 0.4,
    minHeat: -1,
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
  deep_ocean: { h: 200, s: 70, l: 35 },
  shallow_ocean: { h: 200, s: 70, l: 45 },
  ice: { h: 200, s: 20, l: 85 },
  grassland: { h: 100, s: 60, l: 40 },
  desert: { h: 35, s: 80, l: 75 },
  savanna: { h: 50, s: 70, l: 45 },
  beach: { h: 45, s: 70, l: 70 },
  mountains: { h: 0, s: 30, l: 60 },
  snow_mountains: { h: 0, s: 10, l: 80 },
  forest: { h: 120, s: 70, l: 25 },
  rainforest: { h: 140, s: 80, l: 15 },
  jungle: { h: 140, s: 80, l: 20 },
  tundra: { h: 200, s: 25, l: 75 },
  river: { h: 210, s: 70, l: 50 },
  lake: { h: 200, s: 60, l: 40 },
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
  const loadedChunksSet = new Set(
    loadedChunks.map(chunk => `${chunk.x}_${chunk.y}`)
  );

  return visibleChunks.filter(chunk => {
    const key = `${chunk.x * -CHUNK_SIZE}_${chunk.y * -CHUNK_SIZE}`;
    return !loadedChunksSet.has(key);
  });
}

export function getBiome(
  height: number,
  moisture: number,
  heat: number,
  x: number,
  y: number
): Biome {
  const cacheKey = `${height.toFixed(3)}_${moisture.toFixed(3)}_${heat.toFixed(3)}_${x}_${y}`;
  
  const cached = biomeCache.get(cacheKey);
  if (cached) return cached;

  let result: Biome;

  if (height < -0.5) {
    result = "deep_ocean";
  } else if (height < -0.1) {
    result = "shallow_ocean";
  } else if (isRiver(x, y, moisture)) {
    result = "river";
  } else if (isLake(height, moisture)) {
    result = "lake";
  } else {
    result = "grassland";
    
    for (const [biomeKey, biomePreset] of Object.entries(BiomePreset)) {
      if (["deep_ocean", "shallow_ocean", "river", "lake"].includes(biomeKey)) continue;

      const heightValid = height >= biomePreset.minHeight && 
        (!biomePreset.maxHeight || height <= biomePreset.maxHeight);
      
      if (
        heightValid &&
        moisture >= biomePreset.minMoisture &&
        heat >= biomePreset.minHeat
      ) {
        result = biomeKey as Biome;
        break;
      }
    }
  }

  biomeCache.set(cacheKey, result);
  return result;
}

type BiomeTransition = {
  from: Biome;
  to: Biome;
  blend: number;
};

const TRANSITION_DISTANCE = 0.2;

export const getColor = (biome: Biome, value: number, neighbors?: Tile[]) => {
  if (!neighbors) {
    const baseColor = colors[biome];
    return `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
  }

  const cacheKey = `${biome}_${value}_${neighbors.map(n => n?.biome).join('_')}`;
  const cached = colorCache.get(cacheKey);
  if (cached) return cached;

  const baseColor = colors[biome];
  const transitions: BiomeTransition[] = neighbors
    .filter(n => n && n.biome !== biome)
    .map(n => ({
      from: biome,
      to: n.biome,
      blend: Math.max(0, TRANSITION_DISTANCE - Math.abs(value - n.values[0]))
    }));

  if (transitions.length === 0) {
    const result = `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
    colorCache.set(cacheKey, result);
    return result;
  }

  const strongestTransition = transitions.reduce((prev, curr) => 
    prev.blend > curr.blend ? prev : curr
  );

  const toColor = colors[strongestTransition.to];
  const blendFactor = strongestTransition.blend / TRANSITION_DISTANCE;

  const h = baseColor.h + (toColor.h - baseColor.h) * blendFactor;
  const s = baseColor.s + (toColor.s - baseColor.s) * blendFactor;
  const l = baseColor.l + (toColor.l - baseColor.l) * blendFactor;

  const result = `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  colorCache.set(cacheKey, result);
  return result;
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

function isRiver(x: number, y: number, riverNoise: number): boolean {
  const riverValue = fBm(noise2DRivers, x, y, 4, 0.5, 0.005, 1);
  return Math.abs(riverValue) < 0.05 && riverNoise > 0.3;
}

function isLake(height: number, moisture: number): boolean {
  return height < 0.1 && height > -0.1 && moisture > 0.6;
}

export const generateMapGround = (
  offset: Offset = { x: 0, y: 0 },
  seed: string
): Tile[][] => {
  if (seed) {
    initializeNoise(seed);
  }
  
  const chunk: Tile[][] = [];
  for (let x = 0; x < CHUNK_SIZE; x++) {
    const row: Tile[] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const _x = x - offset.x;
      const _y = y - offset.y;
      
      const height = fBm(noise2DHeight, _x, _y, 8, 0.5, 0.005, 1);
      const moisture = fBm(noise2DMoisture, _x, _y, 4, 0.5, 0.008, 0.7);
      const heat = fBm(noise2DHeat, _x, _y, 6, 0.5, 0.006, 0.8);

      const biome = getBiome(height, moisture, heat, _x, _y);
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