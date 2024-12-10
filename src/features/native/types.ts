import { ChunkPosition, DEFAULT_GENERATION_PARAMS, Biome } from "../../utils/generate";

export interface TouchInfo {
  x: number;
  y: number;
  distance?: number;
}

export interface WorkerMessage {
  type: 'chunkGenerated';
  payload: {
    chunk: Tile[][];
    position: ChunkPosition;
  };
}

export interface NativeMapProps { 
  seed: string;
  generationParams: typeof DEFAULT_GENERATION_PARAMS;
  onReady?: () => void;
}

export interface MapState {
  offset: { x: number; y: number };
  zoom: number;
  isMoving: boolean;
  coordinatesMouse: { x: number; y: number };
  lastRenderTime: number;
  lastTouch: TouchInfo | null;
  initialPinchDistance: number | null;
  targetOffset: { x: number; y: number };
  animationFrameId: number | null;
}

export type MapAction = 
  | { type: 'SET_OFFSET'; payload: { x: number; y: number } }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_MOVING'; payload: boolean }
  | { type: 'SET_COORDINATES'; payload: { x: number; y: number } }
  | { type: 'SET_RENDER_TIME'; payload: number }
  | { type: 'SET_TOUCH'; payload: TouchInfo | null }
  | { type: 'SET_PINCH_DISTANCE'; payload: number | null }
  | { type: 'SET_TARGET_OFFSET'; payload: { x: number; y: number } }
  | { type: 'SET_ANIMATION_FRAME'; payload: number | null };

export interface AnimationState {
  targetX: number;
  targetY: number;
  frameId: number | null;
}

export interface TransformMatrix {
  a: number; // scale X
  b: number; // skew Y
  c: number; // skew X
  d: number; // scale Y
  e: number; // translate X
  f: number; // translate Y
}

export interface Tile {
  x: number;
  y: number;
  posX: number;
  posY: number;
  w: number;
  h: number;
  biome: Biome;
  values: number[];
} 