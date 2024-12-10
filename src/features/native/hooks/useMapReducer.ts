import { useReducer } from 'react';
import { MapState, MapAction } from '../types';
import { getInitialValues } from '../utils';

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

export const useMapReducer = () => {
  const initialValues = getInitialValues();
  
  return useReducer(mapReducer, {
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
}; 