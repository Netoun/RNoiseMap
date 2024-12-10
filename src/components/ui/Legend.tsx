import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { colors } from "../../utils/generate";
import type { Biome } from "../../utils/generate";
import { useState } from "react";

const Legend = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const biomeGroups = {
    Eau: ["deep_ocean", "shallow_ocean", "river", "lake"] as Biome[],
    Terres: ["grassland", "forest", "rainforest", "savanna"] as Biome[],
    "Déserts & Glaces": ["desert", "ice", "tundra", "beach"] as Biome[],
    Montagnes: ["mountains", "snow_mountains"] as Biome[],
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/70 backdrop-blur-md text-white/70 px-4 py-2 z-50 rounded-2xl shadow-lg max-w-xs">
      <button
        className="w-full text-sm flex items-center justify-between focus:outline-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3>Légende</h3>
        <span className="text-sm ml-2">
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4" />
          ) : (
            <ChevronUpIcon className="w-4 h-4" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-4 mt-2">
          {Object.entries(biomeGroups).map(([group, biomes]) => (
            <div key={group}>
              <h4 className="font-medium text-sm mb-1">{group}</h4>
              <div className="grid grid-cols-2 gap-2">
                {biomes.map((biome) => (
                  <div key={biome} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{
                        backgroundColor: `hsl(${colors[biome].h}, ${colors[biome].s}%, ${colors[biome].l}%)`,
                      }}
                    />
                    <span className="text-sm capitalize">
                      {biome.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Legend;
