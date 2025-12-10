import React from 'react';
import { Activity, Radio, LayoutDashboard, BrainCircuit } from 'lucide-react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onChangeView }) => {
  const navItems = [
    { id: AppView.DASHBOARD, icon: LayoutDashboard, label: 'Hub' },
    { id: AppView.WORKOUT_PLANNER, icon: BrainCircuit, label: 'Plan' },
    { id: AppView.LIVE_SESSION, icon: Activity, label: 'Session' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 glass-panel border-t border-slate-200 dark:border-slate-800 z-50 px-6">
      <div className="max-w-md mx-auto h-full flex items-center justify-between">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`flex flex-col items-center justify-center space-y-1 transition-all duration-300 ${
              currentView === item.id 
                ? 'text-cyan-600 dark:text-cyan-400 scale-110 aura-text-glow' 
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <item.icon size={24} strokeWidth={currentView === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-medium tracking-wider uppercase">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;