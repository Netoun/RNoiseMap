import { MouseEvent, TouchEvent, useCallback } from 'react';
import { CONFIG } from '../config';
import { getTouchDistance } from '../utils';
import { AnimationState } from '../types';

export const useMapHandlers = (
  mapState: any,
  dispatch: any,
  animationRef: React.MutableRefObject<AnimationState>,
  animateOffset: () => void
) => {
  const handleMouseMove = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    const now = performance.now();
    if (now - mapState.lastRenderTime < 16) return;
    dispatch({ type: 'SET_RENDER_TIME', payload: now });

    const { movementX, movementY, clientX, clientY, currentTarget } = event;
    const rect = currentTarget.getBoundingClientRect();

    if (event.buttons === 1) {
      animationRef.current.targetX = Math.round(
        animationRef.current.targetX + (movementX * CONFIG.SPEED) / mapState.zoom
      );
      animationRef.current.targetY = Math.round(
        animationRef.current.targetY + (movementY * CONFIG.SPEED) / mapState.zoom
      );
      
      if (!animationRef.current.frameId) {
        animationRef.current.frameId = requestAnimationFrame(animateOffset);
      }
    }

    if (!mapState.isMoving) {
      dispatch({
        type: 'SET_COORDINATES',
        payload: {
          x: Math.round(Math.floor((clientX - rect.left) / (16 * mapState.zoom)) - mapState.offset.x),
          y: Math.round(Math.floor((clientY - rect.top) / (16 * mapState.zoom)) - mapState.offset.y),
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

  return {
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}; 