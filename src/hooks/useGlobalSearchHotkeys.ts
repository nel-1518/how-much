import { useEffect, useRef, type ComponentRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { Input } from "antd";
import type { ItemDbEntry, ViewMode } from "../types";
import { isEditableTarget } from "../utils/dom";

interface UseGlobalSearchHotkeysParams {
  /** 搜索卡片当前是否打开 */
  showResults: boolean;
  /** 当前视图模式（批量模式下单品搜索快捷键不生效） */
  viewMode: ViewMode;
  /** 设置弹窗是否打开 */
  settingsOpen: boolean;
  /** 信息弹窗是否打开 */
  infoOpen: boolean;
  /** 顶部搜索输入框引用（键盘唤起时聚焦 / 切换 Tab 时读取内容） */
  topInputRef: RefObject<ComponentRef<typeof Input> | null>;
  /** 关闭搜索卡片 */
  closeSearchCard: () => void;
  /** 切换历史侧栏开关 */
  onToggleSidebar: () => void;
  /** 打开卡片时是否让卡片内输入框自动聚焦 */
  setFocusCardOnOpen: (value: boolean) => void;
  /** 顶部输入框内容变化（唤起卡片 / 粘贴回填） */
  onKeywordChange: (value: string) => void;
  setActiveIndex: (index: number) => void;
  setShowResults: (value: boolean) => void;
  /** 粘贴文本精确匹配物品，命中返回条目 */
  findExactName: (query: string) => ItemDbEntry | undefined;
  /** 按本地库条目直接查价 */
  selectByDbEntry: (entry: ItemDbEntry) => void;
}

/**
 * 全局搜索快捷键与粘贴接管。
 *
 * 集中处理：
 * - Esc 关闭卡片；`` ` `` 开关历史侧栏（仅非输入控件）
 * - Tab 开关卡片；字母/数字或 IME 首个按键唤起卡片并聚焦顶部输入框
 * - Ctrl/Cmd+V 粘贴：精确匹配物品时直达查价，否则回填到顶部输入框
 *
 * 内部维护 `showResultsRef`（避免闭包过期）、`composingRef`（IME 组合中标记）
 * 与 `pendingKeyRef`（键盘唤起后首字符未落地的补入）。
 */
export function useGlobalSearchHotkeys({
  showResults,
  viewMode,
  settingsOpen,
  infoOpen,
  topInputRef,
  closeSearchCard,
  onToggleSidebar,
  setFocusCardOnOpen,
  onKeywordChange,
  setActiveIndex,
  setShowResults,
  findExactName,
  selectByDbEntry,
}: UseGlobalSearchHotkeysParams) {
  // 键盘打开卡片时的状态：待补入的首字符、IME 组合中标记
  const pendingKeyRef = useRef<string | null>(null);
  const composingRef = useRef(false);

  // 记录卡片开合状态，供全局键盘监听使用（避免闭包过期）
  const showResultsRef = useRef(showResults);
  useEffect(() => {
    showResultsRef.current = showResults;
  }, [showResults]);

  // 全局键盘：Esc 关闭卡片；Tab 开关卡片；字母/数字或 IME 首个按键打开卡片并聚焦输入框；
  // Ctrl+V 粘贴直接打开并置入输入栏
  useEffect(() => {
    const openAndFocusCard = () => {
      // 同步渲染卡片并聚焦顶部输入框，让当前按键的默认行为
      // （拉丁字符插入 / IME 组合输入）直接落到已聚焦的输入框上
      setFocusCardOnOpen(false);
      flushSync(() => {
        setActiveIndex(0);
        setShowResults(true);
      });
      topInputRef.current?.focus();
    };

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showResultsRef.current) {
          e.preventDefault();
          closeSearchCard();
        }
        return;
      }
      if (settingsOpen || infoOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // `：打开 / 关闭历史侧栏（输入框内不拦截，避免影响正常输入）
      if (e.key === "`") {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        onToggleSidebar();
        return;
      }

      // 批量查价模式：单品搜索的 Tab/字母/粘贴快捷键不生效（Esc、侧栏开关仍可用）
      if (viewMode === "batch") return;

      // Tab：卡片打开时关闭；关闭时打开并聚焦卡片内输入框
      // 顶部输入框已有内容时保留内容（显示对应搜索结果）并全选，空内容时显示历史
      if (e.key === "Tab") {
        if (showResultsRef.current) {
          e.preventDefault();
          closeSearchCard();
          return;
        }
        e.preventDefault();
        setFocusCardOnOpen(true);
        setActiveIndex(0);
        const current = topInputRef.current?.input?.value ?? "";
        onKeywordChange(current);
        return;
      }

      if (showResultsRef.current) return;
      if (isEditableTarget(e.target)) return;
      if (e.isComposing) return;

      // IME 组合首键（keyCode 229 / key "Process"）：只打开并聚焦，不插入、不阻止默认行为
      if (e.keyCode === 229 || e.key === "Process") {
        pendingKeyRef.current = null;
        openAndFocusCard();
        return;
      }

      // 字母/数字：不阻止默认行为，让字符直接进入输入框
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        pendingKeyRef.current = e.key;
        openAndFocusCard();
      }
    };

    const handleCompositionStart = (e: CompositionEvent) => {
      composingRef.current = true;
      // 组合若发生在输入框内（顶部或卡片内），不干预焦点；
      // 仅在组合落在非输入框元素上（页面空白处打字唤起卡片的兜底场景）时聚焦顶部输入框
      if (isEditableTarget(e.target)) return;
      if (showResultsRef.current) {
        topInputRef.current?.focus();
      }
    };
    const handleCompositionEnd = () => {
      composingRef.current = false;
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (viewMode === "batch") return;
      if (showResultsRef.current || settingsOpen) return;
      const target = e.target as HTMLElement | null;
      const inEditable = isEditableTarget(e.target);
      // 只接管页面空白处或顶部搜索输入框内的粘贴，其余输入控件保持原生粘贴
      if (inEditable && !target?.closest(".search-trigger-input")) return;
      const text = (e.clipboardData?.getData("text") ?? "").replace(/\s+/g, " ").trim();
      if (!text) return;
      e.preventDefault();

      // 粘贴内容唯一精确匹配到物品时，直接查价
      const exact = findExactName(text);
      if (exact) {
        selectByDbEntry(exact);
        return;
      }

      onKeywordChange(text);
      setFocusCardOnOpen(false);
      topInputRef.current?.focus();
    };

    document.addEventListener("keydown", handler);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("compositionstart", handleCompositionStart);
    document.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      document.removeEventListener("keydown", handler);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("compositionstart", handleCompositionStart);
      document.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [settingsOpen, infoOpen, viewMode, closeSearchCard, onToggleSidebar, onKeywordChange, setActiveIndex, setShowResults, setFocusCardOnOpen, findExactName, selectByDbEntry, topInputRef]);

  // 键盘打开卡片后，若首个字符没有进入输入框（浏览器未把默认行为重定向到输入框），手动补入
  useEffect(() => {
    const key = pendingKeyRef.current;
    if (key == null) return;
    pendingKeyRef.current = null;
    const timer = window.setTimeout(() => {
      if (composingRef.current) return;
      const el = topInputRef.current?.input;
      if (!el || el.value !== key) {
        onKeywordChange(key);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showResults, onKeywordChange, topInputRef]);
}
