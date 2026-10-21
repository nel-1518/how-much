import { useEffect } from "react";
import { APP_TITLE } from "../constants";

/**
 * 设置网页标题：title 变化时更新，组件卸载时还原为站点基础标题。
 * （在单个查价页用于展示「物品名 - 这个多少钱」）
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = APP_TITLE;
    };
  }, [title]);
}
