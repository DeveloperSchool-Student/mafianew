import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';

// ===========================
// WhisperModal
// ===========================

interface WhisperModalProps {
    isOpen: boolean;
    targetUsername: string;
    onClose: () => void;
    onSend: (message: string) => Promise<{success: boolean; error?: string}> | void;
}

export function WhisperModal({ isOpen, targetUsername, onClose, onSend }: WhisperModalProps) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSend = useCallback(async () => {
        if (!message.trim() || isSending) return;
        setIsSending(true);
        const res = await onSend(message.trim()) as any;
        if (res?.success === false) {
            setIsSending(false);
            return;
        }
        setMessage('');
        setSent(true);
        // Brief success feedback then close
        setTimeout(() => {
            setSent(false);
            setIsSending(false);
            onClose();
        }, 1000);
    }, [message, isSending, onSend, onClose]);

    const handleClose = () => {
        if (isSending) return; // Don't close mid-send
        setMessage('');
        setSent(false);
        setIsSending(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                        onClick={handleClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#111] border border-gray-700 rounded-xl p-5 shadow-2xl max-w-md mx-auto"
                    >
                        {sent ? (
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="text-center py-6"
                            >
                                <div className="text-4xl mb-3">✅</div>
                                <p className="text-green-400 font-bold">Повідомлення надіслано!</p>
                            </motion.div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-bold text-white">
                                        🗣️ Шепнути <span className="text-blue-400">{targetUsername}</span>
                                    </h3>
                                    <button
                                        onClick={handleClose}
                                        className="p-1.5 rounded-full hover:bg-gray-800 transition"
                                        style={{ minWidth: 36, minHeight: 36 }}
                                    >
                                        <X size={16} className="text-gray-400" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-3">Вартість: 10 coins</p>
                                <input
                                    type="text"
                                    autoFocus
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Ваше повідомлення..."
                                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-blue-600 mb-4"
                                    style={{ minHeight: 44 }}
                                    maxLength={200}
                                    disabled={isSending}
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition text-sm"
                                        style={{ minHeight: 44 }}
                                        disabled={isSending}
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        onClick={handleSend}
                                        disabled={!message.trim() || isSending}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
                                        style={{ minHeight: 44 }}
                                    >
                                        {isSending ? (
                                            <><Loader2 size={14} className="animate-spin" /> Надсилання...</>
                                        ) : 'Надіслати'}
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// ===========================
// ReportInGameModal
// ===========================

interface ReportInGameModalProps {
    isOpen: boolean;
    targetUsername: string;
    onClose: () => void;
    /** Now returns a promise that resolves to success/error */
    onSubmit: (reason: string, screenshotUrl?: string) => Promise<{ success: boolean; error?: string }>;
}

export function ReportInGameModal({ isOpen, targetUsername, onClose, onSubmit }: ReportInGameModalProps) {
    const [reason, setReason] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!reason.trim() || isSubmitting) return;
        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            const result = await onSubmit(reason.trim(), screenshotUrl.trim() || undefined);

            if (result.success) {
                setReason('');
                setScreenshotUrl('');
                setSubmitted(true);
                setTimeout(() => {
                    setSubmitted(false);
                    onClose();
                }, 1500);
            } else {
                setErrorMsg(result.error || 'Помилка при надсиланні скарги');
            }
        } catch {
            setErrorMsg('Не вдалося надіслати скаргу. Спробуйте ще раз.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (isSubmitting) return;
        setReason('');
        setScreenshotUrl('');
        setErrorMsg(null);
        setSubmitted(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                        onClick={handleClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#111] border border-gray-700 rounded-xl p-5 shadow-2xl max-w-md mx-auto"
                    >
                        {submitted ? (
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                className="text-center py-6"
                            >
                                <div className="text-4xl mb-3">✅</div>
                                <p className="text-green-400 font-bold">Скаргу надіслано!</p>
                            </motion.div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-bold text-white">
                                        ⚠️ Скарга на <span className="text-orange-400">{targetUsername}</span>
                                    </h3>
                                    <button
                                        onClick={handleClose}
                                        className="p-1.5 rounded-full hover:bg-gray-800 transition"
                                        style={{ minWidth: 36, minHeight: 36 }}
                                        disabled={isSubmitting}
                                    >
                                        <X size={16} className="text-gray-400" />
                                    </button>
                                </div>

                                {/* Error message */}
                                {errorMsg && (
                                    <div className="mb-3 bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2 text-red-300 text-xs">
                                        ❌ {errorMsg}
                                    </div>
                                )}

                                <textarea
                                    autoFocus
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Причина скарги..."
                                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-orange-600 mb-3 resize-none"
                                    style={{ minHeight: 80 }}
                                    maxLength={500}
                                    rows={3}
                                    disabled={isSubmitting}
                                />
                                <input
                                    type="text"
                                    value={screenshotUrl}
                                    onChange={e => setScreenshotUrl(e.target.value)}
                                    placeholder="URL скріншота (необов'язково)"
                                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-gray-500 mb-4"
                                    style={{ minHeight: 44 }}
                                    disabled={isSubmitting}
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleClose}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition text-sm"
                                        style={{ minHeight: 44 }}
                                        disabled={isSubmitting}
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!reason.trim() || isSubmitting}
                                        className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2"
                                        style={{ minHeight: 44 }}
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 size={14} className="animate-spin" /> Надсилання...</>
                                        ) : 'Надіслати'}
                                    </button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
