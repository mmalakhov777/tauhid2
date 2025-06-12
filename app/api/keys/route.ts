import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { 
  createApiKey, 
  getApiKeysByUserId, 
  deleteApiKey,
  deactivateApiKey 
} from '@/lib/db/queries';
import { generateApiKey } from '@/lib/api-key';
import { z } from 'zod';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresInDays: z.number().min(1).max(365).optional(),
});

const deleteApiKeySchema = z.object({
  id: z.string().uuid(),
});

// GET /api/keys - List user's API keys
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKeys = await getApiKeysByUserId({ userId: session.user.id });
    
    // Remove sensitive data before sending to client
    const safeApiKeys = apiKeys.map(key => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));

    return NextResponse.json({ apiKeys: safeApiKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, expiresInDays } = createApiKeySchema.parse(body);

    // Check if user already has too many API keys (limit to 10)
    const existingKeys = await getApiKeysByUserId({ userId: session.user.id });
    const activeKeys = existingKeys.filter(key => key.isActive);
    
    if (activeKeys.length >= 10) {
      return NextResponse.json(
        { error: 'Maximum number of API keys reached (10)' },
        { status: 400 }
      );
    }

    // Generate new API key
    const { key, hash, prefix } = await generateApiKey();
    
    // Calculate expiration date if provided
    let expiresAt: Date | undefined;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Save to database
    const [apiKeyRecord] = await createApiKey({
      userId: session.user.id,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      expiresAt,
    });

    return NextResponse.json({
      message: 'API key created successfully',
      apiKey: {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        key: key, // Only return the full key once during creation
        keyPrefix: apiKeyRecord.keyPrefix,
        expiresAt: apiKeyRecord.expiresAt,
        createdAt: apiKeyRecord.createdAt,
      }
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/keys - Delete API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = deleteApiKeySchema.parse(body);

    // Delete the API key (only if it belongs to the user)
    const deletedKeys = await deleteApiKey({
      id,
      userId: session.user.id,
    });

    if (deletedKeys.length === 0) {
      return NextResponse.json(
        { error: 'API key not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'API key deleted successfully'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error deleting API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 