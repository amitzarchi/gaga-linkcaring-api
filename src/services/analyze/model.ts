import { GoogleGenAI, Type, createUserContent, createPartFromUri } from "@google/genai";
import { ModelResponse, ParsedVideo, RunVideoAnalysisResult } from "./types";

export async function runVideoAnalysis(
  video: ParsedVideo,
  prompt: string,
  modelId: string
): Promise<RunVideoAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  
  let fileUri: string;
  let fileMimeType: string;
  let fileName: string | undefined;
  
  if (video.type === 'youtube') {
    // For YouTube URLs, use the URL directly without uploading
    fileUri = video.url;
    fileMimeType = 'video/*';
    fileName = undefined;
  } else {
    // Upload the video file using the Files API
    const uploadStartTime = performance.now();
    const uploadedFile = await ai.files.upload({
      file: video.filePath,
      config: { mimeType: video.mimeType },
    });
    const uploadEndTime = performance.now();
    console.log(`upload time: ${((uploadEndTime - uploadStartTime) / 1000).toFixed(2)}s`);
    // Wait for the file to be processed (if needed)
    let file = uploadedFile;
    while (file.state === "PROCESSING") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      file = await ai.files.get({ name: file.name });
    }

    if (file.state === "FAILED") {
      throw new Error("VIDEO_PROCESSING_FAILED");
    }
    
    fileUri = file.uri;
    fileMimeType = file.mimeType;
    fileName = file.name;
  }

  // Create content with file reference
  const promptWithFailureReasons = `${prompt}\n\nInstructions for JSON output:\n- For each validator, always include 'reasonForFailure'.\n- When result is false: provide a concise explanation (<=120 chars).\n- When result is true: set 'reasonForFailure' to an empty string ''.\n- Follow the response schema exactly.`;
  const contents = createUserContent([
    {
      ...createPartFromUri(fileUri, fileMimeType),
      videoMetadata: { fps: 1 }
    },
    promptWithFailureReasons,
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
                reasonForFailure: { type: Type.STRING },
              },
              required: ["description", "result", "reasonForFailure"],
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
  console.log(`inference time: ${((endTime - startTime) / 1000).toFixed(2)}s`);

  // Clean up the uploaded file (only for non-YouTube videos)
  if (fileName) {
    try {
      await ai.files.delete({ name: fileName });
    } catch (error) {
      console.warn("Failed to delete uploaded file:", error);
    }
  }

  try {
    const raw = JSON.parse(response.text) as any;
    if (Array.isArray(raw?.validators)) {
      for (const v of raw.validators) {
        if (v && v.result === false && typeof v.reasonForFailure === "string" && v.reasonForFailure.trim()) {
          console.log(`validator explanation: ${v.description} -> ${v.reasonForFailure}`);
        }
      }
    }

    const sanitized: ModelResponse = {
      validators: (raw?.validators ?? []).map((v: any) => ({
        description: v?.description,
        result: Boolean(v?.result),
      })),
      confidence: Number(raw?.confidence),
    };

    return {
      totalTokenCount: response.usageMetadata?.totalTokenCount,
      ModelResponse: sanitized,
    };
  } catch (err) {
    throw new Error("MODEL_RESPONSE_PARSE_ERROR");
  }
}


