import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { storage } from "../storage";

/** 历史侧栏的开合与宽度状态 */
export interface SidebarValue {
  /** 是否展开 */
  open: boolean;
  /** 当前宽度（px） */
  width: number;
  /** 是否正在拖拽调整宽度 */
  resizing: boolean;
  /** 切换展开 / 收起（桌面端持久化） */
  toggle: () => void;
  /** 收起侧栏 */
  close: () => void;
  /** 开始拖拽调整宽度 */
  resizeStart: () => void;
  /** 拖拽中更新宽度（不持久化） */
  resize: (width: number) => void;
  /** 拖拽结束：持久化宽度并结束 resizing */
  resizeEnd: (width: number) => void;
}

const SidebarContext = createContext<SidebarValue | null>(null);

/** 持有侧栏状态，供 TopNav / HistorySidebar / App 骨架共享 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  // 移动端默认关闭（不继承桌面端记忆）；桌面端记住上次开关状态
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
        ? false
        : storage.sidebar.load().open,
  );
  const [width, setWidth] = useState(() => storage.sidebar.load().width);
  const [resizing, setResizing] = useState(false);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      // 移动端不持久化（每次进入默认关闭）；桌面端记住开关状态
      if (!window.matchMedia("(max-width: 768px)").matches) {
        storage.sidebar.setOpen(next);
      }
      return next;
    });
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const resizeStart = useCallback(() => setResizing(true), []);
  const resize = useCallback((w: number) => setWidth(w), []);
  const resizeEnd = useCallback((w: number) => {
    storage.sidebar.setWidth(w);
    setResizing(false);
  }, []);

  const value = useMemo<SidebarValue>(
    () => ({ open, width, resizing, toggle, close, resizeStart, resize, resizeEnd }),
    [open, width, resizing, toggle, close, resizeStart, resize, resizeEnd],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

/** 读取侧栏状态与操作 */
// 与 Provider 同文件导出 hook：仅影响该文件的 Fast Refresh 粒度（改动时整页刷新），可接受
// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar(): SidebarValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar 必须在 SidebarProvider 内使用");
  return ctx;
}
