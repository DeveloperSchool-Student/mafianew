import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';

interface MobileChatDrawerProps {
    isOpen: boolean;
    onToggle: () => void;
    unreadCount: number;
    children: React.ReactNode;
}

export function MobileChatDrawer({ isOpen, onToggle, unreadCount, children }: MobileChatDrawerProps) {
    const [dragY, setDragY] = useState(0);
    const drawerRef = useRef<HTMLDivElement>(null);

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            {/* Chat Toggle Button - Fixed at bottom right */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        onClick={onToggle}
                        className="fixed bottom-4 right-4 z-40 bg-[#1a1a1a] border border-gray-700 hover:border-gray-500 rounded-full p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.6)] active:scale-95 transition-transform"
                        style={{ minWidth: 52, minHeight: 52 }}
                        id="mobile-chat-toggle"
                    >
                        <MessageCircle size={22} className="text-gray-200" />
                        {unreadCount > 0 && (
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1 shadow-lg"
                            >
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </motion.span>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={onToggle}
                    />
                )}
            </AnimatePresence>

            {/* Drawer container — always mounted to preserve ChatPanel state.
                 Uses translate + visibility for hiding so children keep their state
                 (scroll position, input drafts, activeTab, notepad). */}
            <div
                ref={drawerRef}
                className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-[#0d0d0d] border-t border-gray-700 rounded-t-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)]"
                style={{
                    transform: isOpen
                        ? `translateY(${dragY > 0 ? dragY : 0}px)`
                        : 'translateY(100%)',
                    visibility: isOpen ? 'visible' : 'hidden',
                    transition: isOpen
                        ? (dragY > 0 ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), visibility 0s')
                        : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), visibility 0s 0.3s',
                }}
                id="mobile-chat-drawer"
            >
                {/* Drag Handle */}
                <div
                    className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing shrink-0"
                    onTouchStart={(e) => {
                        const startY = e.touches[0].clientY;
                        let currentDragY = 0;

                        const onMove = (ev: TouchEvent) => {
                            currentDragY = Math.max(0, ev.touches[0].clientY - startY);
                            setDragY(currentDragY);
                        };

                        const onEnd = () => {
                            if (currentDragY > 100) {
                                onToggle();
                            }
                            setDragY(0);
                            document.removeEventListener('touchmove', onMove);
                            document.removeEventListener('touchend', onEnd);
                        };

                        document.addEventListener('touchmove', onMove, { passive: true });
                        document.addEventListener('touchend', onEnd);
                    }}
                >
                    <div className="w-10 h-1 bg-gray-600 rounded-full"></div>
                </div>

                {/* Drawer Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <MessageCircle size={16} className="text-gray-400" />
                        <span className="text-sm font-bold text-gray-200 uppercase tracking-wider">Чат</span>
                    </div>
                    <button
                        onClick={onToggle}
                        className="p-2 rounded-full hover:bg-gray-800 transition-colors active:scale-95"
                        style={{ minWidth: 40, minHeight: 40 }}
                    >
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                {/* Chat Content - takes ~65% of viewport */}
                <div className="flex-1 overflow-hidden" style={{ height: '65dvh', maxHeight: '65dvh' }}>
                    {children}
                </div>
            </div>
        </>
    );
}
