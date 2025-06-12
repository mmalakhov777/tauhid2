import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { apiKey, user } from '../lib/db/schema';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

// Generate a secure API key using Web Crypto API (standalone version)
async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  // Generate 32 random bytes using Web Crypto API
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(keyBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  
  // Create a prefix for easy identification (first 8 characters)
  const prefix = `tk_${key.substring(0, 8)}`;
  
  // Create the full key with prefix
  const fullKey = `${prefix}_${key}`;
  
  // Hash the full key for storage using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(fullKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return {
    key: fullKey,
    hash,
    prefix
  };
}

async function createProductionApiKey() {
  try {
    // Create database connection
    const client = postgres(process.env.POSTGRES_URL!);
    const db = drizzle(client);
    
    // First, let's find an existing user in production
    console.log('🔍 Looking for existing users in production...');
    const users = await db.select().from(user).limit(5);
    
    if (users.length === 0) {
      console.error('❌ No users found in production database');
      process.exit(1);
    }
    
    console.log('👥 Found users:');
    users.forEach((u, index) => {
      console.log(`  ${index + 1}. ${u.email} (ID: ${u.id})`);
    });
    
    // Use the first user (you can modify this to select a specific user)
    const selectedUser = users[0];
    console.log(`\n🎯 Creating API key for user: ${selectedUser.email}`);
    
    // Generate a new API key
    const apiKeyData = await generateApiKey();
    console.log('🔑 Generated API Key Data:', {
      key: apiKeyData.key,
      prefix: apiKeyData.prefix,
      hash: apiKeyData.hash.substring(0, 16) + '...' // Only show first 16 chars of hash for security
    });
    
    // Create the API key in the database
    const [newApiKey] = await db.insert(apiKey).values({
      userId: selectedUser.id,
      name: 'Production API Key',
      keyHash: apiKeyData.hash,
      keyPrefix: apiKeyData.prefix,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    
    console.log('\n✅ API Key created successfully!');
    console.log('📋 Details:');
    console.log('  Key ID:', newApiKey.id);
    console.log('  User ID:', newApiKey.userId);
    console.log('  User Email:', selectedUser.email);
    console.log('  Key Name:', newApiKey.name);
    console.log('  Key Prefix:', newApiKey.keyPrefix);
    console.log('  Created At:', newApiKey.createdAt);
    
    console.log('\n🔑 Use this API key for production testing:');
    console.log(apiKeyData.key);
    
    console.log('\n📝 Test with curl:');
    console.log(`curl -X GET https://tauhidai.com/api/health \\`);
    console.log(`  -H "Authorization: Bearer ${apiKeyData.key}"`);
    
    console.log('\n📝 Test chat endpoint:');
    console.log(`curl -X POST https://tauhidai.com/api/chat \\`);
    console.log(`  -H "Authorization: Bearer ${apiKeyData.key}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"id":"550e8400-e29b-41d4-a716-446655440001","message":{"id":"550e8400-e29b-41d4-a716-446655440002","createdAt":"2025-06-12T08:40:00.000Z","role":"user","content":"Hello","parts":[{"text":"Hello","type":"text"}]},"selectedChatModel":"chat-model","selectedVisibilityType":"private","selectedLanguage":"en"}'`);
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Error creating production API key:', error);
    process.exit(1);
  }
}

createProductionApiKey(); 