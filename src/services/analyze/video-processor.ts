import { HttpRequest } from "@azure/functions";
import { ParsedVideo } from "./types";
import { isValidR2Url, fetchVideoFromUrl } from "./video-url-utils";

/**
 * Main function to handle video processing from HTTP request
 * Returns the processed video or undefined if file should be processed by parseAnalyzeForm
 */
export async function handleVideoFromRequest(request: HttpRequest): Promise<ParsedVideo | undefined> {
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

  // If no URL provided, return undefined (will process file later)
  if (!hasUrl || !videoUrl) {
    return undefined;
  }

  // Process URL input
  const url = (videoUrl as string).trim();
  
  if (!isValidR2Url(url)) {
    throw new Error("INVALID_VIDEO");
  }
  
  return await fetchVideoFromUrl(url);
}
