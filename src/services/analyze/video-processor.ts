import { HttpRequest } from "@azure/functions";
import { FormData } from "undici";
import { ParsedVideo } from "./types";
import { isValidR2Url, isValidYouTubeUrl, fetchVideoFromUrl } from "./video-url-utils";

export interface VideoProcessingResult {
  formData: FormData;
  preProcessedVideo?: ParsedVideo;
}

/**
 * Main function to handle video processing from HTTP request
 * Returns the formData and processed video (if URL was provided)
 */
export async function handleVideoFromRequest(request: HttpRequest): Promise<VideoProcessingResult> {
  const formData = await request.formData();
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

  // If no URL provided, return formData only (will process file later)
  if (!hasUrl || !videoUrl) {
    return { formData };
  }

  // Process URL input
  const url = (videoUrl as string).trim();
  
  // Check if it's a YouTube URL
  if (isValidYouTubeUrl(url)) {
    const preProcessedVideo: ParsedVideo = { type: 'youtube', url };
    return { formData, preProcessedVideo };
  }
  
  // Check if it's an R2 URL
  if (isValidR2Url(url)) {
    const preProcessedVideo = await fetchVideoFromUrl(url);
    return { formData, preProcessedVideo };
  }
  
  // Invalid URL
  throw new Error("INVALID_VIDEO");
}
