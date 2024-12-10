import { useCallback, useEffect, useMemo, useRef, useState } from "react";
;
import { NativeMapProps, AnimationState, WorkerMessage, Tile } from "./types";
import { useMapReducer } from "./hooks/useMapReducer";
import { useMapHandlers } from "./hooks/useMapHandlers";
import { 
  createMapWorkers, 
  createTransformMatrix, 
  getTileGroups,
  isChunkVisible,
  tileGroupCache
} from "./utils";
import { calculateVisibleChunks, ChunkPosition } from "../../utils/generate";
import { useDebounce } from "../../hooks/useDebounce";
import { CONFIG } from "./config";

const NativeMap = ({ seed, generationParams, onReady }: NativeMapProps) => {
  const canvasTerrainRef = useRef<HTMLCanvasElement>(null);
  const [mapState, dispatch] = useMapReducer();
  
  const workersRef = useRef<Worker[]>([]);
  const workersAvailable = useRef<Worker[]>([]);
  const pendingChunks = useRef<ChunkPosition[]>([]);
  const initialRenderRef = useRef(true);
  const [chunks, setChunks] = useState<Map<string, Tile[][]>>(new Map());

  const animationRef = useRef<AnimationState>({
    targetX: mapState.offset.x,
    targetY: mapState.offset.y,
    frameId: null
  });

  const animateOffset = useCallback(() => {
    if (!animationRef.current.frameId) return;

    const dx = animationRef.current.targetX - mapState.offset.x;
    const dy = animationRef.current.targetY - mapState.offset.y;
    
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
      dispatch({ 
        type: 'SET_OFFSET', 
        payload: { 
          x: Math.round(animationRef.current.targetX), 
          y: Math.round(animationRef.current.targetY) 
        } 
      });
      animationRef.current.frameId = null;
      return;
    }

    const newX = mapState.offset.x + dx * 0.3;
    const newY = mapState.offset.y + dy * 0.3;
    
    dispatch({ type: 'SET_OFFSET', payload: { x: newX, y: newY } });
    animationRef.current.frameId = requestAnimationFrame(animateOffset);
  }, [mapState.offset]);

  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  const {
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleWheel,

  } = useMapHandlers(mapState, dispatch, animationRef, animateOffset);

  const generateChunk = useCallback((chunkPosition?: ChunkPosition) => {
    if (!chunkPosition) return [];
    
    if (workersRef.current.length === 0) {
      workersRef.current = createMapWorkers();
      workersAvailable.current = [...workersRef.current];
      
      workersRef.current.forEach(worker => {
        worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
          const { type, payload } = e.data;
          
          if (type === 'chunkGenerated') {
            const { chunk, position } = payload;
            const key = getChunkKey(position.x, position.y);
            
            if (initialRenderRef.current) {
              initialRenderRef.current = false;
              onReady?.();
            }
            
            setChunks(prev => {
              const newChunks = new Map(prev);
              newChunks.set(key, chunk);
              return newChunks;
            });
            
            workersAvailable.current.push(worker);
            
            if (pendingChunks.current.length > 0) {
              const nextChunk = pendingChunks.current.shift();
              if (nextChunk) {
                const availableWorker = workersAvailable.current.pop();
                if (availableWorker) {
                  availableWorker.postMessage({
                    type: 'generateChunk',
                    payload: {
                      chunkPosition: nextChunk,
                      seed,
                      generationParams
                    }
                  });
                }
              }
            }
          }
        };
      });
    }

    const availableWorker = workersAvailable.current.pop();
    if (availableWorker) {
      availableWorker.postMessage({
        type: 'generateChunk',
        payload: {
          chunkPosition,
          seed,
          generationParams
        }
      });
    } else {
      pendingChunks.current.push(chunkPosition);
    }

    return [];
  }, [seed]);

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
    
    let tileScale = 1;
    if (mapState.zoom < CONFIG.QUALITY.LOW) {
      tileScale = 5;
    } else if (mapState.zoom < CONFIG.QUALITY.MEDIUM) {
      tileScale = 3;
    } else if (mapState.zoom < CONFIG.QUALITY.HIGH) {
      tileScale = 2;
    }
    
    const matrix = createTransformMatrix(mapState.zoom, mapState.offset.x, mapState.offset.y);
    context.save();
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    context.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    
    // Utiliser un Set pour les chunks visibles
    const visibleChunkKeys = new Set<string>();
    const visibleChunks = Array.from(chunks.values()).filter(chunk => {
      if (!chunk || !chunk[0] || !chunk[0][0]) return false;
      
      if (isChunkVisible(chunk, mapState.offset, window.innerWidth, window.innerHeight, mapState.zoom)) {
        const key = `${chunk[0][0].x}_${chunk[0][0].y}`;
        visibleChunkKeys.add(key);
        return true;
      }
      return false;
    });

    // Nettoyer le cache des groupes de tuiles pour les chunks non visibles
    for (const key of tileGroupCache.keys()) {
      if (!key) continue;
      const [chunkX, chunkY] = key.split('_');
      const chunkKey = `${chunkX}_${chunkY}`;
      if (!visibleChunkKeys.has(chunkKey)) {
        tileGroupCache.delete(key);
      }
    }

    // Rendu optimisé avec Map pour les groupes de couleurs
    visibleChunks.forEach(chunk => {
      if (!chunk) return;
      const colorGroups = getTileGroups(chunk, tileScale);
      
      colorGroups.forEach((tiles, color) => {
        if (!tiles || !tiles.length) return;
        context.fillStyle = color;
        context.beginPath();
        tiles.forEach(tile => {
          if (!tile) return;
          context.rect(tile.posX, tile.posY, tile.w, tile.h);
        });
        context.fill();
      });
    });
    
    context.restore();
    
    if (import.meta.env.DEV) {
      console.log(`Render time: ${performance.now() - startTime}ms`);
    }
  }, [chunks, context, mapState.offset.x, mapState.offset.y, mapState.zoom]);

  const getChunkKey = (x: number, y: number) => `${x},${y}`;

  useEffect(() => {
    const visibleChunks = calculateVisibleChunks({
      height: window.innerHeight / mapState.zoom,
      width: window.innerWidth / mapState.zoom,
      x: mapState.offset.x,
      y: mapState.offset.y,
    });

    const chunksSet = new Set(Array.from(chunks.keys()));
    const missingChunks = visibleChunks.filter(chunk => {
      const key = getChunkKey(chunk.x, chunk.y);
      return !chunksSet.has(key);
    });

    if (missingChunks.length === 0) {
      if (initialRenderRef.current) {
        initialRenderRef.current = false;
        onReady?.();
      }
      return;
    }

    // Utiliser un Set pour les chunks à générer
    const pendingSet = new Set(pendingChunks.current.map(c => getChunkKey(c.x, c.y)));
    missingChunks.forEach(chunk => {
      const key = getChunkKey(chunk.x, chunk.y);
      if (!pendingSet.has(key)) {
        generateChunk(chunk);
      }
    });

    // Optimiser le nettoyage du cache
    if (chunks.size > CONFIG.CHUNK_CACHE_SIZE) {
      const visibleKeys = new Set(visibleChunks.map(chunk => getChunkKey(chunk.x, chunk.y)));
      setChunks(prev => {
        const newChunks = new Map(prev);
        const toDelete = Array.from(newChunks.keys())
          .filter(key => !visibleKeys.has(key))
          .slice(0, newChunks.size - CONFIG.CHUNK_CACHE_SIZE);
        
        toDelete.forEach(key => {
          newChunks.delete(key);
          // Clean up tile groups cache
          if (tileGroupCache) {
            tileGroupCache.delete(key);
          }
        });
        
        return newChunks;
      });
    }
  }, [mapState.offset.x, mapState.offset.y, generateChunk, mapState.zoom]);

  const chunksDebounced = useDebounce(chunks, 200);
  const coordinatesMouseDebounced = useDebounce(mapState.coordinatesMouse, 200);

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
    
    params.set('zoom', mapState.zoom.toFixed(1));
    params.set('x', Math.round(mapState.offset.x).toString());
    params.set('y', Math.round(mapState.offset.y).toString());
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [mapState.zoom, mapState.offset.x, mapState.offset.y]);

  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    
    event.preventDefault();
    dispatch({ type: 'SET_MOVING', payload: true });
    if (event.touches.length === 2) {
      const distance = getTouchDistance(event.touches[0], event.touches[1]);
      dispatch({
        type: 'SET_PINCH_DISTANCE',
        payload: distance
      });
      dispatch({
        type: 'SET_TOUCH',
        payload: {
          x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
          y: (event.touches[0].clientY + event.touches[1].clientY) / 2,
          distance,
        }
      });
    } else {
      dispatch({
        type: 'SET_PINCH_DISTANCE',
        payload: null
      });
      dispatch({
        type: 'SET_TOUCH',
        payload: {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        }
      });
    }
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    if (!mapState.lastTouch) return;

    if (event.touches.length === 2 && mapState.initialPinchDistance) {
      const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
      const deltaDistance = currentDistance - mapState.lastTouch.distance!;
      
      if (Math.abs(deltaDistance) > CONFIG.MIN_PINCH_DISTANCE) {
        const zoomDelta = deltaDistance > 0 ? CONFIG.ZOOM_SPEED : -CONFIG.ZOOM_SPEED;
        dispatch({
          type: 'SET_ZOOM',
          payload: Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, mapState.zoom + zoomDelta))
        });
      }

      const currentX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const currentY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      const deltaX = currentX - mapState.lastTouch.x;
      const deltaY = currentY - mapState.lastTouch.y;

      dispatch({
        type: 'SET_OFFSET',
        payload: {
          x: mapState.offset.x + Math.round((deltaX * CONFIG.TOUCH_SPEED) / mapState.zoom),
          y: mapState.offset.y + Math.round((deltaY * CONFIG.TOUCH_SPEED) / mapState.zoom),
        }
      });

      dispatch({
        type: 'SET_TOUCH',
        payload: {
          x: currentX,
          y: currentY,
          distance: currentDistance,
        }
      });
    } else if (event.touches.length === 1) {
      const deltaX = event.touches[0].clientX - mapState.lastTouch.x;
      const deltaY = event.touches[0].clientY - mapState.lastTouch.y;

      dispatch({
        type: 'SET_OFFSET',
        payload: {
          x: mapState.offset.x + Math.round((deltaX * CONFIG.TOUCH_SPEED) / mapState.zoom),
          y: mapState.offset.y + Math.round((deltaY * CONFIG.TOUCH_SPEED) / mapState.zoom),
        }
      });

      dispatch({
        type: 'SET_TOUCH',
        payload: {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        }
      });
    }
  }, [mapState.lastTouch, mapState.initialPinchDistance, mapState.zoom]);

  const handleTouchEnd = useCallback(() => {
    dispatch({ type: 'SET_MOVING', payload: false });
    dispatch({ type: 'SET_TOUCH', payload: null });
    dispatch({ type: 'SET_PINCH_DISTANCE', payload: null });
  }, []);

  useEffect(() => {
    return () => {
      workersRef.current.forEach(worker => {
        worker.terminate();
      });
      workersRef.current = [];
      workersAvailable.current = [];
      pendingChunks.current = [];
      if (animationRef.current.frameId) {
        cancelAnimationFrame(animationRef.current.frameId);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative bg-[rgba(0,0,0,0.4)]">
      <header className="fixed inset-x-0 bottom-4 h-fit md:top-4 z-20 px-4 pointer-events-none">
        <div className="w-fit min-w-32 md:mx-auto max-w-3xl bg-black/70 backdrop-blur-md rounded-2xl p-3 flex flex-col md:flex-row justify-between md:items-center gap-6 border border-white/5 pointer-events-auto">
          <div className="flex flex-col md:flex-row text-sm text-white/70">
            <span>x: {mapState.coordinatesMouse.x}</span>
            <span className="hidden md:block mx-1">·</span>
            <span>y: {mapState.coordinatesMouse.y}</span>
            <span className="hidden md:block mx-3">
              /
            </span>
            <span>
              zoom: {mapState.zoom.toFixed(1)}
            </span>
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
            cursor: mapState.isMoving ? "grabbing" : "grab",
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
