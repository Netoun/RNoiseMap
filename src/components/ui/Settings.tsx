import { SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DEFAULT_GENERATION_PARAMS } from '../../utils/generate';
import { Slider } from './Slider';
import { useDebounce } from '../../hooks/useDebounce';

export const Options = {
    octaves: {
        min: 1,
        max: 16,
        step: 1,
    },
    persistence: {
        min: 0.1,
        max: 1,
        step: 0.1,
    },
    scale: {
        min: 0.001,
        max: 0.01,
        step: 0.001,
    },
    amplitude: {
        min: 0.1,
        max: 2,
        step: 0.1,
    },
    frequency: {
        min: 0.1,
        max: 2,
        step: 0.1,
    },
}

interface SettingsProps {
  onParamsChange: (params: typeof DEFAULT_GENERATION_PARAMS) => void;
}

const Settings = ({ onParamsChange }: SettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [params, setParams] = useState<typeof DEFAULT_GENERATION_PARAMS>(DEFAULT_GENERATION_PARAMS);

  const paramsDebounced = useDebounce(params, 1000);

  useEffect(() => {
    onParamsChange(paramsDebounced);
  }, [paramsDebounced]);

  const handleChange = (name: string) => (value: number[]) => {
    const newParams = {
      ...params,
      [name]: value[0],
    };
    setParams(newParams);
  };

  return (
    <div className="fixed top-20 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-fit ml-auto mb-2 flex items-center justify-center px-4 py-3 bg-black/70 backdrop-blur-md text-white/70 rounded-2xl transition-colors text-sm"
      >
        <SettingsIcon className="w-4 h-4 mr-2" />
        {isOpen ? 'Hide Settings' : 'Show Settings'}
      </button>

      {isOpen && (
        <div className="w-64 bg-black/70 backdrop-blur-md rounded-2xl p-4 border border-white/5">
          <div className="space-y-4 text-white/70">
            {
                Object.entries(Options).map(([key, value]) => (
                    <div key={key} className='space-y-2 text-sm'>
                        <label htmlFor={key} className='mb-1'>{key}</label>
                        <Slider
                            min={value.min}
                            max={value.max}
                            step={value.step}
                            value={[params[key as keyof typeof params]]}
                            onValueChange={handleChange(key)}
                        />
                    </div>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 