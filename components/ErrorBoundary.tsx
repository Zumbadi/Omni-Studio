import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  handleRetry = () => {
      this.setState({ hasError: false, error: null });
      window.location.reload();
  };

  handleHardReset = () => {
      if (window.confirm("This will clear all local storage and reset the app. Are you sure?")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  render() {
    if (this.state.hasError) {
      // Safely stringify error to avoid [object Object]
      const errorMessage = this.state.error instanceof Error 
        ? this.state.error.message 
        : typeof this.state.error === 'object' && this.state.error !== null
            ? JSON.stringify(this.state.error) 
            : String(this.state.error);

      return (
        <div className="h-screen w-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6 relative overflow-hidden">
          {/* Background Noise */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
          
          <div className="bg-red-900/20 border border-red-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl relative z-10 backdrop-blur-xl animate-in zoom-in duration-300">
             <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-700/50 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                 <AlertTriangle size={32} className="text-red-400 animate-pulse" />
             </div>
             
             <h2 className="text-xl font-bold mb-2 tracking-tight text-white">System Malfunction</h2>
             
             <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                The neural interface encountered a critical error.
                <br/>
                <span className="font-mono text-red-300 text-xs mt-4 block bg-black/40 p-3 rounded border border-red-900/50 text-left overflow-x-auto whitespace-pre-wrap shadow-inner max-h-32">
                    {errorMessage || "Unknown Error"}
                </span>
             </p>
             
             <div className="flex flex-col gap-3">
                 <button 
                    onClick={this.handleRetry}
                    className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-red-900/20"
                 >
                    <RefreshCw size={16} /> Reboot System
                 </button>
                 
                 <button 
                    onClick={this.handleHardReset}
                    className="w-full bg-transparent hover:bg-red-900/20 text-red-300 border border-red-800/50 px-6 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all text-xs"
                 >
                    <Trash2 size={14} /> Factory Reset (Clear Data)
                 </button>
             </div>
          </div>
          
          <div className="absolute bottom-8 text-xs text-gray-600 font-mono">
              ERR_CODE: CORE_DUMP_EXCEPTION
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}