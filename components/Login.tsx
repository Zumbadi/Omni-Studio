import React, { useState } from 'react';
import { Github, Mail, Command, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      onLogin();
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full bg-gray-950 flex items-center justify-center relative overflow-hidden selection:bg-primary-500/30">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-xl border border-gray-800 p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-6 rotate-3 hover:rotate-6 transition-transform duration-500">
             <Command className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Omni-Studio</h1>
          <p className="text-gray-400 text-center">The AI-Native Development Environment for <br/> Web, Mobile, and Model Fine-Tuning.</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-white text-black font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Github size={20} />}
            Continue with GitHub
          </button>
          
          <button 
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-gray-800 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 border border-gray-700 hover:bg-gray-700 transition-all active:scale-[0.98] disabled:opacity-70"
          >
             <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
             Continue with Google
          </button>
        </div>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gray-900 px-2 text-gray-500">Or with email</span>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
           <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                placeholder="engineer@omni.ai"
                className="w-full bg-gray-950/50 border border-gray-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder-gray-600"
              />
           </div>
           <Button className="w-full py-3 rounded-xl" onClick={handleLogin}>
              {isLoading ? 'Authenticating...' : 'Sign In'} <ArrowRight size={16} className="ml-2" />
           </Button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-600">
           By clicking continue, you agree to our <a href="#" className="text-gray-400 hover:text-white underline">Terms of Service</a> and <a href="#" className="text-gray-400 hover:text-white underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};