import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

export function useMobileChatUI(isMobile: boolean) {
    const { gameState } = useAppStore();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastSeenChatLen, setLastSeenChatLen] = useState(0);

    // Track unread messages when chat is closed on mobile
    useEffect(() => {
        if (isMobile && !isChatOpen) {
            const currentLen = gameState.chat?.length || 0;
            if (currentLen > lastSeenChatLen) {
                setUnreadCount(prev => prev + (currentLen - lastSeenChatLen));
            }
            setLastSeenChatLen(currentLen);
        }
    }, [gameState.chat?.length, isMobile, isChatOpen, lastSeenChatLen]);

    // Reset unread when chat opens
    useEffect(() => {
        if (isChatOpen) {
            setUnreadCount(0);
            setLastSeenChatLen(gameState.chat?.length || 0);
        }
    }, [isChatOpen, gameState.chat?.length]);

    return {
        isChatOpen,
        setIsChatOpen,
        unreadCount
    };
}
