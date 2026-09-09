import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true once React has attached
 * event handlers. Buttons whose only behaviour is a client-side handler should
 * stay disabled until then, otherwise an early click is silently lost.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
