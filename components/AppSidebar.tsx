
import React from 'react';
import { LayoutGrid, Code, Zap, Music, Clapperboard, Settings as SettingsIcon, LogOut, HelpCircle } from 'lucide-react';
import { AppView } from '../types';

interface AppSidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onShowHelp?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentView, onNavigate, onLogout, isOpen, setIsOpen, onShowHelp }) => {
  
  const NavIcon = ({ icon, active, onClick, label }: any) => (
    <button 
      onClick={onClick}
      className={`p-3 rounded-xl transition-all duration-200 group relative flex items-center w-full md:w-auto justify-start md:justify-center ${
        active ? 'bg-gray-800 text-primary-500' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300'
      }`}
    >
      {icon}
      <span className="md:hidden ml-3 text-sm font-medium">{label}</span>
      <span className="hidden md:block absolute left-14 top-1/2 transform -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none border border-gray-700 shadow-xl">
        {label}
      </span>
    </button>
  );

  return (
    <>
        {/* Mobile Overlay */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/60 z-[60] md:hidden backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
            />
        )}

        <div className={`
            fixed md:relative top-0 left-0 h-full w-64 md:w-16 bg-gray-950 border-r border-gray-800 
            flex flex-col items-center py-4 gap-4 z-[70] transition-transform duration-300 flex-shrink-0
            ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg mb-4 flex-shrink-0">
                <Zap className="text-white" size={24} fill="currentColor" />
            </div>

            <div className="flex flex-col gap-4 w-full px-2 md:px-0 items-center">
                <NavIcon 
                    icon={<LayoutGrid size={20} />} 
                    active={currentView === AppView.DASHBOARD} 
                    onClick={() => onNavigate(AppView.DASHBOARD)} 
                    label="Dashboard"
                />
                <NavIcon 
                    icon={<Code size={20} />} 
                    active={currentView === AppView.WORKSPACE} 
                    onClick={() => onNavigate(AppView.WORKSPACE)} 
                    label="Workspace"
                />
                <div className="w-8 border-t border-gray-800 my-1"></div>
                <NavIcon 
                    icon={<Zap size={20} />} 
                    active={currentView === AppView.FINETUNE} 
                    onClick={() => onNavigate(AppView.FINETUNE)} 
                    label="Fine-Tune"
                />
                <NavIcon 
                    icon={<Music size={20} />} 
                    active={currentView === AppView.AUDIO} 
                    onClick={() => onNavigate(AppView.AUDIO)} 
                    label="Audio Studio"
                />
                <NavIcon 
                    icon={<Clapperboard size={20} />} 
                    active={currentView === AppView.MEDIA} 
                    onClick={() => onNavigate(AppView.MEDIA)} 
                    label="Media Studio"
                />
            </div>
            
            <div className="mt-auto flex flex-col gap-4 w-full px-2 md:px-0 items-center">
                {onShowHelp && (
                    <NavIcon 
                        icon={<HelpCircle size={20} />} 
                        active={false} 
                        onClick={onShowHelp} 
                        label="Help & Shortcuts"
                    />
                )}
                <NavIcon 
                    icon={<SettingsIcon size={20} />} 
                    active={currentView === AppView.SETTINGS} 
                    onClick={() => onNavigate(AppView.SETTINGS)} 
                    label="Settings"
                />
                <button 
                    onClick={onLogout}
                    className="p-3 rounded-xl text-gray-500 hover:bg-red-900/20 hover:text-red-400 transition-all md:w-auto w-full flex items-center justify-center md:block"
                    title="Sign Out"
                >
                    <LogOut size={20} />
                    <span className="md:hidden ml-3 text-sm font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    </>
  );
};
