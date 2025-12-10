import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, ChevronRight, Mic, MicOff, Activity, Radio, ThumbsUp, ScanFace, AlertTriangle } from 'lucide-react';
import { WorkoutPlan } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";

interface LiveSessionProps {
  plan: WorkoutPlan;
  onExit: () => void;
}

// Audio/Video Config
const PCM_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;
const FRAME_RATE = 2; // Frames per second sent to AI for heavy analysis

// Types for Overlay
type FormStatus = 'correct' | 'warning' | 'incorrect' | 'scanning';
type FocusArea = 'head' | 'shoulders' | 'torso' | 'hips' | 'legs' | 'general';

interface OverlayState {
  status: FormStatus;
  feedback: string;
  focusArea: FocusArea;
  lastUpdated: number;
}

// MediaPipe Globals (available via CDN)
declare global {
  interface Window {
    Pose: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

const LiveSession: React.FC<LiveSessionProps> = ({ plan, onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Used for capturing frames for Gemini
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // Used for drawing MediaPipe AR UI
  
  const [currentStep, setCurrentStep] = useState(0);
  const [micActive, setMicActive] = useState(true);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [poseLoaded, setPoseLoaded] = useState(false);
  
  // Overlay State managed by AI
  const overlayStateRef = useRef<OverlayState>({
    status: 'scanning',
    feedback: 'Aligning body...',
    focusArea: 'general',
    lastUpdated: Date.now()
  });

  // Audio Contexts
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const poseInstanceRef = useRef<any>(null);
  const requestFrameRef = useRef<number>(0);
  
  const getAIClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
  };

  const createPcmBlob = (data: Float32Array): { data: string, mimeType: string } => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return {
      data: base64,
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const decodeAudioData = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const dataInt16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(dataInt16.length);
    for (let i = 0; i < dataInt16.length; i++) {
      float32[i] = dataInt16[i] / 32768.0;
    }
    
    const buffer = ctx.createBuffer(1, float32.length, PCM_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);
    return buffer;
  };

  // --- HAPTICS ---

  const triggerHaptic = (pattern: number | number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // --- TOOLS ---

  const nextExerciseTool: FunctionDeclaration = {
    name: "nextExercise",
    description: "Call this when the user performs a 'Thumbs Up' gesture or finishes the reps.",
  };

  const updateFormFeedbackTool: FunctionDeclaration = {
    name: "updateFormFeedback",
    description: "Update the visual overlay to provide specific feedback on the user's form.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { 
          type: Type.STRING, 
          enum: ["correct", "warning", "incorrect"], 
          description: "Assessment of the current form." 
        },
        feedback: { 
          type: Type.STRING, 
          description: "Short, punchy 2-4 word feedback text (e.g. 'Straighten Back', 'Lower Hips')." 
        },
        focusArea: { 
          type: Type.STRING, 
          enum: ["head", "shoulders", "torso", "hips", "legs", "general"], 
          description: "The body part related to the feedback." 
        }
      },
      required: ["status", "feedback", "focusArea"]
    }
  };

  // --- CONNECT ---

  const connectToLive = useCallback(async () => {
    if (connectionStatus === 'connected' || connectionStatus === 'connecting') return;
    setConnectionStatus('connecting');

    try {
      const ai = getAIClient();
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: PCM_SAMPLE_RATE });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!micActive || !sessionPromiseRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData);
        sessionPromiseRef.current.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };
      
      source.connect(processor);
      processor.connect(inputAudioContextRef.current.destination);

      const systemInstruction = `
        You are 'Aura', an elite AI fitness coach.
        
        Current Exercise: ${plan.exercises[currentStep]?.name} (${plan.exercises[currentStep]?.durationOrReps}).
        Tips: ${plan.exercises[currentStep]?.tips}.

        TASKS:
        1. Visually analyze the user's form continuously.
        2. IMPORTANT: Frequently call 'updateFormFeedback' to update the AR display.
           - If form is bad, set status='incorrect' and focusArea to the problem part (e.g. 'shoulders').
           - If form is good, set status='correct'.
           - If they are idle, status='warning' with feedback like 'Get Ready'.
        3. If you see a "Thumbs Up", call 'nextExercise'.
        4. Speak concisely and rhythmically.
      `;

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          tools: [{ functionDeclarations: [nextExerciseTool, updateFormFeedbackTool] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            setConnectionStatus('connected');
            sessionPromiseRef.current?.then(session => {
               session.send({ text: `Starting ${plan.exercises[currentStep].name}. Let's see your form.` });
            });
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Audio
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              setAiSpeaking(true);
              triggerHaptic(50);
              
              const buffer = await decodeAudioData(audioData, audioContextRef.current);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current.destination);
              const ctx = audioContextRef.current;
              const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
              source.onended = () => setTimeout(() => setAiSpeaking(false), 500);
            }

            // Tools
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'nextExercise') {
                  triggerHaptic(200); // Success haptic
                  handleNextStep(fc.id);
                } else if (fc.name === 'updateFormFeedback') {
                  const args = fc.args as any;
                  
                  if (args.status === 'incorrect') {
                    triggerHaptic([100, 50, 100]); 
                  }
                  
                  overlayStateRef.current = {
                    status: args.status,
                    feedback: args.feedback,
                    focusArea: args.focusArea,
                    lastUpdated: Date.now()
                  };
                  sessionPromiseRef.current?.then(session => {
                    session.sendToolResponse({
                      functionResponses: {
                        name: 'updateFormFeedback',
                        id: fc.id,
                        response: { result: 'Overlay updated' }
                      }
                    });
                  });
                }
              }
            }
          },
          onclose: () => setConnectionStatus('disconnected'),
          onerror: (err) => console.error("Live API Error:", err)
        }
      });
    } catch (e) {
      console.error("Connection failed", e);
      setConnectionStatus('disconnected');
    }
  }, [plan, currentStep, micActive]);

  const handleNextStep = (functionCallId: string | 'manual') => {
    setCurrentStep(prev => {
      const next = prev + 1;
      
      if (functionCallId === 'manual') triggerHaptic(200);

      if (functionCallId !== 'manual') {
        sessionPromiseRef.current?.then(session => {
          session.sendToolResponse({
            functionResponses: {
              name: 'nextExercise',
              id: functionCallId,
              response: { result: 'Moved to next' }
            }
          });
          if (next < plan.exercises.length) {
            session.send({ text: `Next up: ${plan.exercises[next].name}.` });
          } else {
             session.send({ text: `Workout complete!` });
          }
        });
      }

      if (next >= plan.exercises.length) {
        onExit();
        return prev;
      }
      return next;
    });
  };

  // --- MEDIAPIPE POSE SETUP ---

  const onPoseResults = useCallback((results: any) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (videoRef.current) {
        if (canvas.width !== videoRef.current.clientWidth || canvas.height !== videoRef.current.clientHeight) {
            canvas.width = videoRef.current.clientWidth;
            canvas.height = videoRef.current.clientHeight;
        }
    }

    const w = canvas.width;
    const h = canvas.height;
    
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    
    // Status Colors
    const state = overlayStateRef.current;
    let color = "#06b6d4"; // Cyan
    if (state.status === 'correct') color = "#22c55e";
    if (state.status === 'incorrect') color = "#ef4444";
    if (state.status === 'warning') color = "#eab308";

    // Draw Skeleton
    if (results.poseLandmarks) {
        if (window.drawConnectors) {
             window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {
                 color: color, 
                 lineWidth: 4 
             });
        }
        if (window.drawLandmarks) {
             window.drawLandmarks(ctx, results.poseLandmarks, {
                 color: '#ffffff', 
                 lineWidth: 2, 
                 radius: 4 
             });
        }

        // Draw HUD around specific body part if focusArea is set
        // Heuristic mapping of body parts to landmarks
        // 0: nose, 11: left shoulder, 12: right shoulder, 23: left hip, 24: right hip
        let targetLandmark = null;
        if (state.status !== 'scanning' && state.status !== 'correct') {
            if (state.focusArea === 'head') targetLandmark = results.poseLandmarks[0];
            else if (state.focusArea === 'shoulders') targetLandmark = results.poseLandmarks[11]; // approximate
            else if (state.focusArea === 'hips') targetLandmark = results.poseLandmarks[23];
            // ... add more mappings as needed
            
            if (targetLandmark) {
                const tx = targetLandmark.x * w;
                const ty = targetLandmark.y * h;
                
                // Draw floating alert
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(tx, ty, 20, 0, 2 * Math.PI);
                ctx.fill();
                
                ctx.fillStyle = "black";
                ctx.font = "bold 12px Inter";
                ctx.fillText("!", tx - 2, ty + 4);

                // Feedback text line
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx + 50, ty - 50);
                ctx.stroke();

                ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
                ctx.fillRect(tx + 50, ty - 70, 140, 30);
                ctx.fillStyle = "white";
                ctx.fillText(state.feedback, tx + 60, ty - 50);
            }
        }
    }

    // Always draw corners for XR feel
    ctx.strokeStyle = "rgba(6, 182, 212, 0.3)"; 
    ctx.lineWidth = 2;
    const cornerSize = 40;
    // TL
    ctx.beginPath(); ctx.moveTo(20, 20 + cornerSize); ctx.lineTo(20, 20); ctx.lineTo(20 + cornerSize, 20); ctx.stroke();
    // TR
    ctx.beginPath(); ctx.moveTo(w - 20, 20 + cornerSize); ctx.lineTo(w - 20, 20); ctx.lineTo(w - 20 - cornerSize, 20); ctx.stroke();
    // BL
    ctx.beginPath(); ctx.moveTo(20, h - 20 - cornerSize); ctx.lineTo(20, h - 20); ctx.lineTo(20 + cornerSize, h - 20); ctx.stroke();
    // BR
    ctx.beginPath(); ctx.moveTo(w - 20, h - 20 - cornerSize); ctx.lineTo(w - 20, h - 20); ctx.lineTo(w - 20 - cornerSize, h - 20); ctx.stroke();

    ctx.restore();
  }, []);

  useEffect(() => {
    const initPose = async () => {
      if (window.Pose) {
        const pose = new window.Pose({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });
        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        pose.onResults(onPoseResults);
        poseInstanceRef.current = pose;
        setPoseLoaded(true);
      }
    };
    initPose();
  }, [onPoseResults]);

  // Loop for MediaPipe processing
  const processVideoFrame = useCallback(async () => {
    if (poseInstanceRef.current && videoRef.current && videoRef.current.readyState >= 2) {
      await poseInstanceRef.current.send({image: videoRef.current});
    }
    requestFrameRef.current = requestAnimationFrame(processVideoFrame);
  }, []);

  useEffect(() => {
    if (poseLoaded) {
      requestFrameRef.current = requestAnimationFrame(processVideoFrame);
    }
    return () => cancelAnimationFrame(requestFrameRef.current);
  }, [poseLoaded, processVideoFrame]);

  // --- GEMINI VIDEO LOOP (Send snapshot) ---

  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    videoIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !sessionPromiseRef.current) return;
      
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth * 0.5;
      canvas.height = video.videoHeight * 0.5;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        sessionPromiseRef.current.then(session => {
          session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 } });
        });
      }
    }, 1000 / FRAME_RATE);

    return () => { if (videoIntervalRef.current) clearInterval(videoIntervalRef.current); };
  }, [connectionStatus]);

  // --- INIT ---

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        connectToLive();
      } catch (err) {
        console.error("Camera error:", err);
        setPermissionDenied(true);
      }
    };
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) audioContextRef.current.close();
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();
      if (poseInstanceRef.current) poseInstanceRef.current.close();
    };
  }, [connectToLive]);

  const currentExercise = plan.exercises[currentStep];

  return (
    <div className="dark"> 
      <div className="fixed inset-0 bg-black z-50 flex flex-col font-sans text-slate-100">
        
        {/* Permission Denied Overlay */}
        {permissionDenied && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
            <div className="bg-slate-900 p-8 rounded-2xl border border-red-500/30 text-center max-w-md animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Access Required</h3>
              <p className="text-slate-400 mb-6 text-sm leading-relaxed">
                AURA FIT needs <strong className="text-white">camera</strong> and <strong className="text-white">microphone</strong> access to provide real-time AI coaching and form correction.
              </p>
              <button 
                onClick={onExit}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors border border-slate-700 hover:border-slate-500"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Processing Canvas (Hidden) */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Main Container */}
        <div className="relative flex-1 overflow-hidden bg-slate-900">
          
          {/* Video Feed */}
          <video 
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          
          {/* AR Overlay Canvas */}
          <canvas 
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* UI HUD */}
          <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none">
              
              {/* Header */}
              <div className="flex justify-between items-start pointer-events-auto">
                  <div className={`px-4 py-2 rounded-full flex items-center space-x-3 transition-colors backdrop-blur-md border ${
                    connectionStatus === 'connected' ? 'bg-cyan-950/60 border-cyan-500/50' : 'bg-red-950/60 border-red-500/50'
                  }`}>
                      <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                        connectionStatus === 'connected' ? 'bg-cyan-400' : 'bg-red-500'
                      }`} />
                      <span className="text-xs font-bold tracking-wider text-slate-100">
                        {connectionStatus === 'connected' ? 'AURA VISION ACTIVE' : 'INITIALIZING...'}
                      </span>
                      {aiSpeaking && <Activity size={14} className="text-cyan-400 animate-bounce" />}
                  </div>
                  
                  <button onClick={onExit} className="p-3 bg-slate-900/60 backdrop-blur-md rounded-full text-slate-300 hover:text-white hover:bg-red-900/80 transition-all border border-slate-700">
                      <X size={20} />
                  </button>
              </div>

              {/* Gesture Hint Center */}
              {connectionStatus === 'connected' && (
                <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex flex-col items-center space-y-2 opacity-50">
                      <ThumbsUp size={24} className="text-cyan-400" />
                      <span className="text-[10px] font-mono text-cyan-400 uppercase rotate-90 mt-4 tracking-widest">Next</span>
                </div>
              )}

              {/* Bottom Controls */}
              <div className="pointer-events-auto space-y-4">
                  
                  {/* AI Text Feed */}
                  <div className="flex justify-center mb-2">
                      {aiSpeaking && (
                          <div className="bg-slate-950/70 backdrop-blur-xl px-6 py-2 rounded-full border border-cyan-500/30">
                              <div className="flex items-center space-x-2">
                                <ScanFace size={16} className="text-cyan-400" />
                                <span className="text-xs font-mono text-cyan-200">AI Coach Analyzing...</span>
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Exercise Card */}
                  <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border-t border-slate-700/50 bg-slate-900/40 backdrop-blur-xl">
                      <div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs text-slate-300 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {currentStep + 1} / {plan.exercises.length}
                            </span>
                            <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                              {overlayStateRef.current.status === 'incorrect' ? 'Correction Needed' : 'Form Tracking'}
                            </span>
                          </div>
                          <h2 className="text-2xl md:text-3xl font-bold text-white aura-text-glow mb-1">{currentExercise?.name}</h2>
                          <div className="flex items-center space-x-2 text-slate-400 text-sm">
                              <Activity size={14} />
                              <span>{currentExercise?.durationOrReps}</span>
                          </div>
                      </div>

                      <div className="flex items-center space-x-4">
                          <button 
                            onClick={() => setMicActive(!micActive)}
                            className={`p-4 rounded-full transition-all border ${
                              micActive 
                                ? 'bg-slate-800/80 text-cyan-400 border-cyan-500/30' 
                                : 'bg-slate-800/80 text-slate-500 border-slate-700'
                            }`}
                          >
                            {micActive ? <Mic size={24} /> : <MicOff size={24} />}
                          </button>

                          <button
                            onClick={() => handleNextStep('manual')}
                            className="h-14 w-14 rounded-xl bg-cyan-600/90 flex items-center justify-center text-white hover:bg-cyan-500 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
                          >
                            <ChevronRight size={28} />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;