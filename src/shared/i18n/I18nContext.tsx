import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGES, STRINGS, type Language, type TranslationKey } from './strings';

const LANGUAGE_STORAGE_KEY = 'alif-shohoj-language';

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const readStoredLanguage = (): Language => {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && (LANGUAGES as readonly string[]).includes(stored)) return stored as Language;
  } catch (error) {
    console.error('Could not read the saved interface language.', error);
  }
  return DEFAULT_LANGUAGE;
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch (error) {
      console.error('Could not save the interface language.', error);
    }
  }, []);

  const t = useCallback<Translate>((key, params) => {
    const entry: string = STRINGS[key][language] || STRINGS[key][DEFAULT_LANGUAGE];
    if (!params) return entry;
    return Object.entries(params).reduce<string>(
      (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
      entry
    );
  }, [language]);

  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside an I18nProvider');
  return context;
};
