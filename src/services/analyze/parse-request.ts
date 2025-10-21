import { HttpRequest } from "@azure/functions";
import { FormData } from "undici";
import { ParsedVideo } from "./types";
import { writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

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

export interface ParsedForm {
  milestoneId: number;
  video: ParsedVideo;
}

export async function parseAnalyzeForm(
  formData: FormData,
  preProcessedVideo?: ParsedVideo
): Promise<ParsedForm> {
  const milestoneIdRaw = formData.get("milestoneId");

  // Parse milestone ID
  let milestoneId: number | null = null;
  if (typeof milestoneIdRaw === "string") {
    const parsed = parseInt(milestoneIdRaw);
    if (!isNaN(parsed)) milestoneId = parsed;
  } else if (typeof milestoneIdRaw === "number") {
    milestoneId = milestoneIdRaw;
  }

  if (!Number.isInteger(milestoneId)) {
    throw new Error("INVALID_MILESTONE_ID");
  }

  // If pre-processed video is provided, use it
  if (preProcessedVideo) {
    return {
      milestoneId: milestoneId as number,
      video: preProcessedVideo,
    };
  }

  // Otherwise, process the uploaded video file
  const video = formData.get("video");
  if (!(video instanceof File)) {
    throw new Error("INVALID_VIDEO");
  }

  const fileObj = video as File;
  const arrayBuffer = await fileObj.arrayBuffer();
  
  // Generate a unique filename for the temporary file
  const uniqueId = randomBytes(8).toString("hex");
  const fileExt = (fileObj.name.split(".").pop() || "mp4").toLowerCase();
  const tempFileName = `video_${uniqueId}.${fileExt}`;
  const filePath = join("/tmp", tempFileName);
  
  // Save the video file to /tmp
  const buffer = Buffer.from(arrayBuffer);
  writeFileSync(filePath, buffer);

  const reportedType = (fileObj.type || "").toLowerCase();
  const isGeneric = !reportedType || reportedType === "application/octet-stream";
  const inferredType = EXT_TO_MIME[fileExt] || "video/mp4";
  const mimeType = isGeneric ? inferredType : reportedType;

  return {
    milestoneId: milestoneId as number,
    video: {
      type: 'file',
      filePath,
      mimeType,
      fileName: fileObj.name,
    },
  };
}


