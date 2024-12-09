import {
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  TouchEvent,
  useReducer,
} from "react";
import {
  ChunkPosition,
  TILE_SIZE,
  Tile,
  calculateVisibleChunks,
  getColor,
  createTileGroupMatrix,
} from "../../utils/generate";
import { CHUNK_SIZE } from "../../utils/generate";
import { useDebounce } from "../../hooks/useDebounce";

interface TouchInfo {
  x: number;
  y: number;
  distance?: number;
}

interface WorkerMessage {
  type: 'chunkGenerated';
  payload: {
    chunk: Tile[][];
    position: ChunkPosition;
  };
}

interface NativeMapProps { 
  seed: string;
  onReady?: () => void;
}

const CONFIG = {
  SPEED: 0.5,                    // Vitesse de déplacement de la carte
  VIEWPORT_PADDING: 2,           // Padding autour du viewport pour le pré-chargement
  CHUNK_CACHE_SIZE: 100,         // Nombre maximum de chunks en cache
  MIN_ZOOM: 0.5,                 // Zoom minimum autorisé
  MAX_ZOOM: 4,                   // Zoom maximum autorisé
  ZOOM_SPEED: 0.1,              // Vitesse du zoom
  TOUCH_SPEED: 0.15,            // Vitesse du déplacement tactile
  MIN_PINCH_DISTANCE: 50,       // Distance minimum pour le pinch-zoom
  WORKER_COUNT: 20,              // Nombre de web workers en parallèle
  
  // Seuils de qualité en fonction du zoom
  QUALITY: {
    LOW: 0.7,     // En dessous de 0.7x zoom -> 4x4
    MEDIUM: 1.4,  // Entre 0.7x et 1.4x zoom -> 2x2
    HIGH: 2.0     // Entre 1.4x et 2.0x zoom -> 1x1 (qualité native)
  }
};

/**
 * Determines if a chunk is currently visible in the viewport
 * 
 * @param chunk - The tile chunk to check visibility for
 * @param offset - The current map offset/position {x,y}
 * @param width - The viewport width in pixels
 * @param height - The viewport height in pixels 
 * @param zoom - The current zoom level
 * @returns boolean indicating if the chunk is visible
 *
 * The function:
 * 1. Calculates the chunk's position in world coordinates
 * 2. Scales the viewport dimensions and offset based on zoom level
 * 3. Checks if the chunk intersects with the padded viewport area
 * 4. Padding is added around viewport for pre-loading nearby chunks
 */
const isChunkVisible = (
  chunk: Tile[][], 
  offset: {x: number, y: number}, 
  width: number, 
  height: number, 
  zoom: number
): boolean => {
  // Get chunk's world position from its first tile
  const chunkX = chunk[0][0].x * TILE_SIZE;
  const chunkY = chunk[0][0].y * TILE_SIZE;
  const chunkSize = CHUNK_SIZE * TILE_SIZE;
  
  // Scale viewport dimensions and offset based on zoom
  const scaledWidth = width / zoom;
  const scaledHeight = height / zoom;
  const scaledOffsetX = offset.x * TILE_SIZE;
  const scaledOffsetY = offset.y * TILE_SIZE;
  
  // Check if chunk intersects with padded viewport area
  return (
    chunkX + chunkSize + scaledOffsetX >= -CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkX + scaledOffsetX <= scaledWidth + CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkY + chunkSize + scaledOffsetY >= -CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE &&
    chunkY + scaledOffsetY <= scaledHeight + CONFIG.VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE
  );
};

/**
 * Gets initial map position and zoom values from URL parameters
 * 
 * @returns {Object} Initial values for map state
 * - zoom: Map zoom level from URL, defaults to 1 if not provided or invalid
 * - x: X coordinate from URL, defaults to 0 if not provided or invalid
 * - y: Y coordinate from URL, defaults to 0 if not provided or invalid
 * 
 * The function:
 * 1. Parses URL search parameters
 * 2. Extracts zoom, x, y values if present
 * 3. Formats zoom to 1 decimal place
 * 4. Rounds x,y coordinates to integers
 * 5. Provides default values if parameters are missing/invalid
 */
const getInitialValues = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    zoom: Number(Number(params.get('zoom')).toFixed(1)) || 1,
    x: Math.round(Number(params.get('x'))) || 0,
    y: Math.round(Number(params.get('y'))) || 0
  };
};

/**
 * Creates an array of Web Workers for map generation.
 * 
 * This function initializes a specified number of Web Workers 
 * based on the configuration constant CONFIG.WORKER_COUNT. Each 
 * worker is created using the Worker constructor, which loads 
 * the mapWorker.ts script as a module. The workers are used to 
 * handle the generation of map chunks in a separate thread, 
 * allowing for smoother performance in the main application.
 * 
 * @returns {Worker[]} An array of initialized Web Worker instances.
 */
const createMapWorkers = (): Worker[] => {
  return Array.from({ length: CONFIG.WORKER_COUNT }, () => 
    new Worker(new URL('../../workers/mapWorker.ts', import.meta.url), {
      type: 'module'
    })
  );
};

interface MapState {
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

type MapAction = 
  | { type: 'SET_OFFSET'; payload: { x: number; y: number } }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_MOVING'; payload: boolean }
  | { type: 'SET_COORDINATES'; payload: { x: number; y: number } }
  | { type: 'SET_RENDER_TIME'; payload: number }
  | { type: 'SET_TOUCH'; payload: TouchInfo | null }
  | { type: 'SET_PINCH_DISTANCE'; payload: number | null }
  | { type: 'SET_TARGET_OFFSET'; payload: { x: number; y: number } }
  | { type: 'SET_ANIMATION_FRAME'; payload: number | null };

const mapReducer = (state: MapState, action: MapAction): MapState => {
  switch (action.type) {
    case 'SET_OFFSET':
      return { ...state, offset: action.payload };
    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };
    case 'SET_MOVING':
      return { ...state, isMoving: action.payload };
    case 'SET_COORDINATES':
      return { ...state, coordinatesMouse: action.payload };
    case 'SET_RENDER_TIME':
      return { ...state, lastRenderTime: action.payload };
    case 'SET_TOUCH':
      return { ...state, lastTouch: action.payload };
    case 'SET_PINCH_DISTANCE':
      return { ...state, initialPinchDistance: action.payload };
    case 'SET_TARGET_OFFSET':
      return { ...state, targetOffset: action.payload };
    case 'SET_ANIMATION_FRAME':
      return { ...state, animationFrameId: action.payload };
    default:
      return state;
  }
};

interface AnimationState {
  targetX: number;
  targetY: number;
  frameId: number | null;
}

// Ajouter une interface pour la matrice de transformation
interface TransformMatrix {
  a: number; // scale X
  b: number; // skew Y
  c: number; // skew X
  d: number; // scale Y
  e: number; // translate X
  f: number; // translate Y
}

// Ajouter une Map pour mettre en cache les matrices de transformation
const transformCache = new Map<string, TransformMatrix>();

// Optimiser la création de la matrice de transformation avec mise en cache
const createTransformMatrix = (zoom: number, offsetX: number, offsetY: number): TransformMatrix => {
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

// Optimiser le regroupement des tuiles avec une Map
const tileGroupCache = new Map<string, Map<string, Tile[]>>();

const getTileGroups = (chunk: Tile[][], tileScale: number): Map<string, Tile[]> => {
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

const NativeMap = ({ seed, onReady }: NativeMapProps) => {
  const initialValues = getInitialValues();
  const canvasTerrainRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  
  const [mapState, dispatch] = useReducer(mapReducer, {
    offset: { x: initialValues.x, y: initialValues.y },
    zoom: initialValues.zoom,
    isMoving: false,
    coordinatesMouse: { x: initialValues.x, y: initialValues.y },
    lastRenderTime: 0,
    lastTouch: null,
    initialPinchDistance: null,
    targetOffset: { x: initialValues.x, y: initialValues.y },
    animationFrameId: null
  });

  const workersRef = useRef<Worker[]>([]);
  const workersAvailable = useRef<Worker[]>([]);
  const pendingChunks = useRef<ChunkPosition[]>([]);

  const initialRenderRef = useRef(true);

  const [chunks, setChunks] = useState<Map<string, Tile[][]>>(new Map());

  const animationRef = useRef<AnimationState>({
    targetX: initialValues.x,
    targetY: initialValues.y,
    frameId: null
  });

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
            
            // Remettre le worker dans la liste des disponibles
            workersAvailable.current.push(worker);
            
            // Traiter le prochain chunk en attente s'il y en a
            if (pendingChunks.current.length > 0) {
              const nextChunk = pendingChunks.current.shift();
              if (nextChunk) {
                const availableWorker = workersAvailable.current.pop();
                if (availableWorker) {
                  availableWorker.postMessage({
                    type: 'generateChunk',
                    payload: {
                      chunkPosition: nextChunk,
                      seed
                    }
                  });
                }
              }
            }
          }
        };
      });
    }

    // Si un worker est disponible, l'utiliser
    const availableWorker = workersAvailable.current.pop();
    if (availableWorker) {
      availableWorker.postMessage({
        type: 'generateChunk',
        payload: {
          chunkPosition,
          seed
        }
      });
    } else {
      // Sinon, ajouter le chunk à la file d'attente
      pendingChunks.current.push(chunkPosition);
    }

    return [];
  }, [seed]);

  const animateOffset = useCallback(() => {
    const dx = animationRef.current.targetX - mapState.offset.x;
    const dy = animationRef.current.targetY - mapState.offset.y;
    
    // Si on est assez proche de la cible, on arrête l'animation
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

    // Interpolation fluide
    const newX = mapState.offset.x + dx * 0.3;
    const newY = mapState.offset.y + dy * 0.3;
    
    dispatch({ type: 'SET_OFFSET', payload: { x: newX, y: newY } });
    
    animationRef.current.frameId = requestAnimationFrame(animateOffset);
  }, [mapState.offset]);

  const handleMouseMove = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const now = performance.now();
    if (now - mapState.lastRenderTime < 16) return;
    dispatch({ type: 'SET_RENDER_TIME', payload: now });

    const { movementX, movementY, clientX, clientY } = event;
    const rect = canvasTerrainRef?.current?.getBoundingClientRect();
    if (!rect) return;

    if (event.buttons === 1) {
      // Mettre à jour la position cible
      animationRef.current.targetX = Math.round(
        animationRef.current.targetX + (movementX * CONFIG.SPEED) / mapState.zoom
      );
      animationRef.current.targetY = Math.round(
        animationRef.current.targetY + (movementY * CONFIG.SPEED) / mapState.zoom
      );
      
      // Démarrer l'animation si elle n'est pas déjà en cours
      if (!animationRef.current.frameId) {
        animationRef.current.frameId = requestAnimationFrame(animateOffset);
      }
    }

    if (!mapState.isMoving) {
      dispatch({
        type: 'SET_COORDINATES',
        payload: {
          x: Math.round(Math.floor((clientX - rect.left) / (TILE_SIZE * mapState.zoom)) - mapState.offset.x),
          y: Math.round(Math.floor((clientY - rect.top) / (TILE_SIZE * mapState.zoom)) - mapState.offset.y),
        }
      });
    }
  }, [mapState.lastRenderTime, mapState.zoom, mapState.isMoving, mapState.offset, animateOffset]);

  const handleMouseDown = useCallback(() => {
    dispatch({ type: 'SET_MOVING', payload: true });
  }, []);

  const handleMouseUp = useCallback(() => {
    dispatch({ type: 'SET_MOVING', payload: false });
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    dispatch({
      type: 'SET_ZOOM',
      payload: Math.max(CONFIG.MIN_ZOOM, Math.min(CONFIG.MAX_ZOOM, mapState.zoom + (event.deltaY < 0 ? CONFIG.ZOOM_SPEED : -CONFIG.ZOOM_SPEED)))
    });
  }, [mapState.zoom]);

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
      if (isChunkVisible(chunk, mapState.offset, window.innerWidth, window.innerHeight, mapState.zoom)) {
        const key = `${chunk[0][0].x}_${chunk[0][0].y}`;
        visibleChunkKeys.add(key);
        return true;
      }
      return false;
    });

    // Nettoyer le cache des groupes de tuiles pour les chunks non visibles
    for (const key of tileGroupCache.keys()) {
      const [chunkX, chunkY] = key.split('_');
      const chunkKey = `${chunkX}_${chunkY}`;
      if (!visibleChunkKeys.has(chunkKey)) {
        tileGroupCache.delete(key);
      }
    }

    // Rendu optimisé avec Map pour les groupes de couleurs
    visibleChunks.forEach(chunk => {
      const colorGroups = getTileGroups(chunk, tileScale);
      
      colorGroups.forEach((tiles, color) => {
        context.fillStyle = color;
        context.beginPath();
        tiles.forEach(tile => {
          context.rect(tile.posX, tile.posY, tile.w, tile.h);
        });
        context.fill();
      });
    });
    
    context.restore();
    
    if (import.meta.env.DEV) {
      console.log(`Render time: ${performance.now() - startTime}ms`);
    }
  }, [chunks, context, mapState.offset, mapState.zoom]);

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
          // Nettoyer aussi le cache des groupes de tuiles
          tileGroupCache.delete(key);
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

  const handleTouchStart = useCallback((event: TouchEvent<HTMLCanvasElement>) => {
    
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

  const handleTouchMove = useCallback((event: TouchEvent<HTMLCanvasElement>) => {
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
      <header className="fixed inset-x-0 bottom-4 h-fit md:top-4 z-20 px-4">
        <div className="w-fit min-w-32 md:mx-auto max-w-3xl bg-black/70 backdrop-blur-md rounded-2xl p-3 flex flex-col md:flex-row justify-between md:items-center gap-6 border border-white/5">
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
