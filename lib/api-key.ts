import { getApiKeyByHash, updateApiKeyLastUsed, getUserById } from './db/queries';
import type { User } from './db/schema';

// Generate a secure API key using Web Crypto API (Edge Runtime compatible)
export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  // Generate 32 random bytes using Web Crypto API
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(keyBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  
  // Create a prefix for easy identification (first 8 characters)
  const prefix = `tk_${key.substring(0, 8)}`;
  
  // Create the full key with prefix
  const fullKey = `${prefix}_${key}`;
  
  // Hash the full key for storage using Web Crypto API
  const hash = await hashApiKey(fullKey);
  
  return {
    key: fullKey,
    hash,
    prefix
  };
}

// Validate API key format
export function isValidApiKeyFormat(key: string): boolean {
  // Format: tk_xxxxxxxx_64-char-hex
  const apiKeyRegex = /^tk_[a-f0-9]{8}_[a-f0-9]{64}$/;
  return apiKeyRegex.test(key);
}

// Hash an API key for comparison using Web Crypto API
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Authenticate user with API key
export async function authenticateApiKey(key: string): Promise<{ user: User; apiKey: any } | null> {
  try {
    // Validate format first
    if (!isValidApiKeyFormat(key)) {
      return null;
    }
    
    // Hash the key
    const keyHash = await hashApiKey(key);
    
    // Find the API key in database
    const apiKeyRecord = await getApiKeyByHash({ keyHash });
    
    if (!apiKeyRecord) {
      return null;
    }
    
    // Check if key is expired
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      return null;
    }
    
    // Get the user
    const users = await getUserById(apiKeyRecord.userId);
    if (users.length === 0) {
      return null;
    }
    
    const user = users[0];
    
    // Update last used timestamp (non-blocking)
    updateApiKeyLastUsed({ keyHash }).catch(console.warn);
    
    return { user, apiKey: apiKeyRecord };
  } catch (error) {
    console.error('API key authentication error:', error);
    return null;
  }
}

// Extract API key from request headers
export function extractApiKeyFromRequest(request: Request): string | null {
  // Check Authorization header: "Bearer tk_..."
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const key = authHeader.substring(7);
    if (isValidApiKeyFormat(key)) {
      return key;
    }
  }
  
  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('X-API-Key');
  if (apiKeyHeader && isValidApiKeyFormat(apiKeyHeader)) {
    return apiKeyHeader;
  }
  
  return null;
}

// Middleware function to authenticate API requests
export async function authenticateApiRequest(request: Request): Promise<{ user: User; apiKey: any } | null> {
  const apiKey = extractApiKeyFromRequest(request);
  
  if (!apiKey) {
    return null;
  }
  
  return await authenticateApiKey(apiKey);
} 