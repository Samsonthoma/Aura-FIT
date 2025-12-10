import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Navigation from './components/Navigation';
import WorkoutPlanner from './components/WorkoutPlanner';
import LiveSession from './components/LiveSession';
import { AppView, WorkoutPlan } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const startWorkout = (plan: WorkoutPlan) => {
    setActivePlan(plan);
    setCurrentView(AppView.LIVE_SESSION);
  };

  const endWorkout = () => {
    setActivePlan(null);
    setCurrentView(AppView.DASHBOARD);
  };

  const renderView = () => {
    switch (currentView) {
      case AppView.DASHBOARD:
        return <Dashboard isDark={theme === 'dark'} toggleTheme={toggleTheme} />;
      case AppView.WORKOUT_PLANNER:
        return <WorkoutPlanner onStartWorkout={startWorkout} />;
      case AppView.LIVE_SESSION:
        // Live session handles its own dark mode wrapper internally to maintain AR aesthetic
        if (activePlan) {
            return <LiveSession plan={activePlan} onExit={endWorkout} />;
        }
        return <WorkoutPlanner onStartWorkout={startWorkout} />; 
      default:
        return <Dashboard isDark={theme === 'dark'} toggleTheme={toggleTheme} />;
    }
  };

  return (
    <div className={`${theme}`}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-cyan-500/30 transition-colors duration-500">
        
        <main className="max-w-md mx-auto min-h-screen relative shadow-2xl shadow-slate-200 dark:shadow-slate-900 bg-slate-50 dark:bg-slate-950 overflow-hidden">
          {/* Background Ambient Glows - Adjusted for Light Mode */}
          <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-200/30 dark:bg-cyan-900/20 blur-[80px] dark:blur-[100px] pointer-events-none transition-all duration-700" />
          <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-200/30 dark:bg-purple-900/20 blur-[80px] dark:blur-[100px] pointer-events-none transition-all duration-700" />
          
          {renderView()}

          {/* Hide Nav during Live Session */}
          {currentView !== AppView.LIVE_SESSION && (
            <Navigation currentView={currentView} onChangeView={setCurrentView} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;