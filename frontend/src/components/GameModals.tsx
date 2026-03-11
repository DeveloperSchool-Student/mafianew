import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface WhisperModalProps {
    isOpen: boolean;
    targetUsername: string;
    onClose: () => void;
    onSend: (message: string) => void;
}

export function WhisperModal({ isOpen, targetUsername, onClose, onSend }: WhisperModalProps) {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (!message.trim()) return;
        onSend(message.trim());
        setMessage('');
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
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-[#111] border border-gray-700 rounded-xl p-5 shadow-2xl max-w-md mx-auto"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-bold text-white">
                                🗣️ Шепнути <span className="text-blue-400">{targetUsername}</span>
                            </h3>
                            <button
                                onClick={onClose}
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
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition text-sm"
                                style={{ minHeight: 44 }}
                            >
                                Скасувати
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!message.trim()}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2.5 rounded-lg transition text-sm"
                                style={{ minHeight: 44 }}
                            >
                                Надіслати
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

interface ReportInGameModalProps {
    isOpen: boolean;
    targetUsername: string;
    onClose: () => void;
    onSubmit: (reason: string, screenshotUrl?: string) => void;
}

export function ReportInGameModal({ isOpen, targetUsername, onClose, onSubmit }: ReportInGameModalProps) {
    const [reason, setReason] = useState('');
    const [screenshotUrl, setScreenshotUrl] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        if (!reason.trim()) return;
        onSubmit(reason.trim(), screenshotUrl.trim() || undefined);
        setReason('');
        setScreenshotUrl('');
        setSubmitted(true);
        setTimeout(() => {
            setSubmitted(false);
            onClose();
        }, 1500);
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
                        onClick={onClose}
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
                                        onClick={onClose}
                                        className="p-1.5 rounded-full hover:bg-gray-800 transition"
                                        style={{ minWidth: 36, minHeight: 36 }}
                                    >
                                        <X size={16} className="text-gray-400" />
                                    </button>
                                </div>
                                <textarea
                                    autoFocus
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="Причина скарги..."
                                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-orange-600 mb-3 resize-none"
                                    style={{ minHeight: 80 }}
                                    maxLength={500}
                                    rows={3}
                                />
                                <input
                                    type="text"
                                    value={screenshotUrl}
                                    onChange={e => setScreenshotUrl(e.target.value)}
                                    placeholder="URL скріншота (необов'язково)"
                                    className="w-full bg-[#0a0a0a] border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-gray-500 mb-4"
                                    style={{ minHeight: 44 }}
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={onClose}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-2.5 rounded-lg transition text-sm"
                                        style={{ minHeight: 44 }}
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!reason.trim()}
                                        className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2.5 rounded-lg transition text-sm"
                                        style={{ minHeight: 44 }}
                                    >
                                        Надіслати
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
