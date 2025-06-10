import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import {
  createSubscriptionResponse,
  updateSubscriptionResponse,
  getSubscriptionResponseByUserId,
} from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { purpose, name, email, organization, currentStep } = body;

    // Check if user already has a subscription response
    const existingResponse = await getSubscriptionResponseByUserId({
      userId: session.user.id,
    });

    let response;
    
    if (existingResponse) {
      // Update existing response
      response = await updateSubscriptionResponse({
        id: existingResponse.id,
        purpose,
        name,
        email,
        organization,
        currentStep,
        isCompleted: currentStep === 'beta',
        isSubmitted: currentStep === 'beta',
      });
    } else {
      // Create new response
      response = await createSubscriptionResponse({
        userId: session.user.id,
        purpose,
        name,
        email,
        organization,
        currentStep: currentStep || 'limit',
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error handling subscription response:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const response = await getSubscriptionResponseByUserId({
      userId: session.user.id,
    });

    return NextResponse.json(response || null);
  } catch (error) {
    console.error('Error getting subscription response:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 