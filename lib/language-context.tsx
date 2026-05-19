"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { type Locale, type T, t, isValidLocale } from "./i18n";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  tr: T;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => {},
  tr: t("en"),
});

/** Read saved locale once at mount — lazy initializer avoids setState-in-effect. */
function readSavedLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("papyrus_locale");
  if (saved && isValidLocale(saved)) return saved;
  // Stale or missing — reset to English
  localStorage.setItem("papyrus_locale", "en");
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readSavedLocale);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("papyrus_locale", l);
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, tr: t(locale) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
