import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ScamAnalysis {
  decision: "Scam" | "Safe" | "Suspicious";
  confidence: number;
  risk: "High" | "Medium" | "Low";
  reason: string;
  action: string;
}

export async function analyzeScam(message: string): Promise<ScamAnalysis> {
  const prompt = `
    You are a highly advanced AI scam detection system called "ScamShield AI".
    Your task is to analyze the following message (SMS, Email, or Web Link) and determine if it is a scam.

    INPUT:
    "${message}"

    SYSTEM INSTRUCTIONS:
    1. Analyze for phishing patterns, urgency manipulation, fake links, sender spoofing, and suspicious requests for personal/financial info.
    2. Strictly follow the multi-shot breakdown:
       - Classify as "Scam", "Safe", or "Suspicious".
       - Provide a confidence score (0-100).
       - Assign a risk level: "High", "Medium", or "Low".
       - Provide a clear, simple explanation of WHY you reached this decision.
       - Suggest a specific recommended action for the user.

    OUTPUT FORMAT:
    You MUST return ONLY a valid JSON object with the following structure:
    {
      "decision": "Scam" | "Safe" | "Suspicious",
      "confidence": number,
      "risk": "High" | "Medium" | "Low",
      "reason": "string explaining the red flags or safety markers",
      "action": "string suggesting what the user should do"
    }

    Do not include any other text in your response.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const jsonStr = response.text.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze content with AI.");
  }
}
