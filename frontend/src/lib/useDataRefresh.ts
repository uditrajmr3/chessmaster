import { useEffect } from "react";

export const DATA_REFRESH_EVENT = "chess:data-refresh";

export function emitDataRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT));
  }
}

export function useDataRefresh(callback: () => void) {
  useEffect(() => {
    const handler = () => callback();
    window.addEventListener(DATA_REFRESH_EVENT, handler);
    return () => window.removeEventListener(DATA_REFRESH_EVENT, handler);
  }, [callback]);
}
