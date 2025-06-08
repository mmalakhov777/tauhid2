import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getMessageCountByUserId, getUser } from '@/lib/db/queries';
import { guestRegex } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;
    const isGuest = guestRegex.test(userEmail ?? '');

    // Get message counts for all users (including guests)
    const messagesLast24h = await getMessageCountByUserId({
      id: userId,
      differenceInHours: 24,
    });

    const totalMessages = await getMessageCountByUserId({
      id: userId,
      differenceInHours: 24 * 365 * 10, // 10 years worth of messages
    });

    // Use current date as join date since we don't have createdAt in user table
    const joinDate = new Date().toISOString();

    return NextResponse.json({
      messagesLast24h,
      totalMessages,
      joinDate,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 