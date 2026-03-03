import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Target, Zap, Clock } from 'lucide-react';

export function Guide() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-mafia-dark text-mafia-light p-4 xl:p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl mt-4">
                <button onClick={() => navigate('/lobby')} className="mb-6 text-mafia-red hover:underline font-bold flex items-center gap-2">
                    &larr; Повернутися в Лоббі
                </button>

                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 xl:p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <BookOpen size={200} />
                    </div>

                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-4">
                        <BookOpen className="text-mafia-red" size={40} /> Посібник Гравця
                    </h1>
                    <p className="text-gray-400 mb-10 text-lg">Повні правила гри, опис ролей та механік взаємодії.</p>

                    <section className="mb-12 relative z-10">
                        <h2 className="text-2xl font-bold text-mafia-light mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
                            <Target className="text-blue-500" /> 1. Основні правила та мета
                        </h2>
                        <div className="text-gray-300 space-y-4 text-sm xl:text-base leading-relaxed">
                            <p>
                                <b>Мафія</b> — це командна психологічна покрокова гра з детективним сюжетом.
                                Гравці випадковим чином отримують ролі і діляться на дві основні фракції: <b>Мирні жителі</b> та <b>Мафія</b>.
                                Також у грі можуть бути присутні нейтральні ролі з власними цілями (наприклад, Маніяк або Блазень).
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                <div className="bg-blue-900/20 border border-blue-900 p-4 rounded-lg">
                                    <h3 className="font-bold text-blue-400 mb-2">Мета Мирних:</h3>
                                    <p>Знайти та стратити всіх учасників фракції Мафії та інших зловмисників (Маніяка) на денному голосуванні.</p>
                                </div>
                                <div className="bg-red-900/20 border border-red-900 p-4 rounded-lg">
                                    <h3 className="font-bold text-mafia-red mb-2">Мета Мафії:</h3>
                                    <p>Вбивати мирних жителів вночі та заплутувати місто вдень, доки їх кількість не зрівняється або не перевищить кількість мирних.</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mb-12 relative z-10">
                        <h2 className="text-2xl font-bold text-mafia-light mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
                            <Clock className="text-yellow-500" /> 2. Фази гри
                        </h2>
                        <div className="bg-[#111] p-6 rounded-lg text-gray-300 space-y-6 text-sm xl:text-base">
                            <div>
                                <h3 className="font-bold text-yellow-500 text-lg mb-1">День: Обговорення</h3>
                                <p>Усі гравці прокидаються і дізнаються новини минулої ночі. Протягом виділеного часу місто має обговорити підозри та спробувати вирахувати мафію за допомогою логіки, блефу та звинувачень.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-orange-500 text-lg mb-1">День: Голосування</h3>
                                <p>Після обговорення гравці голосують проти одного кандидата. Той, хто набере найбільше голосів, буде страчений. Якщо голоси рівні або більшість натисла "Skip" — страти не відбувається.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-indigo-500 text-lg mb-1">Ніч: Активні дії</h3>
                                <p>Місто "засинає" (чат блокується). Мафія потайки домовляється, кого вбити. Ролі з активними здібностями (Шериф, Лікар, Маніяк тощо) обирають цілі для своїх дій.</p>
                            </div>
                        </div>
                    </section>

                    <section className="mb-12 relative z-10">
                        <h2 className="text-2xl font-bold text-mafia-light mb-6 flex items-center gap-2 border-b border-gray-800 pb-2">
                            <Users className="text-purple-500" /> 3. Опис Ролей
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Мирні */}
                            <div className="bg-[#111] p-5 rounded-lg border border-blue-900/30">
                                <h3 className="font-bold text-blue-500 text-xl border-b border-blue-900/50 pb-2 mb-4">🔵 Мирні жителі</h3>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <div className="font-bold text-white">Мирний (Citizen)</div>
                                        <p className="text-gray-400">Не має спеціальних нічних дій. Повинен знайти мафію під час денних дискусій.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-yellow-500">Шериф (Sheriff)</div>
                                        <p className="text-gray-400">Щоночі перевіряє одного гравця, щоб дізнатись, чи є він членом мафії. Також має здатність застрелити гравця — <strong className="text-yellow-400">але якщо Шериф стріляє в Мирного жителя, гине і Мирний, і сам Шериф.</strong> Якщо стріляє в справжнього злочинця — виживає.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-green-500">Лікар (Doctor)</div>
                                        <p className="text-gray-400">Щоночі обирає одного гравця для лікування. Якщо мафія спробує вбити цього гравця, він виживе. Не може лікувати себе двічі поспіль.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-pink-500">Ескорт (Escort)</div>
                                        <p className="text-gray-400">Щоночі відвідує гравця і "відволікає" його. Обраний гравець блокується і не може виконати свою нічну дію. <strong className="text-pink-400">Ескорт може блокувати одного і того ж гравця кілька ночей поспіль</strong> — обмежень немає.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-cyan-500">Мер (Mayor)</div>
                                        <p className="text-gray-400">Світла роль, голос якої на денному голосуванні рахується як <strong className="text-cyan-400">2 голоси замість одного</strong>. Подвійний голос Мера працює <strong className="text-cyan-400">анонімно</strong> — інші гравці бачать лише загальну кількість голосів проти кандидата, але не знають, хто саме є Мером.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Мафія */}
                            <div className="bg-[#111] p-5 rounded-lg border border-red-900/30">
                                <h3 className="font-bold text-red-500 text-xl border-b border-red-900/50 pb-2 mb-4">🔴 Мафія</h3>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <div className="font-bold text-red-500">Мафія (Mafia)</div>
                                        <p className="text-gray-400">Члени угруповання. Мають власний нічний чат. Щоночі спільно обирають одну жертву для вбивства.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-red-600">Дон (Don)</div>
                                        <p className="text-gray-400">Голова Мафії. Крім участі у вбивстві, щоночі перевіряє одного гравця в пошуках Шерифа.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-purple-600">Адвокат (Lawyer)</div>
                                        <p className="text-gray-400">Щоночі "захищає" одного гравця мафії. Якщо тієї ночі Шериф перевірить цього гравця, він побачить результат "НЕ МАФІЯ".</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-red-400">Глушувач (Silencer)</div>
                                        <p className="text-gray-400">Щоночі обирає гравця. На наступний день обраний гравець не зможе писати в чат.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Нейтрали */}
                            <div className="col-span-1 md:col-span-2 bg-[#111] p-5 rounded-lg border border-purple-900/30">
                                <h3 className="font-bold text-purple-500 text-xl border-b border-purple-900/50 pb-2 mb-4">🟣 Нейтральні ролі</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="font-bold text-orange-600">Серійний Вбивця (Serial Killer)</div>
                                        <p className="text-gray-400">Грає сам за себе. Щоночі обирає жертву і вбиває її. Перемагає, якщо залишається останнім вижившим.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-pink-600">Блазень (Jester)</div>
                                        <p className="text-gray-400">Грає сам за себе. Його єдина мета — зробити так, щоб місто стратило його на денному голосуванні. Якщо це стається — Блазень самостійно здобуває перемогу.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Додаткові ролі */}
                            <div className="col-span-1 md:col-span-2 bg-[#111] p-5 rounded-lg border border-gray-700/50 mt-2">
                                <h3 className="font-bold text-gray-400 text-xl border-b border-gray-700 pb-2 mb-4">⚙️ Додаткові ролі (Залежить від налаштувань)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <div className="font-bold text-blue-400">Охоронець (Bodyguard)</div>
                                        <p className="text-gray-400">Мирна роль. Вночі захищає гравця. Якщо на ціль нападають, захищає її, але сам може загинути разом з нападником.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-blue-300">Слідопит (Tracker)</div>
                                        <p className="text-gray-400">Мирна роль. Вночі слідкує за одним гравцем і дізнається, кого той відвідував.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-blue-200">Інформатор (Informer)</div>
                                        <p className="text-gray-400">Мирна роль. Збирає конфіденційну інформацію про ролі гравців або події вночі.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-yellow-600">Суддя (Judge)</div>
                                        <p className="text-gray-400">Може анонімно вплинути на результати денного голосування та самостійно винести вердикт.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-red-700">Підривник (Bomber)</div>
                                        <p className="text-gray-400">Небезпечна роль. Вночі закладає вибухівку, яка може здетонувати і знищити кількох гравців.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-green-700">Трапер (Trapper)</div>
                                        <p className="text-gray-400">Ставить пастки біля будинку гравця. Той, хто першим прийде до нього вночі — потрапить у пастку.</p>
                                    </div>
                                    <div>
                                        <div className="font-bold text-pink-400">Коханці (Lovers)</div>
                                        <p className="text-gray-400">Двоє гравців, які знають одне одного і мають вижити разом. Якщо один з коханців гине — інший помирає від розбитого серця.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="mb-4 relative z-10">
                        <h2 className="text-2xl font-bold text-mafia-light mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
                            <Zap className="text-green-500" /> 4. Порядок вирішення нічних дій
                        </h2>
                        <div className="text-gray-300 space-y-2 text-sm xl:text-base leading-relaxed bg-[#111] p-6 rounded-lg font-mono">
                            <p>1. Блокування (Ескорт)</p>
                            <p>2. Захист та Зміна результатів (Лікар, Адвокат, Охоронець)</p>
                            <p>3. Вбивства (Мафія, Серійний Вбивця, Постріл Шерифа)</p>
                            <p>4. Розвідувальні дії (Шериф, Дон, Следопит)</p>
                            <br />
                            <p className="text-xs text-gray-500 mt-4">* Якщо вас заблокував Ескорт, ваша дія (навіть вбивство) не спрацює!</p>
                        </div>
                    </section>

                    <section className="mb-4 relative z-10">
                        <h2 className="text-2xl font-bold text-mafia-light mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
                            <Users className="text-red-500" /> 5. Правила поведінки
                        </h2>
                        <div className="bg-[#111] p-6 rounded-lg text-gray-300 space-y-4 text-sm xl:text-base border border-red-900/30">
                            <div>
                                <h3 className="font-bold text-red-400">5.1. Повага до гравців</h3>
                                <p className="text-gray-400">Заборонені будь-які прямі образи, розпалювання ворожнечі, погрози в бік інших гравців чи адміністрації.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-red-400">5.2. Спам та Флуд</h3>
                                <p className="text-gray-400">Заборонено засмічувати чат беззмістовними повідомленнями, рекламою, або надсилати одне й те саме повідомлення багато разів підряд.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-red-400">5.3. Чесна гра (Без читів / Багоюзу)</h3>
                                <p className="text-gray-400">Суворо заборонено використовувати стороннє ПЗ, скрипти або баги гри для отримання переваги. Про всі баги слід повідомляти адміністрацію.</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-red-400">5.4. Гра в команді (Злив інфи)</h3>
                                <p className="text-gray-400">Заборонено навмисно піддаватися, зливати ролі своїх напарників (якщо ви мафія), або "грати по дискорду" (отримувати інформацію поза ігровим чатом).</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-red-400">5.5. Відмовляння від гри / AFK</h3>
                                <p className="text-gray-400">Входити в кімнату і стояти AFK без попередження, спеціальне самогубство чи вихід з гри заради псування досвіду іншим - карається.</p>
                            </div>
                            <div className="mt-4 p-3 bg-red-900/20 border-l-4 border-mafia-red rounded">
                                <p className="text-sm font-bold text-mafia-light">УВАГА:</p>
                                <p className="text-xs text-gray-400">Адміністрація має право видавати покарання (Мут, Кік, Бан) на свій розсуд, спираючись на ці правила. Рішення Власника та Старшої адміністрації є остаточними.</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div >
        </div >
    );
}
