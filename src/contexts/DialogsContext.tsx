import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** 设置 / 关于弹窗的开关状态 */
export interface DialogsValue {
  settingsOpen: boolean;
  infoOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  openInfo: () => void;
  closeInfo: () => void;
}

const DialogsContext = createContext<DialogsValue | null>(null);

/** 持有设置 / 关于弹窗的开关，供侧栏与内容区共享 */
export function DialogsProvider({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const openInfo = useCallback(() => setInfoOpen(true), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);

  const value = useMemo<DialogsValue>(
    () => ({ settingsOpen, infoOpen, openSettings, closeSettings, openInfo, closeInfo }),
    [settingsOpen, infoOpen, openSettings, closeSettings, openInfo, closeInfo],
  );

  return <DialogsContext.Provider value={value}>{children}</DialogsContext.Provider>;
}

/** 读取设置 / 关于弹窗状态与操作 */
// 与 Provider 同文件导出 hook：仅影响该文件的 Fast Refresh 粒度（改动时整页刷新），可接受
// eslint-disable-next-line react-refresh/only-export-components
export function useDialogs(): DialogsValue {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs 必须在 DialogsProvider 内使用");
  return ctx;
}
