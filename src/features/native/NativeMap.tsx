import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  TouchEvent,
} from "react";
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
const TOUCH_SPEED = 0.15;
const MIN_PINCH_DISTANCE = 50;

type TouchInfo = {
  x: number;
  y: number;
  distance?: number;
};

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

const getInitialValues = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    zoom: Number(Number(params.get('zoom')).toFixed(1)) || 1,
    x: Math.round(Number(params.get('x'))) || 0,
    y: Math.round(Number(params.get('y'))) || 0
  };
};

type NativeMapProps = { 
  seed: string;
};

const NativeMap = ({ seed }: NativeMapProps) => {
  const initialValues = getInitialValues();
  const canvasTerrainRef = useRef<HTMLCanvasElement>(null);

  const [chunks, setChunks] = useState<Map<string, Tile[][]>>(new Map());

  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [zoom, setZoom] = useState(initialValues.zoom);
  const [isMoving, setIsMoving] = useState(false);
  const [coordinatesMouse, setCoordinatesMouse] = useState({
    x: initialValues.x,
    y: initialValues.y,
  });
  const [offset, setOffset] = useState({ x: initialValues.x, y: initialValues.y });
  const [lastRenderTime, setLastRenderTime] = useState(0);
  const [lastTouch, setLastTouch] = useState<TouchInfo | null>(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);

  const generateChunk = useCallback((chunkPosition?: ChunkPosition) => {
    const offset = chunkPosition
      ? {
          x: chunkPosition.x * CHUNK_SIZE,
          y: chunkPosition.y * CHUNK_SIZE,
        }
      : undefined;

    return generateMapGround(offset, seed);
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

    requestAnimationFrame(() => {
      setCoordinatesMouse({
        x: Math.floor((clientX - rect.left) / (TILE_SIZE * zoom)) - offset.x,
        y: Math.floor((clientY - rect.top) / (TILE_SIZE * zoom)) - offset.y,
      });
    });

    if (event.buttons === 1) {
      setOffset(prevTranslate => ({
        x: Math.round(prevTranslate.x + Math.round((movementX * SPEED) / zoom)),
        y: Math.round(prevTranslate.y + Math.round((movementY * SPEED) / zoom))
      }));
    }
  }, [lastRenderTime, zoom, offset.x, offset.y]);

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
            x: Math.round(prev.x - (mouseX / (TILE_SIZE * prevZoom) - mouseX / (TILE_SIZE * newZoom))),
            y: Math.round(prev.y - (mouseY / (TILE_SIZE * prevZoom) - mouseY / (TILE_SIZE * newZoom)))
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

  const handleMouseDown = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setIsMoving(true);
  }, []);

  const handleMouseUp = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setIsMoving(false);
  }, []);

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



  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    params.set('zoom', zoom.toFixed(1));
    params.set('x', Math.round(offset.x).toString());
    params.set('y', Math.round(offset.y).toString());
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [zoom, offset.x, offset.y]);

  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((event: TouchEvent<HTMLCanvasElement>) => {
    
    event.preventDefault();
    setIsMoving(true);
    
    if (event.touches.length === 2) {
      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      setInitialPinchDistance(distance);
      setLastTouch({
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
        distance,
      });
    } else {
      setInitialPinchDistance(null);
      setLastTouch({
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      });
    }
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    if (!lastTouch) return;

    if (event.touches.length === 2 && initialPinchDistance) {
      // Handle pinch zoom
      const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
      const deltaDistance = currentDistance - lastTouch.distance!;
      
      if (Math.abs(deltaDistance) > MIN_PINCH_DISTANCE) {
        const zoomDelta = deltaDistance > 0 ? ZOOM_SPEED : -ZOOM_SPEED;
        setZoom(prev => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + zoomDelta)));
      }

      // Handle pan during pinch
      const currentX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const currentY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      const deltaX = currentX - lastTouch.x;
      const deltaY = currentY - lastTouch.y;

      setOffset(prev => ({
        x: prev.x + Math.round((deltaX * TOUCH_SPEED) / zoom),
        y: prev.y + Math.round((deltaY * TOUCH_SPEED) / zoom),
      }));

      setLastTouch({
        x: currentX,
        y: currentY,
        distance: currentDistance,
      });
    } else if (event.touches.length === 1) {
      // Handle single touch pan
      const deltaX = event.touches[0].clientX - lastTouch.x;
      const deltaY = event.touches[0].clientY - lastTouch.y;

      setOffset(prev => ({
        x: prev.x + Math.round((deltaX * TOUCH_SPEED) / zoom),
        y: prev.y + Math.round((deltaY * TOUCH_SPEED) / zoom),
      }));

      setLastTouch({
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      });
    }
  }, [lastTouch, initialPinchDistance, zoom]);

  const handleTouchEnd = useCallback(() => {
    setIsMoving(false);
    setLastTouch(null);
    setInitialPinchDistance(null);
  }, []);

  return (
    <div className="w-full h-full relative bg-[rgba(0,0,0,0.4)]">
      <header className="fixed inset-x-0 bottom-4 h-fit md:top-4 z-20 px-4">
        <div className="mx-auto max-w-3xl bg-black/40 backdrop-blur-md rounded-2xl p-3 flex justify-between3 items-center gap-6 border border-white/5">
          <div className="text-sm text-white/70">
            <span>x: {coordinatesMouse.x}</span>
            <span className="mx-1">·</span>
            <span>y: {coordinatesMouse.y}</span>
          </div>

          <div className="flex-1 hidden md:block text-center font-light text-white/90">
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
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ 
            cursor: isMoving ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none"
          }}
          className="z-20 [image-rendering:crisp-edges] my-auto rounded-lg shadow-[0_2px_10px_-3px_rgba(0,0,0,0.2)]"
        />
      </div>
    </div>
  );
};

export default NativeMap;
