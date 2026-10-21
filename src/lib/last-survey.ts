import { useEffect, useState } from "react";

let value: Date | null = null;
const listeners = new Set<(d: Date | null) => void>();

export function setLastSurvey(d: Date | null) {
  value = d;
  listeners.forEach((l) => l(d));
}

export function useLastSurvey() {
  const [d, setD] = useState<Date | null>(value);
  useEffect(() => {
    listeners.add(setD);
    setD(value);
    return () => {
      listeners.delete(setD);
    };
  }, []);
  return d;
}
