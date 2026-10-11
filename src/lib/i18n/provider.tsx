"use client";

import { createContext, useContext, type ReactNode } from "react";

import { getLanguage, getMessages, type MessageDictionary } from "./messages";
import type { Locale } from "./locale";

type I18nValue = { locale: Locale; messages: MessageDictionary };
const I18nContext = createContext<I18nValue>({ locale: "en", messages: getMessages("en") });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, messages: getMessages(locale) }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  return { ...value, language: getLanguage(value.locale) };
}
