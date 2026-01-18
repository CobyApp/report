import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ko from './locales/ko.json'
import en from './locales/en.json'
import ja from './locales/ja.json'

i18n
  .use(LanguageDetector) // 브라우저 언어 자동 감지
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      ja: { translation: ja },
    },
    fallbackLng: 'ko', // 기본 언어
    supportedLngs: ['ko', 'en', 'ja'],
    interpolation: {
      escapeValue: false, // React는 이미 XSS 방지
    },
    detection: {
      order: ['localStorage', 'navigator'], // localStorage 우선, 없으면 브라우저 언어
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
