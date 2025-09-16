import { GoogleGenAI, Type, createUserContent, createPartFromUri } from "@google/genai";
import { ModelResponse, ParsedVideo, RunVideoAnalysisResult } from "./types";

export async function runVideoAnalysis(
  video: ParsedVideo,
  prompt: string,
  modelId: string
): Promise<RunVideoAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  
  // Upload the video file using the Files API
  const uploadStartTime = performance.now();
  const uploadedFile = await ai.files.upload({
    file: video.filePath,
    config: { mimeType: video.mimeType },
  });
  const uploadEndTime = performance.now();
  console.log(`Time taken to upload video to Google: ${((uploadEndTime - uploadStartTime) / 1000).toFixed(2)}s`);
  // Wait for the file to be processed (if needed)
  let file = uploadedFile;
  while (file.state === "PROCESSING") {
    await new Promise(resolve => setTimeout(resolve, 1000));
    file = await ai.files.get({ name: file.name });
  }

  if (file.state === "FAILED") {
    throw new Error("VIDEO_PROCESSING_FAILED");
  }

  // Create content with file reference
  const contents = createUserContent([
    {
      ...createPartFromUri(file.uri, file.mimeType),
      videoMetadata: { fps: 1 }
    },
    prompt,
  ])

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

  // Clean up the uploaded file
  try {
    await ai.files.delete({ name: file.name });
  } catch (error) {
    console.warn("Failed to delete uploaded file:", error);
  }

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


