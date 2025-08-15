import { ParsedVideo } from "./types";

const EXT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  m4v: "video/mp4",
  qt: "video/quicktime",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  "3g2": "video/3gpp2",
  "3gpp2": "video/3gpp2",
};

/**
 * Validates if a URL is a valid Cloudflare R2 presigned URL for the gaga-linkcaring bucket
 */
export function isValidR2Url(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Must be HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }
    
    // Check if it's a Cloudflare R2 URL for the gaga-linkcaring bucket
    // R2 URLs can be in format: https://gaga-linkcaring.r2.cloudflarestorage.com/...
    // Or custom domain format, but we'll focus on the standard R2 format
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Check for standard R2 hostname pattern
    if (hostname === 'gaga-linkcaring.r2.cloudflarestorage.com') {
      return true;
    }
    
    // Check for R2 presigned URL pattern with account ID
    // Format: https://<account-id>.r2.cloudflarestorage.com/gaga-linkcaring/...
    if (hostname.endsWith('.r2.cloudflarestorage.com')) {
      const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
      return pathParts.length > 0 && pathParts[0] === 'gaga-linkcaring';
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts MIME type from URL based on file extension
 */
export function getMimeTypeFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const fileExt = pathname.split('.').pop() || '';
    return EXT_TO_MIME[fileExt] || 'video/mp4';
  } catch {
    return 'video/mp4';
  }
}

/**
 * Extracts filename from URL path
 */
export function getFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split('/').pop() || 'video';
    return fileName.includes('.') ? fileName : `${fileName}.mp4`;
  } catch {
    return 'video.mp4';
  }
}

/**
 * Downloads video content from a presigned R2 URL and converts it to ParsedVideo format
 */
export async function fetchVideoFromUrl(url: string): Promise<ParsedVideo> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Video = Buffer.from(arrayBuffer).toString("base64");
    
    // Determine MIME type from URL or response headers
    const contentType = response.headers.get('content-type');
    const mimeType = contentType && contentType.startsWith('video/') 
      ? contentType 
      : getMimeTypeFromUrl(url);
    
    const fileName = getFileNameFromUrl(url);
    
    return {
      base64Video,
      mimeType,
      fileName,
    };
  } catch (error) {
    throw new Error("INVALID_VIDEO");
  }
}
