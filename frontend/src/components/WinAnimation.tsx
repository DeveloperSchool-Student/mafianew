import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export function WinAnimation({ winner }: { winner: string }) {
    const isMafiaOrManiac = winner === 'МАФІЯ' || winner === 'МАНІЯК' || winner === 'СЕРІЙНИЙ ВБИВЦЯ';

    // Confetti particles for citizens
    const [particles, setParticles] = useState<any[]>([]);

    useEffect(() => {
        if (!isMafiaOrManiac) {
            const newParticles = Array.from({ length: 50 }).map((_, i) => ({
                id: i,
                x: Math.random() * 100, // vw
                y: -10 - Math.random() * 20, // vh
                color: ['#FFD700', '#FF4500', '#00BFFF', '#32CD32'][Math.floor(Math.random() * 4)],
                delay: Math.random() * 2,
                duration: 2 + Math.random() * 3,
                size: 5 + Math.random() * 10
            }));
            setParticles(newParticles);
        }
    }, [isMafiaOrManiac]);

    return (
        <div className="fixed inset-0 z-[110] pointer-events-none overflow-hidden flex items-center justify-center">
            {isMafiaOrManiac ? (
                // Blood splash / screen red out
                <div className="absolute inset-0">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0.6] }}
                        transition={{ duration: 1.5, ease: 'easeOut' }}
                        className="absolute inset-0 bg-red-950/60 mix-blend-multiply"
                    />
                    <motion.div
                        initial={{ scale: 3, opacity: 0, rotate: -10 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        transition={{ duration: 0.8, ease: 'backOut' }}
                        className="absolute inset-0 flex items-center justify-center opacity-40"
                    >
                         <div className="w-[150%] h-[150%] bg-[radial-gradient(circle,_#7f0000_0%,_transparent_70%)]" />
                    </motion.div>
                </div>
            ) : (
                // Confetti fall
                <div className="absolute inset-0">
                    {particles.map(p => (
                        <motion.div
                            key={p.id}
                            initial={{ top: `${p.y}vh`, left: `${p.x}vw`, rotate: 0 }}
                            animate={{ top: '110vh', left: `${p.x + (Math.random() * 10 - 5)}vw`, rotate: 360 * p.duration }}
                            transition={{ duration: p.duration, delay: p.delay, ease: 'linear', repeat: Infinity }}
                            className="absolute rounded-sm shadow-[0_0_5px_rgba(255,255,255,0.5)]"
                            style={{ backgroundColor: p.color, width: p.size, height: p.size * 2, zIndex: 10 }}
                        />
                    ))}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        transition={{ duration: 2 }}
                        className="absolute inset-0 bg-yellow-500/10 mix-blend-screen"
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,215,0,0.15)_0%,_transparent_70%)]" />
                </div>
            )}

            {/* Victory Text Overlay */}
            <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 100 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.5, type: 'spring', damping: 15 }}
                className="relative z-[120] text-center px-4"
            >
                <div className="bg-black/80 backdrop-blur-xl border-2 border-white/20 p-8 sm:p-12 rounded-[2rem] shadow-[0_0_60px_rgba(0,0,0,0.8)]">
                    <motion.h2 
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`text-5xl sm:text-8xl font-black mb-4 uppercase tracking-[0.2em] italic ${isMafiaOrManiac ? 'text-red-600 drop-shadow-[0_0_20px_#7f0000]' : 'text-yellow-500 drop-shadow-[0_0_20px_#b8860b]'}`}
                    >
                        {winner}
                    </motion.h2>
                    <p className="text-xl sm:text-3xl font-bold text-white/90 uppercase tracking-widest">
                        ОТРИМАЛИ ПЕРЕМОГУ!
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
