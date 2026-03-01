import { Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Privacy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-gray-300 p-6 md:p-12 font-sans tracking-wide">
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-mafia-red hover:text-red-400 mb-8 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Повернутися
                </button>

                <div className="bg-[#111] border border-red-900/30 rounded-xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-900/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-800">
                        <div className="bg-red-900/20 p-4 rounded-full border border-red-900/50">
                            <Shield className="text-mafia-red w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white uppercase tracking-widest">Політика Конфіденційності</h1>
                            <p className="text-sm text-gray-500 mt-1">Останнє оновлення: Лютий 2026</p>
                        </div>
                    </div>

                    <div className="space-y-8 text-sm md:text-base leading-relaxed">
                        <section>
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-mafia-red"></span> 1. Загальні положення
                            </h2>
                            <p>
                                Ця Політика Конфіденційності пояснює, як ми збираємо, використовуємо та захищаємо ваші дані
                                під час користування сайтом Mafia Online. Реєструючись на нашому сайті, ви автоматично
                                погоджуєтесь з усіма умовами, викладеними нижче.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-mafia-red"></span> 2. Збір даних
                            </h2>
                            <ul className="list-disc pl-5 space-y-2 text-gray-400">
                                <li><strong>Облікові дані:</strong> Ми зберігаємо ваш логін (username) та хешований пароль.</li>
                                <li><strong>Ігрова статистика:</strong> Інформація про зіграні матчі, досягнення та дії в грі.</li>
                                <li><strong>Зовнішні акаунти:</strong> При використанні OAuth, ми отримуємо базовий ідентифікатор вашого Google або Discord акаунту виключно для входу. Ми не збираємо ваші особисті фотографії чи контакти.</li>
                            </ul>
                        </section>

                        <section className="bg-red-950/20 border-l-4 border-mafia-red p-5 my-8 rounded-r-lg shadow-inner">
                            <h2 className="text-lg font-bold text-red-500 mb-2 uppercase tracking-wide">
                                ⚠️ 3. Відмова від відповідальності (Disclaimer)
                            </h2>
                            <p className="text-red-200/90 font-medium">
                                Адміністрація проекту вживає всіх розумних заходів для захисту бази даних. Однак, у разі
                                <strong className="text-white"> несанкціонованого доступу (злому)</strong> до серверів або баз даних проекту:
                            </p>
                            <ul className="list-disc pl-5 mt-3 space-y-1 text-red-300 font-medium">
                                <li>Адміністрація не несе жодної фінансової або юридичної відповідальності.</li>
                                <li>
                                    Ми категорично попереджаємо, що ми <strong className="text-red-400">не несемо відповідальності за збереження або безпеку даних прив'язаних сторонніх акаунтів (Google, Discord, Telegram тощо).</strong>
                                </li>
                                <li>Рекомендуємо використовувати унікальні паролі та включити 2FA (Двофакторну аутентифікацію) для ваших основних соціальних мереж та пошт.</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-mafia-red"></span> 4. Видалення даних
                            </h2>
                            <p>
                                Ви маєте право вимагати повного видалення вашого акаунту та історії матчів. Для цього зверніться до Адміністрації проекту (Власника) через офіційні канали зв'язку або всередині гри.
                            </p>
                        </section>
                    </div>

                    <div className="mt-12 pt-6 border-t border-gray-800 text-center text-xs text-gray-600">
                        &copy; {new Date().getFullYear()} Mafia Online. Всі права захищено.
                    </div>
                </div>
            </div>
        </div>
    );
}
