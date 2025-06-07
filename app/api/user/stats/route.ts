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
    
    // Don't provide stats for guest users
    if (guestRegex.test(userEmail ?? '')) {
      return NextResponse.json({ 
        error: 'Guest users do not have statistics' 
      }, { status: 403 });
    }

    // Get user info to determine join date
    const users = await getUser(userEmail ?? '');
    const user = users[0];
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get message counts
    const messagesLast24h = await getMessageCountByUserId({
      id: userId,
      differenceInHours: 24,
    });

    const totalMessages = await getMessageCountByUserId({
      id: userId,
      differenceInHours: 24 * 365 * 10, // 10 years worth of messages
    });

    return NextResponse.json({
      messagesLast24h,
      totalMessages,
      joinDate: new Date().toISOString(), // Default to current date since createdAt doesn't exist
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 