import * as React from "react";
import ThreeMap from "./features/three/ThreeMap";
import NativeMap from "./features/native/NativeMap";
import { Switch } from "./components/ui/Switch";
import Legend from "./components/ui/Legend";

function App() {
  const [isThreeMode, setIsThreeMode] = React.useState(false);

  const [seed, setSeed] = React.useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("seed") || Math.random().toString(36).substring(7);
  });

  React.useEffect(() => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("seed", seed);
    window.history.pushState({}, "", newUrl);
  }, [seed]);

  const handleRefresh = () => {
    setSeed(Math.random().toString(36).substring(7));
  };

  return (
    <div className="w-full h-screen relative">
      <div className="fixed top-0 left-0 right-0 p-4 gap-4 z-50 flex justify-between">
        <button
          onClick={handleRefresh}
          className="w-full sm:w-auto px-4 py-2 bg-black/70 backdrop-blur-md text-white/70 rounded-2xl transition-colors text-sm"
        >
          Refresh Seed
        </button>

        <div className="w-fit flex items-center justify-end gap-4 bg-black/70 text-white/70 backdrop-blur-md rounded-2xl p-3 border border-white/5">
          <span>2D</span>
          <Switch checked={isThreeMode} onCheckedChange={setIsThreeMode} />
          <span>3D</span>
        </div>
      </div>
      <div key={seed}>
        {isThreeMode ? <ThreeMap seed={seed} /> : <NativeMap seed={seed} />}
      </div>
      <Legend />
    </div>
  );
}

export default App;
