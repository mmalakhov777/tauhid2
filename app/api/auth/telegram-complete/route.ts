import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUser, updateUserWithEmailPassword } from '@/lib/db/queries';
import { signIn } from '@/app/(auth)/auth';

const telegramCompleteSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  telegramData: z.object({
    telegramId: z.number(),
    telegramUsername: z.string().optional(),
    telegramFirstName: z.string(),
    telegramLastName: z.string().optional(),
    telegramPhotoUrl: z.string().optional(),
    telegramLanguageCode: z.string().optional(),
    telegramIsPremium: z.boolean().optional(),
    telegramAllowsWriteToPm: z.boolean().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = telegramCompleteSchema.parse(body);

    // Check if email is already taken by another user
    const [existingUser] = await getUser(validatedData.email);
    if (existingUser && existingUser.telegramId !== validatedData.telegramData.telegramId) {
      return NextResponse.json(
        { success: false, error: 'Email is already taken by another account' },
        { status: 400 }
      );
    }

    // Update the Telegram user with email and password
    await updateUserWithEmailPassword(
      validatedData.telegramData.telegramId,
      validatedData.email,
      validatedData.password
    );

    // Sign in the user with their new credentials
    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram complete error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid data provided' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to complete account setup' },
      { status: 500 }
    );
  }
} 