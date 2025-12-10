export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WORKOUT_PLANNER = 'WORKOUT_PLANNER',
  LIVE_SESSION = 'LIVE_SESSION',
  ANALYSIS = 'ANALYSIS'
}

export interface WorkoutPlan {
  title: string;
  duration: string;
  difficulty: string;
  exercises: Exercise[];
}

export interface Exercise {
  name: string;
  durationOrReps: string;
  description: string;
  tips: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface FormAnalysisResult {
  score: number;
  feedback: string;
  corrections: string[];
}