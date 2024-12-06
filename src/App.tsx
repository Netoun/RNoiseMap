import * as React from 'react';
import ThreeMap from './features/three/ThreeMap';
import NativeMap from './features/native/NativeMap';
import { Switch } from './components/ui/Switch';

function App() {
  const [isThreeMode, setIsThreeMode] = React.useState(false);

  return (
    <div className="w-full h-screen relative">
      <div className="fixed top-5 right-5 z-50 flex items-center gap-2">
        <span>2D</span>
        <Switch 
          checked={isThreeMode} 
          onCheckedChange={setIsThreeMode}
        />
        <span>3D</span>
      </div>
      {isThreeMode ? <ThreeMap /> : <NativeMap />}
    </div>
  );
}

export default App;
