import { ModelResponse, PolicyThreshold } from "./types";

export function evaluatePolicy(
  response: ModelResponse,
  policy: PolicyThreshold
) {
  const total = Array.isArray(response.validators)
    ? response.validators.length
    : 0;
  const passed = total > 0
    ? response.validators.filter((v) => v?.result === true).length
    : 0;
  const percentPassed = total > 0 ? (passed / total) * 100 : 0;
  const confidencePct = typeof response.confidence === "number"
    ? response.confidence * 100
    : 0;

  const result = percentPassed >= policy.minValidatorsPassed && confidencePct >= policy.minConfidence;

  return { result, confidence: response.confidence, validators: response.validators };
}


