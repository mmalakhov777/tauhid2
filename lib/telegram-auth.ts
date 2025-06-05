import crypto from 'crypto';

interface TelegramAuthData {
  auth_date: number;
  first_name: string;
  hash: string;
  id: number;
  last_name?: string;
  photo_url?: string;
  username?: string;
  [key: string]: any;
}

/**
 * Verifies the Telegram authentication data
 * @param authData - The authentication data from Telegram
 * @param botToken - Your Telegram bot token
 * @returns boolean indicating if the data is valid
 */
export function verifyTelegramAuth(authData: TelegramAuthData, botToken: string): boolean {
  const { hash, ...data } = authData;
  
  // Create the data check string
  const dataCheckArr = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key]}`);
  const dataCheckString = dataCheckArr.join('\n');
  
  // Create the secret key
  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest();
  
  // Calculate the hash
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return calculatedHash === hash;
}

/**
 * Checks if the authentication data is not too old
 * @param authDate - The authentication timestamp
 * @param maxAge - Maximum age in seconds (default: 86400 = 24 hours)
 * @returns boolean indicating if the data is fresh enough
 */
export function isTelegramAuthFresh(authDate: number, maxAge: number = 86400): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - authDate <= maxAge;
} 