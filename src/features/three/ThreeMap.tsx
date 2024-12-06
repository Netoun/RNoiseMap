import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  ChunkPosition,
  TILE_SIZE,
  Tile,
  calculateVisibleChunks,
  generateMapGround,
  getColor,
  CHUNK_SIZE,
} from "../../utils/generate";
import { useSearchParams } from "react-router";
import { useDebounce } from "../../hooks/useDebounce";

const VIEWPORT_PADDING = 2;
const CHUNK_CACHE_SIZE = 100;

type ChunkCache = Map<string, Tile[][]>;

interface ChunkMeshProps {
  chunk: Tile[][];
}

const ChunkMesh = ({ chunk }: ChunkMeshProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  const chunkData = useMemo(() => {
    const vertices: number[] = [];
    const colors: number[] = [];
    
    chunk.forEach((row) => {
      row.forEach((tile) => {
        const x = tile.x * TILE_SIZE;
        const z = tile.y * TILE_SIZE;
        
        const color = new THREE.Color(getColor(tile.biome, tile.values[0]));

        vertices.push(x, 0, -z);
        vertices.push(x + TILE_SIZE, 0, -z);
        vertices.push(x, 0, -(z + TILE_SIZE));

        vertices.push(x + TILE_SIZE, 0, -z);
        vertices.push(x + TILE_SIZE, 0, -(z + TILE_SIZE));
        vertices.push(x, 0, -(z + TILE_SIZE));

        for (let i = 0; i < 6; i++) {
          colors.push(color.r, color.g, color.b);
        }
      });
    });

    return {
      vertices: new Float32Array(vertices),
      colors: new Float32Array(colors),
    };
  }, [chunk]);

  useEffect(() => {
    if (!geometryRef.current) return;

    geometryRef.current.setAttribute(
      'position',
      new THREE.BufferAttribute(chunkData.vertices, 3)
    );
    geometryRef.current.setAttribute(
      'color',
      new THREE.BufferAttribute(chunkData.colors, 3)
    );
  }, [chunkData]);

  return (
    <mesh ref={meshRef}>
      <bufferGeometry ref={geometryRef} />
      <meshBasicMaterial vertexColors />
    </mesh>
  );
};

const initInitialOffset = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    x: parseInt(params.get("x") || "0"),
    y: parseInt(params.get("y") || "0"),
  };
};

type MapContentProps = {
  seed: string;
};


const MapContent = ({ seed }: MapContentProps) => {
  const [_, setSearchParams] = useSearchParams();
  const [chunks, setChunks] = useState<ChunkCache>(new Map());
  const [offset, setOffset] = useState(initInitialOffset());
  const { camera, viewport } = useThree();

  const generateChunk = useCallback((chunkPosition?: ChunkPosition) => {
    const offset = chunkPosition
      ? {
          x: chunkPosition.x * CHUNK_SIZE,
          y: chunkPosition.y * CHUNK_SIZE,
        }
      : undefined;

    return generateMapGround(offset, seed);
  }, []);

  const updateSearchParams = (x: number, y: number) => {
    setSearchParams({
      x: x.toString(),
      y: y.toString(),
    });
  }

  const debouncedX = useDebounce(offset.x, 500);
  const debouncedY = useDebounce(offset.y, 500);

  useEffect(() => {
    
    updateSearchParams(debouncedX, debouncedY);
  }, [debouncedX, debouncedY]);

  const getChunkKey = (x: number, y: number) => `${x},${y}`;

  useEffect(() => {
    const visibleChunks = calculateVisibleChunks({
      width: viewport.width + (VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE),
      height: viewport.height + (VIEWPORT_PADDING * CHUNK_SIZE * TILE_SIZE),
      x: offset.x,
      y: offset.y,
    });

    const newChunks = new Map(chunks);
    visibleChunks.forEach(chunk => {
      const key = getChunkKey(chunk.x, chunk.y);
      if (!newChunks.has(key)) {
        newChunks.set(key, generateChunk(chunk));
      }
    });

    if (newChunks.size > CHUNK_CACHE_SIZE) {
      const visibleKeys = new Set(
        visibleChunks.map(chunk => getChunkKey(chunk.x, chunk.y))
      );
      
      Array.from(newChunks.keys())
        .filter(key => !visibleKeys.has(key))
        .slice(0, newChunks.size - CHUNK_CACHE_SIZE)
        .forEach(key => newChunks.delete(key));
    }

    setChunks(newChunks);
  }, [offset, viewport, generateChunk]);

  useFrame(() => {

    const x = Math.round(camera.position.x / TILE_SIZE);
    const y = Math.round(-camera.position.z / TILE_SIZE);
    setOffset({
      x,
      y,
    });
  });

  return (
    <>
      {Array.from(chunks.entries()).map(([key, chunk]) => (
        <ChunkMesh key={key} chunk={chunk} />
      ))}
    </>
  );
};

type ThreeMapProps = {
  seed: string;
};

const ThreeMap = ({ seed }: ThreeMapProps) => {
  return (
    <div className="h-screen w-screen relative bg-[rgba(0,0,0,0.4)]">
      <header className="fixed inset-x-0 top-4 z-20 px-4">
        <div className="mx-auto max-w-3xl bg-black/70 backdrop-blur-md rounded-2xl p-3 flex items-center gap-6 border border-white/5">
          <div className="flex-1 text-center font-light text-white/90">
            Procedural Map (Three.js)
          </div>
        </div>
      </header>

      <Canvas
        camera={{ 
          position: [0, 500, 0],
          up: [0, 0, -1],
          fov: 75,
          near: 0.1,
          far: 2000
        }}
        className="w-full h-full"
      >
        <MapContent seed={seed} />
        <OrbitControls 
          enableRotate={false}
          enableZoom={true}
          zoomSpeed={1}
          panSpeed={1}
          target={[0, 0, 0]}
          screenSpacePanning={true}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
          }}
        />
      </Canvas>
    </div>
  );
};

export default ThreeMap; 
