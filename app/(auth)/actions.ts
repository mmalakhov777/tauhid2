'use server';

import { z } from 'zod';

import { createUser, getUser, createUserWithTelegram, getUserByTelegramId } from '@/lib/db/queries';

import { signIn } from './auth';

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const telegramAuthSchema = z.object({
  telegramId: z.number(),
  telegramUsername: z.string().optional(),
  telegramFirstName: z.string(),
  telegramLastName: z.string().optional(),
  telegramPhotoUrl: z.string().optional(),
  telegramLanguageCode: z.string().optional(),
  telegramIsPremium: z.boolean().optional(),
  telegramAllowsWriteToPm: z.boolean().optional(),
  skipEmail: z.boolean().optional(),
});

export interface LoginActionState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data';
}

export interface TelegramAuthState {
  status: 'idle' | 'in_progress' | 'success' | 'failed' | 'invalid_data' | 'telegram_unavailable' | 'needs_email';
}

export const login = async (
  _: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export interface RegisterActionState {
  status:
    | 'idle'
    | 'in_progress'
    | 'success'
    | 'failed'
    | 'user_exists'
    | 'invalid_data';
}

export const register = async (
  _: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: 'user_exists' } as RegisterActionState;
    }
    await createUser(validatedData.email, validatedData.password);
    await signIn('credentials', {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};

export const telegramAuth = async (
  telegramData: any
): Promise<TelegramAuthState> => {
  console.log('[telegramAuth] Environment check:', {
    POSTGRES_URL_exists: !!process.env.POSTGRES_URL,
    POSTGRES_URL_length: process.env.POSTGRES_URL?.length || 0,
    NODE_ENV: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });

  try {
    console.log('[telegramAuth] Starting auth with data:', {
      telegramId: telegramData.telegramId,
      username: telegramData.telegramUsername,
      firstName: telegramData.telegramFirstName
    });
    
    const validatedData = telegramAuthSchema.parse(telegramData);
    console.log('[telegramAuth] Data validation passed');
    
    // Check if user already exists by Telegram ID
    const [existingUser] = await getUserByTelegramId(validatedData.telegramId);
    console.log('[telegramAuth] Existing user check result:', existingUser ? {
      id: existingUser.id,
      email: existingUser.email,
      telegramId: existingUser.telegramId
    } : 'No existing user');
    
    if (!existingUser) {
      console.log('[telegramAuth] Creating new user with Telegram data');
      // Create new user with Telegram data but dummy email
      const dummyEmail = `telegram_${validatedData.telegramId}@telegram.local`;
      await createUserWithTelegram(dummyEmail, validatedData);
      
      // If skipEmail is true, sign them in immediately
      if (validatedData.skipEmail) {
        console.log('[telegramAuth] Signing in new user with dummy email:', dummyEmail);
        await signIn('credentials', {
          email: dummyEmail,
          password: 'telegram_auth',
          redirect: false,
        });
        return { status: 'success' };
      }
      
      // Return needs_email status for new users
      return { status: 'needs_email' };
    }

    // Check if user has a real email (not the dummy one)
    if (existingUser.email.startsWith('telegram_') && existingUser.email.endsWith('@telegram.local')) {
      console.log('[telegramAuth] User has dummy email, checking skipEmail flag');
      // If skipEmail is true, sign them in with dummy email
      if (validatedData.skipEmail) {
        console.log('[telegramAuth] Signing in existing user with dummy email:', existingUser.email);
        await signIn('credentials', {
          email: existingUser.email,
          password: 'telegram_auth',
          redirect: false,
        });
        return { status: 'success' };
      }
      
      // User exists but doesn't have a real email yet
      return { status: 'needs_email' };
    }

    // Sign in the user with existing credentials
    console.log('[telegramAuth] Signing in existing user with real email:', existingUser.email);
    await signIn('credentials', {
      email: existingUser.email,
      password: 'telegram_auth',
      redirect: false,
    });

    return { status: 'success' };
  } catch (error) {
    console.error('[telegramAuth] Error during authentication:', error);
    if (error instanceof z.ZodError) {
      console.error('[telegramAuth] Validation error:', error.errors);
      return { status: 'invalid_data' };
    }

    return { status: 'failed' };
  }
};
