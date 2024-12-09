/**
 * Web Worker pour la génération de chunks de terrain
 * Utilise un système de seed pour générer du terrain procédural cohérent
 */

import { generateMapGround, ChunkPosition, initializeNoise, CHUNK_SIZE } from '../utils/generate';

// Garde en mémoire la dernière seed utilisée pour éviter de réinitialiser inutilement
let currentSeed: string | null = null;

/**
 * Gestionnaire de messages du worker
 * Attend un message de type 'generateChunk' avec une position et une seed
 * Retourne un message de type 'chunkGenerated' avec le chunk généré
 */
self.onmessage = (e: MessageEvent<{ 
  type: 'generateChunk', 
  payload: { 
    chunkPosition: ChunkPosition, 
    seed: string 
  } 
}>) => {
  const { type, payload } = e.data;
  
  if (type === 'generateChunk') {
    const { chunkPosition, seed } = payload;
    
    // Réinitialise le générateur de bruit si la seed change
    if (seed !== currentSeed) {
      initializeNoise(seed);
      currentSeed = seed;
    }

    // Calcule l'offset du chunk dans le monde
    const offset = {
      x: chunkPosition.x * CHUNK_SIZE, // CHUNK_SIZE
      y: chunkPosition.y * CHUNK_SIZE  // CHUNK_SIZE
    };

    // Génère le terrain pour ce chunk
    const chunk = generateMapGround(offset, seed);
    
    // Renvoie le chunk généré
    self.postMessage({
      type: 'chunkGenerated',
      payload: {
        chunk,
        position: chunkPosition
      }
    });
  }
}; 