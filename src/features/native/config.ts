export const CONFIG = {
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
} as const; 