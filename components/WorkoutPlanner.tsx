import React, { useState } from 'react';
import { Sparkles, Loader2, Play } from 'lucide-react';
import { generateWorkoutPlan } from '../services/geminiService';
import { WorkoutPlan } from '../types';

interface WorkoutPlannerProps {
  onStartWorkout: (plan: WorkoutPlan) => void;
}

const WorkoutPlanner: React.FC<WorkoutPlannerProps> = ({ onStartWorkout }) => {
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState(20);
  const [level, setLevel] = useState('Intermediate');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedPlan, setGeneratedPlan] = useState<WorkoutPlan | null>(null);

  const handleGenerate = async () => {
    if (!goal) return;
    setLoading(true);
    setError('');
    try {
      const plan = await generateWorkoutPlan(goal, level, duration);
      setGeneratedPlan(plan);
    } catch (err) {
      setError('Failed to generate workout. Check API key or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pb-24 max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="space-y-2">
        <h2 className="text-3xl font-light text-slate-900 dark:text-white tracking-tight">
          Neural <span className="text-cyan-600 dark:text-cyan-400 font-semibold aura-text-glow">Planner</span>
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">AI-architected routines for your physiology.</p>
      </div>

      {!generatedPlan ? (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Focus Area</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Core strength, Yoga for back pain, HIIT cardio..."
              className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all shadow-sm dark:shadow-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Duration (min)</label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="text-right text-cyan-600 dark:text-cyan-400 font-mono">{duration} min</div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Intensity</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 shadow-sm dark:shadow-none"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Elite">Elite</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !goal}
            className={`w-full py-4 rounded-xl flex items-center justify-center space-x-2 font-bold tracking-wide transition-all ${
              loading || !goal 
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                : 'bg-cyan-500 text-white dark:text-slate-950 hover:bg-cyan-400 hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            }`}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
            <span>{loading ? 'ARCHITECTING ROUTINE...' : 'GENERATE SEQUENCE'}</span>
          </button>
          
          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border-cyan-500/30">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{generatedPlan.title}</h3>
                <div className="flex space-x-3 text-xs font-mono text-cyan-600 dark:text-cyan-400">
                  <span className="bg-cyan-100 dark:bg-cyan-950/50 px-2 py-1 rounded">{generatedPlan.duration}</span>
                  <span className="bg-cyan-100 dark:bg-cyan-950/50 px-2 py-1 rounded">{generatedPlan.difficulty.toUpperCase()}</span>
                </div>
              </div>
              <button 
                onClick={() => setGeneratedPlan(null)}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-white text-sm"
              >
                Reset
              </button>
            </div>
            
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {generatedPlan.exercises.map((ex, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900/50 p-3 rounded-lg border-l-2 border-slate-200 dark:border-slate-700 hover:border-cyan-500 transition-colors shadow-sm dark:shadow-none">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{ex.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{ex.durationOrReps}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{ex.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
               <button
                onClick={() => onStartWorkout(generatedPlan)}
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl flex items-center justify-center space-x-2 font-bold text-white hover:from-cyan-500 hover:to-blue-500 hover:shadow-lg dark:hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all"
              >
                <Play size={20} fill="currentColor" />
                <span>INITIATE SESSION</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkoutPlanner;