import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { createTelegramBindingCode } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Check if user has email but no Telegram data (eligible for binding)
    if (!user.email || user.telegramId) {
      return NextResponse.json(
        { success: false, error: 'User not eligible for Telegram binding' },
        { status: 400 }
      );
    }

    // Don't allow guest users or telegram-only users
    if (user.email.startsWith('guest_') || user.email.startsWith('telegram_')) {
      return NextResponse.json(
        { success: false, error: 'Guest and Telegram-only users cannot bind accounts' },
        { status: 400 }
      );
    }

    // Generate binding code
    const result = await createTelegramBindingCode(user.id, user.email);

    return NextResponse.json({
      success: true,
      bindingCode: result.bindingCode,
      expiresAt: result.expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('Error generating Telegram binding code:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to generate binding code' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the current session
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Import the function here to avoid circular imports
    const { getActiveTelegramBindingCodeByUserId } = await import('@/lib/db/queries');
    
    // Get active binding code if exists
    const activeCode = await getActiveTelegramBindingCodeByUserId(user.id);

    if (activeCode) {
      return NextResponse.json({
        success: true,
        hasActiveCode: true,
        bindingCode: activeCode.bindingCode,
        expiresAt: activeCode.expiresAt.toISOString(),
      });
    } else {
      return NextResponse.json({
        success: true,
        hasActiveCode: false,
      });
    }

  } catch (error) {
    console.error('Error checking binding code status:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to check binding code status' },
      { status: 500 }
    );
  }
} 