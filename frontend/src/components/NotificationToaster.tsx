import { useNotificationStore } from '../store/notificationStore';
import type { NotificationType } from '../store/notificationStore';
import { X, CheckCircle, Info, AlertTriangle, XCircle } from 'lucide-react';
import React from 'react';

const icons: Record<NotificationType, React.ReactNode> = {
    success: <CheckCircle className="text-green-400" size={20} />,
    info: <Info className="text-blue-400" size={20} />,
    warning: <AlertTriangle className="text-yellow-400" size={20} />,
    error: <XCircle className="text-red-400" size={20} />
};

const borderColors: Record<NotificationType, string> = {
    success: 'border-green-500/50 bg-green-900/10',
    info: 'border-blue-500/50 bg-blue-900/10',
    warning: 'border-yellow-500/50 bg-yellow-900/10',
    error: 'border-red-500/50 bg-red-900/10'
};

export function NotificationToaster() {
    const notifications = useNotificationStore(state => state.notifications);
    const removeNotification = useNotificationStore(state => state.removeNotification);

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {notifications.map(notif => (
                <div
                    key={notif.id}
                    className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-xl backdrop-blur-sm transform transition-all duration-300 translate-y-0 opacity-100 ${borderColors[notif.type]}`}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {icons[notif.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">{notif.title}</h4>
                        <p className="text-gray-300 text-xs mt-1 leading-relaxed">{notif.message}</p>
                    </div>
                    <button
                        onClick={() => removeNotification(notif.id)}
                        className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
}
