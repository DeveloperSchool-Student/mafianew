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
        <div className="fixed inset-0 z-[110] pointer-events-none overflow-hidden">
            {isMafiaOrManiac ? (
                // Blood splash / screen red out
                <motion.div
                    initial={{ opacity: 0, backgroundColor: 'rgba(150, 0, 0, 0)' }}
                    animate={{ opacity: [0, 1, 0.8], backgroundColor: ['rgba(200, 0, 0, 0)', 'rgba(120, 0, 0, 0.6)', 'rgba(80, 0, 0, 0.4)'] }}
                    transition={{ duration: 3, ease: 'easeOut' }}
                    className="absolute inset-0"
                >
                    <motion.div
                        initial={{ y: '-100%' }}
                        animate={{ y: '0%' }}
                        transition={{ duration: 4, ease: 'easeOut' }}
                        className="w-full h-[50vh] bg-gradient-to-b from-red-900 via-red-800/80 to-transparent opacity-80"
                        style={{ filter: 'url(#blood-drip)' }} // optionally SVG filter
                    />
                </motion.div>
            ) : (
                // Confetti fall
                <div className="absolute inset-0">
                    {particles.map(p => (
                        <motion.div
                            key={p.id}
                            initial={{ top: `${p.y}vh`, left: `${p.x}vw`, rotate: 0 }}
                            animate={{ top: '110vh', left: `${p.x + (Math.random() * 10 - 5)}vw`, rotate: 360 * p.duration }}
                            transition={{ duration: p.duration, delay: p.delay, ease: 'linear', repeat: Infinity }}
                            className="absolute rounded-sm"
                            style={{ backgroundColor: p.color, width: p.size, height: p.size * 2 }}
                        />
                    ))}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.2 }}
                        transition={{ duration: 2 }}
                        className="absolute inset-0 bg-yellow-500/20 mix-blend-overlay"
                    />
                </div>
            )}
        </div>
    );
}
