import { useToastStore } from '../store/toastStore';
import { Check, X, Info } from 'lucide-react';

export function ToastContainer() {
    const { toasts, removeToast } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-20 right-4 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => {
                const isSuccess = toast.type === 'success';
                const isError = toast.type === 'error';
                
                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto px-4 py-3 rounded border text-sm font-bold flex items-center gap-2 shadow-2xl animate-in fade-in slide-in-from-top-4 ${
                            isSuccess ? 'bg-green-900/90 text-green-300 border-green-800' :
                            isError ? 'bg-red-900/90 text-red-300 border-red-800' :
                            'bg-blue-900/90 text-blue-300 border-blue-800'
                        }`}
                        onClick={() => removeToast(toast.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        {isSuccess ? <Check size={16} /> : isError ? <X size={16} /> : <Info size={16} />}
                        <span className="flex-1 drop-shadow-md">{toast.message}</span>
                    </div>
                );
            })}
        </div>
    );
}
