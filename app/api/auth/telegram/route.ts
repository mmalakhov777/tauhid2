import { NextRequest, NextResponse } from 'next/server';
import { signIn } from '@/app/(auth)/auth';
import { verifyTelegramAuth, isTelegramAuthFresh } from '@/lib/telegram-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract Telegram auth data
    const { 
      id,
      first_name,
      last_name,
      username,
      photo_url,
      auth_date,
      hash,
      language_code,
      is_premium,
      allows_write_to_pm
    } = body;

    // Verify the authentication data if bot token is available
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      const authData = {
        auth_date,
        first_name,
        hash,
        id,
        ...(last_name && { last_name }),
        ...(photo_url && { photo_url }),
        ...(username && { username }),
        ...(language_code && { language_code }),
        ...(is_premium !== undefined && { is_premium }),
        ...(allows_write_to_pm !== undefined && { allows_write_to_pm }),
      };

      const isValid = verifyTelegramAuth(authData, botToken);
      const isFresh = isTelegramAuthFresh(auth_date);

      if (!isValid || !isFresh) {
        return NextResponse.json(
          { error: 'Invalid or expired authentication data' },
          { status: 401 }
        );
      }
    }

    // Perform the sign in
    await signIn('telegram', {
      redirect: false,
      telegramId: id.toString(),
      username: username || '',
      firstName: first_name,
      lastName: last_name || '',
      photoUrl: photo_url || '',
      languageCode: language_code || '',
      isPremium: is_premium ? 'true' : 'false',
      allowsWriteToPm: allows_write_to_pm ? 'true' : 'false',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 