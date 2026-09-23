import { useSyncExternalStore } from "react";

// Site language. English is the default; a visitor's choice is remembered per browser.

export type Lang = "en" | "zh";

const KEY = "lang";
let lang: Lang = "en";
let restored = false;
const listeners = new Set<() => void>();

function apply() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  apply();
  listeners.forEach((l) => l());
}

export function getLang() {
  return lang;
}

/** Pick up a remembered choice once on the client (after hydration, so SSR stays English). */
export function restoreLang() {
  if (restored) return;
  restored = true;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {}
  if (saved === "zh") setLang("zh");
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLang(): Lang {
  return useSyncExternalStore(
    subscribe,
    () => lang,
    () => "en",
  );
}
