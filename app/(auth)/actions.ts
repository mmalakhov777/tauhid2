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
  try {
    const validatedData = telegramAuthSchema.parse(telegramData);
    
    // Check if user already exists by Telegram ID
    const [existingUser] = await getUserByTelegramId(validatedData.telegramId);
    
    if (!existingUser) {
      // Create new user with Telegram data but dummy email
      const dummyEmail = `telegram_${validatedData.telegramId}@telegram.local`;
      await createUserWithTelegram(dummyEmail, validatedData);
      
      // Return needs_email status for new users
      return { status: 'needs_email' };
    }

    // Check if user has a real email (not the dummy one)
    if (existingUser.email.startsWith('telegram_') && existingUser.email.endsWith('@telegram.local')) {
      // User exists but doesn't have a real email yet
      return { status: 'needs_email' };
    }

    // Sign in the user with existing credentials
    await signIn('credentials', {
      email: existingUser.email,
      password: 'telegram_auth',
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
