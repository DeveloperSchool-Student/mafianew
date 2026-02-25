import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const toggle = () => {
        const next = i18n.language === 'uk' || i18n.language === 'ua' ? 'en' : 'uk';
        i18n.changeLanguage(next);
    };

    const currentLang = i18n.language === 'en' ? 'EN' : 'UA';

    return (
        <button
            onClick={toggle}
            className="flex items-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-2 py-1.5 rounded transition"
            title="Switch language"
        >
            <Globe size={14} />
            {currentLang}
        </button>
    );
}
