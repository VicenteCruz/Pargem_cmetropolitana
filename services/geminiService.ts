
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedArrival, TransitInsight } from "../types";

export const getTransitBriefing = async (
  stopName: string, 
  arrivals: ProcessedArrival[]
): Promise<TransitInsight> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const arrivalsText = arrivals
    .slice(0, 5)
    .map(a => `Line ${a.lineId} to ${a.destination} in ${a.minutes} min`)
    .join(', ');

  const prompt = `
    Analyze the following real-time transit data for the bus stop "${stopName}".
    Arrivals: ${arrivalsText}.
    Provide a friendly, very concise (max 2 sentences) summary and one helpful recommendation for travelers.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["summary", "recommendation"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty AI response");
    return JSON.parse(text) as TransitInsight;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      summary: "Real-time data is flowing normally.",
      recommendation: "Always keep an eye on the board for sudden changes."
    };
  }
};
