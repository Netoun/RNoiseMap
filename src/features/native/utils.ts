import { CHUNK_SIZE, createTileGroupMatrix, getColor, TILE_SIZE } from "../../utils/generate";
import { CONFIG } from "./config";
import { Tile, TransformMatrix } from "./types";

/**
 * Determines if a chunk is currently visible in the viewport
 */
export const isChunkVisible = (
  chunk: Tile[][], 
  offset: {x: number, y: number}, 
  width: number, 
  height: number, 
  zoom: number
): boolean => {
  const chunkX = chunk[0][0].x * TILE_SIZE;
  const chunkY = chunk[0][0].y * TILE_SIZE;
  const chunkSize = CHUNK_SIZE * TILE_SIZE;
  
  const scaledWidth = width / zoom;
  const scaledHeight = height / zoom;
  const scaledOffsetX = offset.x * TILE_SIZE;
  const scaledOffsetY = offset.y * TILE_SIZE;
  
  return (
    chunkX + chunkSize + scaledOffsetX >= -CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkX + scaledOffsetX <= scaledWidth + CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkY + chunkSize + scaledOffsetY >= -CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkY + scaledOffsetY <= scaledHeight + CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE
  );
};

/**
 * Gets initial map position and zoom values from URL parameters
 */
export const getInitialValues = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    zoom: Number(Number(params.get('zoom')).toFixed(1)) || 1,
    x: Math.round(Number(params.get('x'))) || 0,
    y: Math.round(Number(params.get('y'))) || 0
  };
};

/**
 * Creates an array of Web Workers for map generation.
 */
export const createMapWorkers = (): Worker[] => {
  return Array.from({ length: CONFIG.WORKER_COUNT }, () => 
    new Worker(new URL('../../workers/mapWorker.ts', import.meta.url), {
      type: 'module'
    })
  );
};

export const cleanMapWorkers = (workers: Worker[]) => {
  workers.forEach(worker => {
    worker.terminate();
  });
};

// Cache for transform matrices
const transformCache = new Map<string, TransformMatrix>();

export const createTransformMatrix = (zoom: number, offsetX: number, offsetY: number): TransformMatrix => {
  const key = `${zoom}_${offsetX}_${offsetY}`;
  if (transformCache.has(key)) {
    return transformCache.get(key)!;
  }
  
  const matrix = {
    a: zoom,
    b: 0,
    c: 0,
    d: zoom,
    e: offsetX * TILE_SIZE * zoom,
    f: offsetY * TILE_SIZE * zoom
  };
  
  transformCache.set(key, matrix);
  return matrix;
};

// Cache for tile groups
export const tileGroupCache = new Map<string, Map<string, Tile[]>>();

export const getTileGroups = (chunk: Tile[][], tileScale: number): Map<string, Tile[]> => {
  const key = `${chunk[0][0].x}_${chunk[0][0].y}_${tileScale}`;
  
  if (tileGroupCache.has(key)) {
    return tileGroupCache.get(key)!;
  }

  const groupedTiles = createTileGroupMatrix(chunk, tileScale);
  const colorGroups = new Map<string, Tile[]>();
  
  groupedTiles.forEach(row => {
    row.forEach(tile => {
      const color = getColor(tile.biome, tile.values[0]);
      if (!colorGroups.has(color)) {
        colorGroups.set(color, []);
      }
      colorGroups.get(color)!.push(tile);
    });
  });

  tileGroupCache.set(key, colorGroups);
  return colorGroups;
};

export const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

export const getChunkKey = (x: number, y: number) => `${x},${y}`; 