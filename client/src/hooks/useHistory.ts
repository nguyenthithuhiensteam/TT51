import { useCallback, useRef, useState } from "react";

export function useHistory<T>(initial: T) {
  const [value, setValueState] = useState<T>(initial);
  const past = useRef<T[]>([]);

  const setValue = useCallback((updater: T | ((prev: T) => T)) => {
    setValueState((prev) => {
      past.current.push(prev);
      if (past.current.length > 20) past.current.shift();
      return typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater;
    });
  }, []);

  const replaceWithoutHistory = useCallback((next: T) => {
    setValueState(next);
    past.current = [];
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev !== undefined) setValueState(prev);
  }, []);

  return { value, setValue, replaceWithoutHistory, undo, canUndo: past.current.length > 0 };
}
