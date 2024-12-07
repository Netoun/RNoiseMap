import { generateMapGround, ChunkPosition, Tile, initializeNoise } from '../utils/generate';

let currentSeed: string | null = null;

self.onmessage = (e: MessageEvent<{ type: 'generateChunk', payload: { chunkPosition: ChunkPosition, seed: string } }>) => {
  const { type, payload } = e.data;
  
  if (type === 'generateChunk') {
    const { chunkPosition, seed } = payload;
    
    // Only reinitialize noise if seed changes
    if (seed !== currentSeed) {
      initializeNoise(seed);
      currentSeed = seed;
    }

    const offset = {
      x: chunkPosition.x * 60, // CHUNK_SIZE
      y: chunkPosition.y * 60  // CHUNK_SIZE
    };

    const chunk = generateMapGround(offset, seed);
    
    self.postMessage({
      type: 'chunkGenerated',
      payload: {
        chunk,
        position: chunkPosition
      }
    });
  }
}; 