import * as React from "react";
import ThreeMap from "./features/three/ThreeMap";
import NativeMap from "./features/native/native-map";
import { Switch } from "./components/ui/Switch";
import Legend from "./components/ui/Legend";
import { Loader, RefreshCcwDotIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Settings from "./components/ui/Settings";
import { DEFAULT_GENERATION_PARAMS } from "./utils/generate";

function App() {
  const [isLoading, setIsLoading] = React.useState(true);
  const [isThreeMode, setIsThreeMode] = React.useState(false);

  const [generationParams, setGenerationParams] = React.useState(DEFAULT_GENERATION_PARAMS);

  const [seed, setSeed] = React.useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("seed") || Math.random().toString(36).substring(7);
  });

  React.useEffect(() => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("seed", seed);
    window.history.pushState({}, "", newUrl);
  }, [seed]);  

  const handleSeedChange = () => {
    setIsLoading(true);
    setSeed(Math.random().toString(36).substring(7));
  };

  const handleParamsChange = (params: typeof DEFAULT_GENERATION_PARAMS) => {
    setIsLoading(true);
    setGenerationParams(params);
  };

return (
    <div className="w-full h-screen relative overflow-hidden">
      <div className="h-12 fixed top-4 left-4 gap-4 z-50 flex justify-between">
        <button
          onClick={handleSeedChange}
          className="cursor w-full flex items-center justify-center sm:w-auto px-4 py-3 bg-black/70 backdrop-blur-md text-white/70 rounded-2xl transition-colors text-sm"
        >
          New seed <RefreshCcwDotIcon className="w-4 h-4 ml-2" />
        </button>
      </div>
      <div className="h-12 fixed top-4 right-4 gap-4 z-50 flex justify-between">
        <div className="w-fit min-w-32 flex items-center justify-center gap-2 bg-black/70 text-white/70 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/5">
          <span>2D</span>
          <Switch checked={isThreeMode} onCheckedChange={setIsThreeMode} />
          <span>3D</span>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={seed + JSON.stringify(generationParams)}
          initial={{
            opacity: 0,
            scale: 1.2,
            filter: "brightness(2) sepia(1) blur(20px)",
            rotateX: 15,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            filter: "brightness(1) sepia(0) blur(0px)",
            rotateX: 0,
          }}
          exit={{
            opacity: 0,
          }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            width: "100%",
            height: "100%",
            perspective: "1000px",
          }}
        >
          <motion.div
          initial={{ rotateX: 10 }}
            animate={{ rotateX: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {isThreeMode ? (
              <ThreeMap seed={seed} generationParams={generationParams} />
            ) : (
              <NativeMap
                seed={seed}
                generationParams={generationParams}
                onReady={() => setIsLoading(false)}
              />
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {isLoading && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center text-white/70 backdrop-blur-sm">
          <Loader className="w-12 h-12 animate-spin" />
        </div>
      )}
      <Legend />
      <Settings onParamsChange={handleParamsChange} />
    </div>
  );
}

export default App;
