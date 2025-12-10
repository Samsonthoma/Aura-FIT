import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { WorkoutPlan, FormAnalysisResult } from "../types";

// Helper to ensure API key exists
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateWorkoutPlan = async (
  goal: string,
  fitnessLevel: string,
  duration: number
): Promise<WorkoutPlan> => {
  const ai = getAIClient();
  
  const prompt = `Create a ${duration}-minute ${fitnessLevel} workout plan focusing on ${goal}. 
  Return a structured JSON object with a catchy title, difficulty level, and a list of exercises. 
  Each exercise should have a name, duration/reps, a short description, and form tips.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      duration: { type: Type.STRING },
      difficulty: { type: Type.STRING },
      exercises: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            durationOrReps: { type: Type.STRING },
            description: { type: Type.STRING },
            tips: { type: Type.STRING },
          },
          required: ["name", "durationOrReps", "description", "tips"],
        },
      },
    },
    required: ["title", "duration", "difficulty", "exercises"],
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text) as WorkoutPlan;
  } catch (error) {
    console.error("Error generating workout:", error);
    throw error;
  }
};

export const analyzeForm = async (base64Image: string, exerciseName: string): Promise<FormAnalysisResult> => {
  const ai = getAIClient();
  
  // Remove header if present (e.g., "data:image/jpeg;base64,")
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

  const prompt = `Analyze this person performing the exercise '${exerciseName}'. 
  Identify their posture and form. 
  Provide a score out of 100, brief general feedback, and bullet points for specific corrections or safety tips.
  Return JSON.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER },
      feedback: { type: Type.STRING },
      corrections: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
    required: ["score", "feedback", "corrections"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // Using flash-image for efficiency
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const text = response.text;
    if (!text) throw new Error("No analysis generated");
    return JSON.parse(text) as FormAnalysisResult;
  } catch (error) {
    console.error("Error analyzing form:", error);
    throw error;
  }
};

export const generateVoiceGuidance = async (text: string): Promise<string> => {
  const ai = getAIClient();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text: `Speak calmly and instructively: ${text}` }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    
    return base64Audio;
  } catch (error) {
    console.error("TTS Error:", error);
    return "";
  }
};
