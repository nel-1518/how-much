/**
 * DOM 相关的小工具函数。
 */

/**
 * 判断事件目标是否为可编辑控件（输入框 / 文本域 / 下拉框 / contentEditable）。
 * 用于全局快捷键与粘贴拦截时放行输入控件自身的行为。
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}
