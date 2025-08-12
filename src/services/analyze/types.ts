export interface ValidatorCheck {
  description: string;
  result: boolean;
}

export interface ModelResponse {
  validators: ValidatorCheck[];
  confidence: number; // 0-1 from model
}

export interface PolicyThreshold {
  minValidatorsPassed: number; // 0-100 percent
  minConfidence: number; // 0-100 percent
}

export interface ParsedVideo {
  base64Video: string;
  mimeType: string;
  fileName: string;
}


