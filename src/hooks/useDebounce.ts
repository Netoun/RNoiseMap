import { FunctionComponent, useCallback, useEffect, useRef } from "react";

export const useDebounce = (
  func: FunctionComponent,
  delay: number
): ((...args: unknown[]) => unknown) => {
  const timeoutRef = useRef<number>();

  const debouncedFunc = useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        func({}, ...args);
      }, delay);
    },
    [func, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFunc;
};
