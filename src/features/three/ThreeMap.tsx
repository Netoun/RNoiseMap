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
    
    chunk.forEach(row => {
      row.forEach(tile => {
        // Création d'un quad (2 triangles) pour chaque tile
        const x = tile.x * TILE_SIZE;
        const y = tile.y * TILE_SIZE;
        const color = new THREE.Color(getColor(tile.biome, tile.values[0]));

        // Premier triangle
        vertices.push(x, -y, 0);
        vertices.push(x + TILE_SIZE, -y, 0);
        vertices.push(x, -(y + TILE_SIZE), 0);

        // Deuxième triangle
        vertices.push(x + TILE_SIZE, -y, 0);
        vertices.push(x + TILE_SIZE, -(y + TILE_SIZE), 0);
        vertices.push(x, -(y + TILE_SIZE), 0);

        // Couleurs pour chaque vertex
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

const MapContent = () => {
  const [chunks, setChunks] = useState<ChunkCache>(new Map());
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const { camera, viewport } = useThree();

  const generateChunk = useCallback((chunkPosition?: ChunkPosition) => {
    const offset = chunkPosition
      ? {
          x: chunkPosition.x * CHUNK_SIZE,
          y: chunkPosition.y * CHUNK_SIZE,
        }
      : undefined;

    return generateMapGround(offset);
  }, []);

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
    setOffset({
      x: -camera.position.x / TILE_SIZE,
      y: camera.position.y / TILE_SIZE,
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

const ThreeMap = () => {
  return (
    <div className="w-full h-full relative bg-[rgba(0,0,0,0.4)]">
      <header className="fixed inset-x-0 top-4 z-20 px-4">
        <div className="mx-auto max-w-3xl bg-black/40 backdrop-blur-md rounded-2xl p-3 flex items-center gap-6 border border-white/5">
          <div className="flex-1 text-center font-light text-white/90">
            Procedural Map (Three.js)
          </div>
        </div>
      </header>

      <Canvas
        camera={{ position: [0, 0, 500], up: [0, 0, 1] }}
        className="w-full h-full"
      >
        <MapContent />
        <OrbitControls 
          enableRotate={false}
          enableZoom={true}
          zoomSpeed={2}
          panSpeed={2}
        />
      </Canvas>
    </div>
  );
};

export default ThreeMap; 