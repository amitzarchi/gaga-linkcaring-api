import { HttpRequest } from "@azure/functions";
import { ParsedVideo } from "./types";
import { isValidR2Url, fetchVideoFromUrl } from "./video-url-utils";

export interface VideoInputValidation {
  hasVideo: boolean;
  hasUrl: boolean;
  videoUrl?: string;
}

/**
 * Validates video input from form data and ensures only one input method is provided
 */
export function validateVideoInput(formData: FormData): VideoInputValidation {
  const video = formData.get("video");
  const videoUrl = formData.get("videoUrl");
  
  const hasVideo = video instanceof File;
  const hasUrl = typeof videoUrl === "string" && videoUrl.trim().length > 0;
  
  // Validate that user provided either video file or URL, but not both
  if (!hasVideo && !hasUrl) {
    throw new Error("INVALID_VIDEO");
  }
  
  if (hasVideo && hasUrl) {
    throw new Error("INVALID_VIDEO"); // Both provided - not allowed
  }

  return {
    hasVideo,
    hasUrl,
    videoUrl: hasUrl ? (videoUrl as string).trim() : undefined,
  };
}

/**
 * Processes video input - either downloads from URL or returns undefined if file upload
 */
export async function processVideoInput(validation: VideoInputValidation): Promise<ParsedVideo | undefined> {
  if (!validation.hasUrl || !validation.videoUrl) {
    return undefined; // No URL provided, will process file later
  }

  const url = validation.videoUrl;
  
  if (!isValidR2Url(url)) {
    throw new Error("INVALID_VIDEO");
  }
  
  return await fetchVideoFromUrl(url);
}

/**
 * Main function to handle video processing from HTTP request
 * Returns the processed video or undefined if file should be processed by parseAnalyzeForm
 */
export async function handleVideoFromRequest(request: HttpRequest): Promise<ParsedVideo | undefined> {
  const formData = await request.formData();
  const validation = validateVideoInput(formData);
  return await processVideoInput(validation);
}
