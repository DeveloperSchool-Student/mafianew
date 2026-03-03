import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface PunishmentRow {
    violation: string;
    first: string;
    second: string;
    third: string;
    category: 'light' | 'medium' | 'heavy' | 'critical';
}

const punishments: PunishmentRow[] = [
    // Легкі порушення
    { violation: 'Спам / Флуд у чаті', first: 'Мут 15 хв', second: 'Мут 1 год', third: 'Мут 24 год', category: 'light' },
    { violation: 'Реклама / Посилання', first: 'Мут 30 хв', second: 'Мут 6 год', third: 'Мут 48 год', category: 'light' },
    { violation: 'Капс (CAPS LOCK) зловживання', first: 'Попередження', second: 'Мут 15 хв', third: 'Мут 1 год', category: 'light' },
    { violation: 'Нікнейм з образливим змістом', first: 'Попередження + вимога змінити', second: 'Бан 24 год', third: 'Бан 7 днів', category: 'light' },

    // Середні порушення
    { violation: 'Образа гравців', first: 'Мут 1 год', second: 'Мут 24 год', third: 'Бан 3 дні', category: 'medium' },
    { violation: 'Розпалювання ворожнечі / Провокація', first: 'Мут 2 год', second: 'Мут 24 год', third: 'Бан 7 днів', category: 'medium' },
    { violation: 'AFK / Ігнорування гри (умисне)', first: 'Попередження', second: 'Бан 1 год', third: 'Бан 24 год', category: 'medium' },
    { violation: 'Злив ролі (своєї або тіммейта)', first: 'Мут 6 год', second: 'Бан 24 год', third: 'Бан 7 днів', category: 'medium' },

    // Важкі порушення
    { violation: 'Образа адміністрації', first: 'Мут 6 год', second: 'Бан 3 дні', third: 'Бан 14 днів', category: 'heavy' },
    { violation: 'Погрози гравцям або персоналу', first: 'Бан 7 днів', second: 'Бан 30 днів', third: 'Пермабан', category: 'heavy' },
    { violation: 'Гра через Дискорд / сторонній зв\'язок', first: 'Бан 3 дні', second: 'Бан 14 днів', third: 'Пермабан', category: 'heavy' },
    { violation: 'Злив інформації з адмін-чату', first: 'Бан 14 днів', second: 'Пермабан', third: '—', category: 'heavy' },

    // Критичні порушення
    { violation: 'Чити / Скрипти / Багоюз', first: 'Пермабан', second: '—', third: '—', category: 'critical' },
    { violation: 'Мультиаккаунтинг (гра з кількох акаунтів)', first: 'Бan всіх акаунтів 30 днів', second: 'Пермабан', third: '—', category: 'critical' },
    { violation: 'Реальні погрози / Доксинг', first: 'Пермабан', second: '—', third: '—', category: 'critical' },
    { violation: 'Шахрайство (економіка)', first: 'Бан 30 днів + скидання балансу', second: 'Пермабан', third: '—', category: 'critical' },
];

const categoryColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
    light: { bg: 'bg-yellow-900/20', text: 'text-yellow-500', border: 'border-yellow-700/50', label: '⚠️ Легкі' },
    medium: { bg: 'bg-orange-900/20', text: 'text-orange-500', border: 'border-orange-700/50', label: '🔶 Середні' },
    heavy: { bg: 'bg-red-900/20', text: 'text-red-500', border: 'border-red-700/50', label: '🔴 Важкі' },
    critical: { bg: 'bg-red-950/30', text: 'text-red-400', border: 'border-red-500/50', label: '🚫 Критичні' },
};

export function PunishmentGrid() {
    const navigate = useNavigate();
    const categories = ['light', 'medium', 'heavy', 'critical'] as const;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-4 md:p-8">
            <div className="max-w-5xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
                >
                    <ArrowLeft size={20} /> Назад
                </button>

                <div className="bg-[#111] border border-red-900/30 rounded-xl p-6 md:p-8 shadow-2xl">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="bg-red-900/20 p-3 rounded-full border border-red-900/50">
                            <ShieldAlert className="text-mafia-red w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white uppercase tracking-widest">
                                Сітка Покарань
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Внутрішній документ для модераторів та адміністраторів
                            </p>
                        </div>
                    </div>

                    <div className="mt-2 mb-8 p-3 bg-blue-900/20 border border-blue-800/50 rounded text-blue-400 text-xs">
                        <strong>Примітка:</strong> Строки покарань є рекомендованими. Адміністрація може коригувати
                        рішення залежно від контексту та тяжкості ситуації. Рішення Власника є остаточним.
                    </div>

                    {categories.map(cat => {
                        const style = categoryColors[cat];
                        const rows = punishments.filter(p => p.category === cat);

                        return (
                            <div key={cat} className="mb-8">
                                <h2 className={`text-lg font-bold ${style.text} mb-3 uppercase tracking-wider`}>
                                    {style.label} порушення
                                </h2>

                                <div className={`rounded-lg border ${style.border} overflow-hidden`}>
                                    <div className="grid grid-cols-12 gap-0 text-xs font-bold text-gray-500 uppercase bg-[#0d0d0d] border-b border-gray-800">
                                        <div className="col-span-5 md:col-span-4 p-3">Порушення</div>
                                        <div className="col-span-2 md:col-span-3 p-3 text-center">1-й раз</div>
                                        <div className="col-span-2 md:col-span-3 p-3 text-center">2-й раз</div>
                                        <div className="col-span-3 md:col-span-2 p-3 text-center">3-й раз+</div>
                                    </div>

                                    <div className="divide-y divide-gray-800/50">
                                        {rows.map((row, idx) => (
                                            <div
                                                key={idx}
                                                className={`grid grid-cols-12 gap-0 text-sm ${style.bg} hover:bg-gray-800/30 transition-colors`}
                                            >
                                                <div className="col-span-5 md:col-span-4 p-3 font-medium text-gray-200">
                                                    {row.violation}
                                                </div>
                                                <div className="col-span-2 md:col-span-3 p-3 text-center text-gray-400">
                                                    {row.first}
                                                </div>
                                                <div className="col-span-2 md:col-span-3 p-3 text-center text-gray-400">
                                                    {row.second}
                                                </div>
                                                <div className={`col-span-3 md:col-span-2 p-3 text-center ${row.third === 'Пермабан' ? 'text-red-400 font-bold' : 'text-gray-400'}`}>
                                                    {row.third}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="mt-8 p-4 bg-[#0d0d0d] border border-gray-800 rounded-lg text-sm text-gray-400 space-y-2">
                        <h3 className="font-bold text-white text-base mb-2">📌 Правила застосування:</h3>
                        <p>• <strong className="text-gray-300">Рецидив:</strong> Кожне наступне порушення того самого типу підвищує рівень покарання.</p>
                        <p>• <strong className="text-gray-300">Обтяжуючі обставини:</strong> Якщо порушення комбінуються (напр., образа + спам), застосовується більш суворе покарання.</p>
                        <p>• <strong className="text-gray-300">Зменшення строку:</strong> За першим разом модератор може обмежитись усним попередженням, якщо ситуація незначна.</p>
                        <p>• <strong className="text-gray-300">Апеляція:</strong> Гравець має право подати апеляцію через систему скарг. Рішення розглядається адміністратором Lv.5+.</p>
                        <p>• <strong className="text-gray-300">Мінімальний рівень:</strong> Мут може видавати Хелпер (Lv.2+). Бан — Старший Модератор (Lv.4+). Пермабан — Адміністратор (Lv.6+).</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-800 text-center text-xs text-gray-600">
                        &copy; {new Date().getFullYear()} Mafia Online — Тільки для персоналу
                    </div>
                </div>
            </div>
        </div>
    );
}
