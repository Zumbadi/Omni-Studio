
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const Toast: React.FC<ToastMessage & { onClose: () => void }> = ({ type, message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === 'success' ? 'bg-green-900/90 border-green-800' : type === 'error' ? 'bg-red-900/90 border-red-800' : 'bg-blue-900/90 border-blue-800';
  const icon = type === 'success' ? <CheckCircle size={16} className="text-green-400"/> : type === 'error' ? <AlertCircle size={16} className="text-red-400"/> : <Info size={16} className="text-blue-400"/>;

  return (
    <div className={`${bg} text-white text-sm px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 pointer-events-auto animate-in slide-in-from-bottom-5 fade-in duration-300 min-w-[300px] backdrop-blur-md`}>
      {icon}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="text-white/50 hover:text-white"><X size={14}/></button>
    </div>
  );
};
