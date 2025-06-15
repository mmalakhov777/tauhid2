import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getTelegramBindingCodeByCode } from '@/lib/db/queries';

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

    const { bindingCode } = await request.json();

    if (!bindingCode) {
      return NextResponse.json(
        { success: false, error: 'Binding code is required' },
        { status: 400 }
      );
    }

    // Check if the binding code exists and is still valid
    const bindingRecord = await getTelegramBindingCodeByCode(bindingCode);
    
    if (!bindingRecord) {
      // Code doesn't exist or is expired/used
      return NextResponse.json({
        success: true,
        isCompleted: false,
        message: 'Code not found or expired'
      });
    }

    // Check if the code belongs to the current user
    if (bindingRecord.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Invalid binding code for this user' },
        { status: 403 }
      );
    }

    // Check if the code has been used (binding completed)
    const isCompleted = bindingRecord.isUsed;

    return NextResponse.json({
      success: true,
      isCompleted,
      message: isCompleted ? 'Binding completed' : 'Binding pending'
    });

  } catch (error) {
    console.error('Error checking binding status:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to check binding status' },
      { status: 500 }
    );
  }
} 