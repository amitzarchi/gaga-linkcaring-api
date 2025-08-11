import { getApiKeyByKey, updateApiKeyLastUsed } from "../db/queries/api-keys-queries";
import { HttpRequest, HttpResponseInit } from "@azure/functions";

export interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: {
    id: number;
    userId: string;
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
  };
  error?: string;
}

/**
 * Extract API key from request headers
 * Supports both Authorization: Bearer <key> and X-API-Key: <key> formats
 */
export function extractApiKey(request: HttpRequest): string | null {
  // Check X-API-Key header first
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Check Authorization header with Bearer format
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove "Bearer " prefix
  }

  return null;
}

/**
 * Validate an API key and update its last used timestamp
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidationResult> {
  try {
    // Look up the API key in the database
    const apiKey = await getApiKeyByKey(key);

    if (!apiKey) {
      return {
        isValid: false,
        error: "Invalid API key"
      };
    }

    // Check if the API key is active
    if (!apiKey.isActive) {
      return {
        isValid: false,
        error: "API key is inactive"
      };
    }

    // Update the last used timestamp
    await updateApiKeyLastUsed(apiKey.id);

    return {
      isValid: true,
      apiKey: {
        id: apiKey.id,
        userId: apiKey.userId,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        lastUsedAt: new Date(), // Return the updated timestamp
      }
    };
  } catch (error) {
    console.error('Error validating API key:', error);
    return {
      isValid: false,
      error: "Internal server error"
    };
  }
}

/**
 * Middleware function to validate API keys from request headers
 */
export async function validateApiKeyFromRequest(request: HttpRequest): Promise<ApiKeyValidationResult> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return {
      isValid: false,
      error: "No API key provided"
    };
  }

  return await validateApiKey(apiKey);
}

/**
 * Response helper for unauthorized requests
 */
export function createUnauthorizedResponse(message: string = "Unauthorized") {
  return {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ error: message }),
  };
}

/**
 * Higher-order function to protect API routes with API key authentication
 */
export function withApiKeyAuth<T extends any[]>(
  handler: (request: HttpRequest, ...args: T) => Promise<HttpResponseInit> | HttpResponseInit
) {
  return async (request: HttpRequest, ...args: T): Promise<HttpResponseInit> => {
    const validation = await validateApiKeyFromRequest(request);

    if (!validation.isValid) {
      return createUnauthorizedResponse(validation.error);
    }

    // Add the validated API key info to the request for use in the handler
    // We can't modify NextRequest directly, so we'll pass it via a custom property
    (request as any).apiKey = validation.apiKey;

    return handler(request, ...args);
  };
} 