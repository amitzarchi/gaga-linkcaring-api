import { ParsedVideo } from "./types";
import { writeFileSync } from "fs";
import { join } from "path";
import { randomBytes, createHash } from "crypto";

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

// Cap filenames well under common filesystem limits (255 bytes for most Unix filesystems)
const MAX_FILENAME_BYTES = 120;

function toAsciiSlug(input: string): string {
  // Normalize, strip diacritics, convert non-ASCII to '-'; keep [A-Za-z0-9._-]
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const ascii = normalized
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[\-_.\s]+|[\-_.\s]+$/g, "");
  return ascii || "video";
}

function truncateToBytes(input: string, maxBytes: number): string {
  let total = 0;
  let out = "";
  for (const ch of input) {
    const size = Buffer.byteLength(ch);
    if (total + size > maxBytes) break;
    out += ch;
    total += size;
  }
  return out;
}

function buildSafeTempFileName(originalFileName: string, uniqueId: string): string {
  const lastDotIndex = originalFileName.lastIndexOf(".");
  const rawExt = lastDotIndex !== -1 ? originalFileName.substring(lastDotIndex + 1) : "mp4";
  const safeExt = /^[a-z0-9]{2,5}$/i.test(rawExt) ? rawExt.toLowerCase() : "mp4";
  const rawBase = lastDotIndex !== -1 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
  const base = toAsciiSlug(rawBase);
  const hash = createHash("sha1").update(originalFileName).digest("hex").slice(0, 8);

  const suffix = `_${uniqueId}_${hash}.${safeExt}`;
  const suffixBytes = Buffer.byteLength(suffix);
  const allowedBaseBytes = Math.max(10, MAX_FILENAME_BYTES - suffixBytes);
  const truncatedBase = truncateToBytes(base, allowedBaseBytes);
  return `${truncatedBase}${suffix}`;
}

/**
 * Validates if a URL is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Check for YouTube domains
    return hostname === 'youtube.com' || 
           hostname === 'www.youtube.com' || 
           hostname === 'youtu.be' ||
           hostname === 'm.youtube.com';
  } catch {
    return false;
  }
}

/**
 * Validates if a URL is a valid Cloudflare R2 presigned URL for the gaga-linkcaring bucket
 */
export function isValidR2Url(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
        
    // Check if it's a Cloudflare R2 URL for the gaga-linkcaring bucket
    // R2 URLs can be in format: https://gaga-linkcaring.r2.cloudflarestorage.com/...
    // Or custom domain format, but we'll focus on the standard R2 format
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // Check for standard R2 hostname pattern
    if (hostname.includes('r2.cloudflarestorage.com') && hostname.includes('gaga-linkcaring')) {
      return true;
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
 * Downloads video content from a presigned R2 URL and saves it to /tmp directory
 */
export async function fetchVideoFromUrl(url: string): Promise<ParsedVideo> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Generate a unique filename for the temporary file
    const uniqueId = randomBytes(8).toString("hex");
    const fileName = getFileNameFromUrl(url);
    const tempFileName = buildSafeTempFileName(fileName, uniqueId);
    const filePath = join("/tmp", tempFileName);
    
    // Save the video file to /tmp
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(filePath, buffer);
    
    // Determine MIME type from URL or response headers
    const contentType = response.headers.get('content-type');
    const mimeType = contentType && contentType.startsWith('video/') 
      ? contentType 
      : getMimeTypeFromUrl(url);
    
    return {
      type: 'file',
      filePath,
      mimeType,
      fileName,
    };
  } catch (error) {
    throw new Error("INVALID_VIDEO");
  }
}
