export interface ValidatorCheck {
  description: string;
  result: boolean;
}

export interface ModelResponse {
  validators: ValidatorCheck[];
  confidence: number; // 0-1 from model
}

export interface RunVideoAnalysisResult {
  totalTokenCount: number | undefined;
  ModelResponse: ModelResponse;
}

export interface PolicyThreshold {
  minValidatorsPassed: number; // 0-100 percent
  minConfidence: number; // 0-100 percent
}

export interface ParsedVideo {
  filePath: string;
  mimeType: string;
  fileName: string;
}


