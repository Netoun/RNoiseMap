import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as React from "react";
import {
  ChunkPosition,
  TILE_SIZE,
  Tile,
  calculateVisibleChunks,
  generateMapGround,
  getColor,
} from "../../utils/generate";
import { CHUNK_SIZE } from "../../utils/generate";
import { useDebounce } from "../../hooks/useDebounce";

const SPEED = 0.1;
const VIEWPORT_PADDING = 2;
const CHUNK_CACHE_SIZE = 100;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_SPEED = 0.1;

type ChunkCache = Map<string, Tile[][]>;

const isChunkVisible = (chunk: Tile[][], offset: {x: number, y: number}, width: number, height: number, zoom: number) => {
  const chunkX = chunk[0][0].x * TILE_SIZE;
  const chunkY = chunk[0][0].y * TILE_SIZE;
  const chunkSize = CHUNK_SIZE * TILE_SIZE;
  
  const scaledWidth = width / zoom;
  const scaledHeight = height / zoom;
  const scaledOffsetX = offset.x * TILE_SIZE;
  const scaledOffsetY = offset.y * TILE_SIZE;
  
  return (
    chunkX + chunkSize + scaledOffsetX >= -VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkX + scaledOffsetX <= scaledWidth + VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkY + chunkSize + scaledOffsetY >= -VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkY + scaledOffsetY <= scaledHeight + VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE
  );
};

const NativeMap = () => {
  const canvasTerrainRef = useRef<HTMLCanvasElement>(null);

  const [chunks, setChunks] = useState<Map<string, Tile[][]>>(new Map());

  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isMoving, setIsMoving] = useState(false);
  const [coordinatesMouse, setCoordinatesMouse] = useState({
    x: 0,
    y: 0,
  });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [lastRenderTime, setLastRenderTime] = useState(0);

  const generateChunk = useCallback((chunkPosition?: ChunkPosition) => {
    const offset = chunkPosition
      ? {
          x: chunkPosition.x * CHUNK_SIZE,
          y: chunkPosition.y * CHUNK_SIZE,
        }
      : undefined;

    return generateMapGround(offset);
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const now = performance.now();
    if (now - lastRenderTime < 16) {
      return;
    }
    setLastRenderTime(now);

    const { movementX, movementY, clientX, clientY } = event;
    const rect = canvasTerrainRef?.current?.getBoundingClientRect();

    if (!rect) return;

    if (event.buttons === 1) {
      setOffset(prevTranslate => {
        const newX = Math.round(prevTranslate.x + Math.round((movementX * SPEED) / zoom));
        const newY = Math.round(prevTranslate.y + Math.round((movementY * SPEED) / zoom));

        requestAnimationFrame(() => {
          setCoordinatesMouse({
            x: Math.floor((clientX - rect.left) / (TILE_SIZE * zoom)) - newX,
            y: Math.floor((clientY - rect.top) / (TILE_SIZE * zoom)) - newY,
          });
        });

        return { x: newX, y: newY };
      });
    } else if (!isMoving) {
      requestAnimationFrame(() => {
        setCoordinatesMouse({
          x: Math.floor((clientX - rect.left) / (TILE_SIZE * zoom)) - offset.x,
          y: Math.floor((clientY - rect.top) / (TILE_SIZE * zoom)) - offset.y,
        });
      });
    }
  }, [isMoving, offset.x, offset.y, lastRenderTime, zoom]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    setZoom(prevZoom => {
      const delta = event.deltaY < 0 ? ZOOM_SPEED : -ZOOM_SPEED;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom + delta));
      
      if (newZoom !== prevZoom) {
        const rect = canvasTerrainRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = event.clientX - rect.left;
          const mouseY = event.clientY - rect.top;
          
          setOffset(prev => ({
            x: prev.x - (mouseX / (TILE_SIZE * prevZoom) - mouseX / (TILE_SIZE * newZoom)),
            y: prev.y - (mouseY / (TILE_SIZE * prevZoom) - mouseY / (TILE_SIZE * newZoom))
          }));
        }
      }
      
      return newZoom;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasTerrainRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      setContext(ctx);
    }

    return () => {
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, []);

  useEffect(() => {
    if (!context) return;

    const startTime = performance.now();
    
    context.save();
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    
    context.scale(zoom, zoom);
    context.translate(offset.x * TILE_SIZE, offset.y * TILE_SIZE);
    
    const visibleChunks = Array.from(chunks.values()).filter(chunk => 
      isChunkVisible(chunk, offset, window.innerWidth, window.innerHeight, zoom)
    );

    visibleChunks.forEach(chunk => {
      // Draw tiles first
      const flatChunk = chunk.flat();
      let currentColor = '';
      
      flatChunk.forEach(tile => {
        const newColor = getColor(tile.biome, tile.values[0]);
        if (newColor !== currentColor) {
          context.fillStyle = newColor;
          currentColor = newColor;
        }
        context.fillRect(tile.posX, tile.posY, tile.w, tile.h);
      });

      // Draw chunk border immediately after its tiles
      const position = chunk[0][0];
      context.strokeStyle = "red";
      context.lineWidth = 1;
      context.strokeRect(
        position.x * TILE_SIZE,
        position.y * TILE_SIZE,
        TILE_SIZE * CHUNK_SIZE,
        TILE_SIZE * CHUNK_SIZE
      );
    });

    context.restore();

    if (import.meta.env.DEV) {
      console.log(`Render time: ${performance.now() - startTime}ms`);
    }
  }, [chunks, context, offset, zoom]);

  const getChunkKey = (x: number, y: number) => `${x},${y}`;

  useEffect(() => {
    const visibleChunks = calculateVisibleChunks({
      height: window.innerHeight / zoom,
      width: window.innerWidth / zoom,
      x: offset.x,
      y: offset.y,
    });

    const missingChunks = visibleChunks.filter(chunk => {
      const key = getChunkKey(chunk.x, chunk.y);
      return !chunks.has(key);
    });

    if (missingChunks.length === 0) return;

    // Générer les nouveaux chunks
    const newChunks = new Map(chunks);
    missingChunks.forEach(chunk => {
      const key = getChunkKey(chunk.x, chunk.y);
      newChunks.set(key, generateChunk(chunk));
    });

    // Nettoyer les chunks non visibles si nécessaire
    if (newChunks.size > CHUNK_CACHE_SIZE) {
      const visibleKeys = new Set(
        visibleChunks.map(chunk => getChunkKey(chunk.x, chunk.y))
      );
      
      // Supprimer les chunks non visibles les plus anciens
      Array.from(newChunks.keys())
        .filter(key => !visibleKeys.has(key))
        .slice(0, newChunks.size - CHUNK_CACHE_SIZE)
        .forEach(key => newChunks.delete(key));
    }

    setChunks(newChunks);
  }, [offset.x, offset.y, generateChunk, zoom]);

  const handleMouseDown = useCallback(() => setIsMoving(true), []);
  const handleMouseUp = useCallback(() => setIsMoving(false), []);

  const chunksDebounced = useDebounce(chunks, 200);
  const coordinatesMouseDebounced = useDebounce(coordinatesMouse, 200);

  const currentTile = useMemo(() => {
    const allTiles = Array.from(chunksDebounced.values())
      .flatMap(chunk => chunk.flat())
      .find((tile) => {
        return (
          tile.x === coordinatesMouseDebounced.x &&
          tile.y === coordinatesMouseDebounced.y
        );
      });

    return allTiles;
  }, [chunksDebounced, coordinatesMouseDebounced]);

  return (
    <div className="w-full h-full relative bg-[rgba(0,0,0,0.4)]">
      <header className="fixed inset-x-0 top-4 z-20 px-4">
        <div className="mx-auto max-w-3xl bg-black/40 backdrop-blur-md rounded-2xl p-3 flex items-center gap-6 border border-white/5">
          <div className="text-sm text-white/70">
            <span>x: {coordinatesMouse.x}</span>
            <span className="mx-1">·</span>
            <span>y: {coordinatesMouse.y}</span>
          </div>

          <div className="flex-1 text-center font-light text-white/90">
            Procedural Map
          </div>

          <div className="text-sm text-white/70 capitalize">
            Biome: {currentTile?.biome || '—'}
          </div>
        </div>
      </header>

      <div className="flex items-center justify-center relative z-10">
        <canvas
          ref={canvasTerrainRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isMoving ? "grabbing" : "grab" }}
          className="z-20 [image-rendering:crisp-edges] my-auto rounded-lg shadow-[0_2px_10px_-3px_rgba(0,0,0,0.2)]"
        />
      </div>
    </div>
  );
};

export default NativeMap;
