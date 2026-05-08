import { useEffect, type RefObject } from "react";

/**
 * 点击外部区域时触发回调
 * @param ref - 要监听的元素引用
 * @param callback - 点击外部时执行的回调
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, callback: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, callback]);
}
