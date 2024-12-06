import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

const Switch = ({ checked, onCheckedChange }: { checked: boolean, onCheckedChange: (checked: boolean) => void }) => {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="group relative inline-flex h-[25px] w-[42px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-black/80 shadow-[0_2px_10px_rgba(0,0,0,0.3)] transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 data-[state=checked]:bg-black"
    >
      <SwitchPrimitive.Thumb 
        className="pointer-events-none block h-[21px] w-[21px] rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[19px] data-[state=unchecked]:translate-x-[2px]"
      />
    </SwitchPrimitive.Root>
  );
};

export { Switch };
