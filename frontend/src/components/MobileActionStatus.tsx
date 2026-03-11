import { motion, AnimatePresence } from 'framer-motion';
import { Check, Target, AlertCircle } from 'lucide-react';

interface MobileActionStatusProps {
    /** Current game phase */
    phase: string | null;
    /** Whether current player has voted */
    hasVoted: boolean;
    /** Name of the target you voted/acted on */
    votedTargetName?: string;
    /** Whether current player has performed night action */
    hasActedNight: boolean;
    /** Night action target name */
    nightTargetName?: string;
    /** Role for journalist multi-select */
    role?: string | null;
    /** Journalist selected count */
    journalistSelectedCount?: number;
}

export function MobileActionStatus({
    phase,
    hasVoted,
    votedTargetName,
    hasActedNight,
    nightTargetName,
    role,
    journalistSelectedCount = 0,
}: MobileActionStatusProps) {
    // Journalist multi-target feedback
    if (phase === 'NIGHT' && role === 'JOURNALIST') {
        return (
            <AnimatePresence mode="wait">
                <motion.div
                    key={`journalist-${journalistSelectedCount}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="bg-blue-900/30 border border-blue-700/40 rounded-lg px-3 py-2 flex items-center gap-2"
                >
                    <Target size={14} className="text-blue-400 shrink-0" />
                    <span className="text-xs text-blue-300 font-medium">
                        {journalistSelectedCount === 0 && 'Оберіть 2 цілі для порівняння'}
                        {journalistSelectedCount === 1 && 'Обрано 1/2 — оберіть другу ціль'}
                        {journalistSelectedCount === 2 && 'Обрано 2/2 ✓'}
                    </span>
                </motion.div>
            </AnimatePresence>
        );
    }

    // Day voting feedback
    if (phase === 'DAY_VOTING' && hasVoted) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-900/30 border border-green-700/40 rounded-lg px-3 py-2 flex items-center gap-2"
            >
                <Check size={14} className="text-green-400 shrink-0" />
                <span className="text-xs text-green-300 font-medium">
                    Ви вже проголосували{votedTargetName ? ` за ${votedTargetName}` : ''}
                </span>
            </motion.div>
        );
    }

    // Night action feedback
    if (phase === 'NIGHT' && hasActedNight) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-purple-900/30 border border-purple-700/40 rounded-lg px-3 py-2 flex items-center gap-2"
            >
                <AlertCircle size={14} className="text-purple-400 shrink-0" />
                <span className="text-xs text-purple-300 font-medium">
                    Дію вибрано{nightTargetName ? `: ${nightTargetName}` : ''}
                </span>
            </motion.div>
        );
    }

    return null;
}
