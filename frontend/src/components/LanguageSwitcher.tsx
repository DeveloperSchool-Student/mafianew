import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const newLang = i18n.language.startsWith('uk') ? 'en' : 'uk';
        i18n.changeLanguage(newLang);
    };

    return (
        <button
            onClick={toggleLanguage}
            className="p-2 bg-mafia-gray border border-gray-700 rounded text-sm text-gray-300 hover:text-white hover:border-gray-500 transition"
        >
            {i18n.language.startsWith('uk') ? '🇺🇦 UA' : '🇬🇧 EN'}
        </button>
    );
}
