import * as SwitchPrimitive from "@radix-ui/react-switch";

const Switch = ({ checked, onCheckedChange }: { checked: boolean, onCheckedChange: (checked: boolean) => void }) => {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="group relative inline-flex h-[25px] w-[42px] shrink-0 cursor-pointer items-center rounded-full bg-black/40 backdrop-blur-md transition-colors focus:outline-none shadow-xl data-[state=checked]:bg-black/80"
    >
      <SwitchPrimitive.Thumb 
        className="pointer-events-none block h-[21px] w-[21px] rounded-full bg-white/90 shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[19px] data-[state=unchecked]:translate-x-[2px]"
      />
    </SwitchPrimitive.Root>
  );
};

export { Switch };
