import { GoogleGenAI, Type } from "@google/genai";
import { ModelResponse, ParsedVideo, RunVideoAnalysisResult } from "./types";

export async function runVideoAnalysis(
  video: ParsedVideo,
  prompt: string,
  modelId: string
): Promise<RunVideoAnalysisResult> {
  const contents = [
    {
      inlineData: {
        mimeType: video.mimeType,
        data: video.base64Video,
      },
    },
    { text: prompt },
  ];

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const startTime = performance.now();
  const response = await ai.models.generateContent({
    model: modelId,
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          validators: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                result: { type: Type.BOOLEAN },
              },
            },
          },
          confidence: { type: Type.NUMBER },
        },
        propertyOrdering: ["validators", "confidence"],
        required: ["validators", "confidence"],
        additionalProperties: false,
        strict: true,
      },
    },
  });
  const endTime = performance.now();
  console.log(`Time taken to send request to google: ${((endTime - startTime) / 1000).toFixed(2)}s`);

  try {
    const parsed = JSON.parse(response.text) as ModelResponse;
    return {
      totalTokenCount: response.usageMetadata?.totalTokenCount,
      ModelResponse: parsed,
    };
  } catch (err) {
    throw new Error("MODEL_RESPONSE_PARSE_ERROR");
  }
}


