import alea from "alea";
import { NoiseFunction2D, createNoise2D } from "simplex-noise";

import { HSL } from "three";

let noise2DHeight: NoiseFunction2D;
let noise2DMoisture: NoiseFunction2D;
let noise2DHeat: NoiseFunction2D;
let noise2DRivers: NoiseFunction2D;
const biomeCache = new Map<string, Biome>();
const colorCache = new Map<string, string>();



export const DEFAULT_GENERATION_PARAMS = {
  octaves: 8,
  persistence: 0.5,
  scale: 0.005,
  amplitude: 1,
  frequency: 1,
} 



export function initializeNoise(seed: string) {
  const seedHeight = alea(seed + "_height");
  const seedMoisture = alea(seed + "_moisture");
  const seedHeat = alea(seed + "_heat");
  const seedRivers = alea(seed + "_rivers");
  
  noise2DHeight = createNoise2D(seedHeight);
  noise2DMoisture = createNoise2D(seedMoisture);
  noise2DHeat = createNoise2D(seedHeat);
  noise2DRivers = createNoise2D(seedRivers);
}

export const CHUNK_SIZE = 60;
export const TILE_SIZE = 6;

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

/**
 * Fractal Brownian Motion (fBm) - Creates natural-looking noise by combining multiple octaves
 * @param noise - The base noise function to use
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param octaves - Number of noise layers to combine
 * @param persistence - How much each octave's amplitude decreases
 * @param scale - Base scale of the noise
 * @param amplitude - Initial amplitude
 * @param frequency - Initial frequency
 * @param total - Accumulator for the noise value
 * @returns Combined noise value between -1 and 1
 */
export function fBm(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  octaves = DEFAULT_GENERATION_PARAMS.octaves,
  persistence = DEFAULT_GENERATION_PARAMS.persistence,
  scale = DEFAULT_GENERATION_PARAMS.scale,
  amplitude = DEFAULT_GENERATION_PARAMS.amplitude,
  frequency = DEFAULT_GENERATION_PARAMS.frequency,
  total = 0
): number {
  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency * scale, y * frequency * scale) * amplitude;
    amplitude *= persistence;  // Reduce amplitude for each octave
    frequency *= 2;           // Double frequency for each octave
  }
  return total;
}

/**
 * Determines the biome type based on height, moisture, and heat values
 * @param height - Terrain elevation (-1 to 1)
 * @param moisture - Moisture level (-1 to 1)
 * @param heat - Temperature (-1 to 1)
 * @param x - X coordinate for river checking
 * @param y - Y coordinate for river checking
 * @returns The determined biome type
 */
export function getBiome(
  height: number,
  moisture: number,
  heat: number,
  x: number,
  y: number
): Biome {
  // Create cache key for performance
  const cacheKey = `${height.toFixed(3)}_${moisture.toFixed(3)}_${heat.toFixed(3)}_${x}_${y}`;
  
  // Check cache first
  const cached = biomeCache.get(cacheKey);
  if (cached) return cached;

  let result: Biome;

  // Determine biome based on height first
  if (height < -0.5) {
    result = "deep_ocean";
  } else if (height < -0.1) {
    result = "shallow_ocean";
  } else if (isRiver(x, y, moisture)) {
    result = "river";
  } else if (isLake(height, moisture)) {
    result = "lake";
  } else {
    // Default to grassland
    result = "grassland";
    
    // Check against all biome presets
    for (const [biomeKey, biomePreset] of Object.entries(BiomePreset)) {
      // Skip water biomes as they're handled above
      if (["deep_ocean", "shallow_ocean", "river", "lake"].includes(biomeKey)) continue;

      const heightValid = height >= biomePreset.minHeight && 
        (!biomePreset.maxHeight || height <= biomePreset.maxHeight);
      
      // Check if current position matches biome requirements
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

  // Cache and return result
  biomeCache.set(cacheKey, result);
  return result;
}

type BiomeTransition = {
  from: Biome;
  to: Biome;
  blend: number;
};

const TRANSITION_DISTANCE = 0.2;

/**
 * Generates a color for a tile, including biome transitions
 * @param biome - The tile's biome
 * @param value - The tile's height value
 * @param neighbors - Adjacent tiles for blending colors
 * @returns HSL color string
 */
export const getColor = (biome: Biome, value: number, neighbors?: Tile[]) => {
  // If no neighbors, return base color
  if (!neighbors) {
    const baseColor = colors[biome];
    return `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
  }

  // Check cache
  const cacheKey = `${biome}_${value}_${neighbors.map(n => n?.biome).join('_')}`;
  const cached = colorCache.get(cacheKey);
  if (cached) return cached;

  const baseColor = colors[biome];
  
  // Calculate transitions to different biomes
  const transitions: BiomeTransition[] = neighbors
    .filter(n => n && n.biome !== biome)
    .map(n => ({
      from: biome,
      to: n.biome,
      blend: Math.max(0, TRANSITION_DISTANCE - Math.abs(value - n.values[0]))
    }));

  // If no transitions, return base color
  if (transitions.length === 0) {
    const result = `hsl(${baseColor.h}, ${baseColor.s}%, ${baseColor.l}%)`;
    colorCache.set(cacheKey, result);
    return result;
  }

  // Find strongest transition
  const strongestTransition = transitions.reduce((prev, curr) => 
    prev.blend > curr.blend ? prev : curr
  );

  // Blend colors based on transition strength
  const toColor = colors[strongestTransition.to];
  const blendFactor = strongestTransition.blend / TRANSITION_DISTANCE;

  const h = baseColor.h + (toColor.h - baseColor.h) * blendFactor;
  const s = baseColor.s + (toColor.s - baseColor.s) * blendFactor;
  const l = baseColor.l + (toColor.l - baseColor.l) * blendFactor;

  const result = `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  colorCache.set(cacheKey, result);
  return result;
};

function isRiver(x: number, y: number, riverNoise: number): boolean {
  const riverValue = fBm(noise2DRivers, x, y, 4, 0.5, 0.005, 1);
  return Math.abs(riverValue) < 0.05 && riverNoise > 0.3;
}

function isLake(height: number, moisture: number): boolean {
  return height < 0.1 && height > -0.1 && moisture > 0.6;
}

/**
 * Generates a chunk of the map
 * @param offset - Position offset for the chunk
 * @param seed - Seed for noise generation
 * @returns 2D array of tiles
 */
export const generateMapGround = (
  offset: Offset = { x: 0, y: 0 },
  seed: string,
  generationParams?: typeof DEFAULT_GENERATION_PARAMS
): Tile[][] => {
  // Initialize noise if seed provided
  if (seed) {
    initializeNoise(seed);
  }
  
  const chunk: Tile[][] = [];
  // Generate tiles for the chunk
  for (let x = 0; x < CHUNK_SIZE; x++) {
    const row: Tile[] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const _x = x - offset.x;
      const _y = y - offset.y;

      const { octaves, persistence, scale, amplitude, frequency } = generationParams || DEFAULT_GENERATION_PARAMS;
      
      // Generate terrain features using fBm noise  
      const height = fBm(noise2DHeight, _x, _y, octaves, persistence, scale, amplitude, frequency);
      const moisture = fBm(noise2DMoisture, _x, _y, octaves, persistence, scale, amplitude, frequency);
      const heat = fBm(noise2DHeat, _x, _y, octaves, persistence, scale, amplitude, frequency);

      // Create tile with calculated values
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

export const getBiomeByCoords = (x: number, y: number): Biome => {
  const height = fBm(noise2DHeight, x, y, 8, 0.5, 0.005, 1);
  const moisture = fBm(noise2DMoisture, x, y, 4, 0.5, 0.008, 0.7);
  const heat = fBm(noise2DHeat, x, y, 6, 0.5, 0.006, 0.8);

  return getBiome(height, moisture, heat, x, y);
};

export const createTileGroupMatrix = (chunk: Tile[][], tileScale: number): Tile[][] => {
  const matrixSize = Math.ceil(CHUNK_SIZE / tileScale);
  const matrix: Tile[][] = Array(matrixSize).fill(null).map(() => Array(matrixSize).fill(null));
  
  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      const baseX = x * tileScale;
      const baseY = y * tileScale;
      
      // Calculer les valeurs moyennes pour le groupe
      let totalHeight = 0;
      let totalMoisture = 0;
      let totalHeat = 0;
      let count = 0;
      
      for (let dy = 0; dy < tileScale && baseY + dy < CHUNK_SIZE; dy++) {
        for (let dx = 0; dx < tileScale && baseX + dx < CHUNK_SIZE; dx++) {
          const tile = chunk[baseY + dy][baseX + dx];
          totalHeight += tile.values[0];
          totalMoisture += tile.values[1];
          totalHeat += tile.values[2];
          count++;
        }
      }
      
      const avgHeight = totalHeight / count;
      const avgMoisture = totalMoisture / count;
      const avgHeat = totalHeat / count;
      
      // Créer une tuile regroupée
      matrix[y][x] = {
        ...chunk[baseY][baseX],
        values: [avgHeight, avgMoisture, avgHeat],
        w: TILE_SIZE * tileScale,
        h: TILE_SIZE * tileScale
      };
    }
  }
  
  return matrix;
};
