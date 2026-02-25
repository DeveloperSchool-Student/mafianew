import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation files
import en from './locales/en.json';
import uk from './locales/uk.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: en,
            },
            uk: {
                translation: uk,
            },
            ua: {
                translation: uk, // Fallback for 'ua' code to 'uk' (Ukrainian standard code is uk)
            }
        },
        fallbackLng: 'uk', // Default to Ukrainian
        interpolation: {
            escapeValue: false, // React already safes from xss
        },
    });

export default i18n;
