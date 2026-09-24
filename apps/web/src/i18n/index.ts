import en from "./en.json";
import vi from "./vi.json";

export type Lang = "vi" | "en";

const tables = { vi, en } as const;

const KEY = "posturecare.lang";

export function loadLang(): Lang {
  const v = localStorage.getItem(KEY);
  return v === "en" ? "en" : "vi";
}

export function saveLang(lang: Lang): void {
  localStorage.setItem(KEY, lang);
}

export function t(lang: Lang, key: keyof typeof vi): string {
  return tables[lang][key] ?? tables.vi[key] ?? key;
}
