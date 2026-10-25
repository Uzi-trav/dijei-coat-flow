import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import es from "./locales/es.json";
import en from "./locales/en.json";
import ko from "./locales/ko.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
      ko: { translation: ko },
    },
    supportedLngs: ["en", "ko"],
    fallbackLng: "ko",
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "coatx-flow-language",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});
