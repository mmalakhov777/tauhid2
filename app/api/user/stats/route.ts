import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getMessageCountByUserId, getUser, getUserMessageBalance } from '@/lib/db/queries';
import { guestRegex } from '@/lib/constants';
import { entitlementsByUserType } from '@/lib/ai/entitlements';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;
    const isGuest = guestRegex.test(userEmail ?? '');
    const userType = session.user.type;
    const entitlements = entitlementsByUserType[userType];

    // Get message balance (new trial balance system)
    let messageBalance = null;
    if (entitlements.useTrialBalance) {
      messageBalance = await getUserMessageBalance(userId);
    }

    // Get legacy message counts for backward compatibility
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
      // Legacy fields (for backward compatibility)
      messagesLast24h,
      totalMessages,
      joinDate,
      
      // New trial balance system fields
      trialBalance: messageBalance ? {
        trialMessagesRemaining: messageBalance.trialMessagesRemaining,
        paidMessagesRemaining: messageBalance.paidMessagesRemaining,
        totalMessagesRemaining: messageBalance.totalMessagesRemaining,
        needsReset: messageBalance.needsReset,
        trialMessagesPerDay: entitlements.trialMessagesPerDay,
        useTrialBalance: entitlements.useTrialBalance,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 