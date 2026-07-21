import { useEffect, useRef } from 'react';

/** Poll API as fallback when Socket.IO misses events (common on live/proxy deploys) */
export function useLivePolling(callback, intervalMs, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    const tick = () => callbackRef.current?.();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

/** Refetch when socket (re)connects */
export function useSocketReconnectRefetch(socket, callback, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!socket || !enabled) return undefined;

    const refetch = () => callbackRef.current?.();
    if (socket.connected) refetch();

    socket.on('connect', refetch);
    return () => socket.off('connect', refetch);
  }, [socket, enabled]);
}
