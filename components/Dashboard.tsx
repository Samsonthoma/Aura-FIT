import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame, Trophy, Timer, Activity, Sun, Moon } from 'lucide-react';

interface DashboardProps {
  isDark: boolean;
  toggleTheme: () => void;
}

const data = [
  { name: 'Mon', score: 65 },
  { name: 'Tue', score: 78 },
  { name: 'Wed', score: 72 },
  { name: 'Thu', score: 85 },
  { name: 'Fri', score: 82 },
  { name: 'Sat', score: 90 },
  { name: 'Sun', score: 88 },
];

const Dashboard: React.FC<DashboardProps> = ({ isDark, toggleTheme }) => {
  return (
    <div className="p-6 pb-24 space-y-8 animate-in fade-in duration-500">
      
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white">
            AURA <span className="text-cyan-600 dark:text-cyan-400 font-bold aura-text-glow">FIT</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 font-mono">SYSTEM READY // USER DETECTED</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:scale-110 transition-all"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
            AF
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-32 hover:border-cyan-500/50 transition-colors">
          <div className="p-2 bg-orange-100 dark:bg-orange-500/20 w-fit rounded-lg text-orange-600 dark:text-orange-400">
            <Flame size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">1,240</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kcal Burned</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-32 hover:border-cyan-500/50 transition-colors">
          <div className="p-2 bg-purple-100 dark:bg-purple-500/20 w-fit rounded-lg text-purple-600 dark:text-purple-400">
            <Trophy size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">12</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sessions</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-32 hover:border-cyan-500/50 transition-colors">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 w-fit rounded-lg text-blue-600 dark:text-blue-400">
            <Timer size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">4.5h</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time Active</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-32 hover:border-cyan-500/50 transition-colors">
          <div className="p-2 bg-green-100 dark:bg-green-500/20 w-fit rounded-lg text-green-600 dark:text-green-400">
            <Activity size={20} />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-white">88%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Form Score</div>
          </div>
        </div>
      </div>

      {/* Form Score Chart */}
      <div className="glass-panel p-6 rounded-2xl h-72">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-6">Performance Matrix</h3>
        <ResponsiveContainer width="100%" height="80%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isDark ? "#06b6d4" : "#0891b2"} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={isDark ? "#06b6d4" : "#0891b2"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                borderColor: isDark ? '#334155' : '#e2e8f0', 
                color: isDark ? '#f8fafc' : '#0f172a',
                borderRadius: '0.75rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              itemStyle={{ color: '#06b6d4' }}
            />
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke={isDark ? "#06b6d4" : "#0891b2"} 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorScore)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default Dashboard;