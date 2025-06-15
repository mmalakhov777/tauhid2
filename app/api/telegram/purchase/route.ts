import { NextRequest, NextResponse } from 'next/server';
import { PAYMENT_CONFIG } from '@/lib/ai/entitlements';
import { getUser, addPaidMessages, recordStarPayment } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface PurchaseRequest {
  telegramUserId: number;
  packageIndex: number; // Index in PAYMENT_CONFIG.PACKAGES
}

interface TelegramInvoiceResponse {
  ok: boolean;
  result?: {
    invoice_link: string;
  };
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: PurchaseRequest = await request.json();
    const { telegramUserId, packageIndex } = body;

    // Validate package index
    if (packageIndex < 0 || packageIndex >= PAYMENT_CONFIG.PACKAGES.length) {
      return NextResponse.json(
        { error: 'Invalid package index' },
        { status: 400 }
      );
    }

    const selectedPackage = PAYMENT_CONFIG.PACKAGES[packageIndex];
    const totalMessages = selectedPackage.messages + selectedPackage.bonus;

    // Find user by Telegram ID
    const users = await getUser(`telegram_${telegramUserId}@telegram.local`);
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];
    const invoicePayload = generateUUID(); // Unique payload for this purchase

    // Create Telegram Stars invoice
    const invoiceData = {
      chat_id: telegramUserId,
      title: `💬 ${totalMessages} Messages`,
      description: `Purchase ${selectedPackage.messages} messages${selectedPackage.bonus > 0 ? ` + ${selectedPackage.bonus} bonus` : ''} for your AI chat assistant`,
      payload: invoicePayload,
      currency: 'XTR', // Telegram Stars currency
      prices: [
        {
          label: `${totalMessages} Messages`,
          amount: selectedPackage.stars
        }
      ],
      photo_url: 'https://via.placeholder.com/512x512/4F46E5/FFFFFF?text=💬',
      photo_width: 512,
      photo_height: 512,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      send_phone_number_to_provider: false,
      send_email_to_provider: false,
      is_flexible: false
    };

    console.log('[Telegram Purchase] Creating invoice:', {
      userId: user.id,
      telegramUserId,
      packageIndex,
      messages: totalMessages,
      stars: selectedPackage.stars,
      payload: invoicePayload
    });

    // Send invoice to Telegram
    const response = await fetch(`${TELEGRAM_API_URL}/sendInvoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoiceData),
    });

    const telegramResponse: TelegramInvoiceResponse = await response.json();

    if (!telegramResponse.ok) {
      console.error('[Telegram Purchase] Failed to create invoice:', telegramResponse);
      return NextResponse.json(
        { error: 'Failed to create invoice', details: telegramResponse.description },
        { status: 500 }
      );
    }

    console.log('[Telegram Purchase] Invoice created successfully:', {
      invoiceLink: telegramResponse.result?.invoice_link,
      payload: invoicePayload
    });

    return NextResponse.json({
      success: true,
      invoiceLink: telegramResponse.result?.invoice_link,
      payload: invoicePayload,
      package: {
        messages: selectedPackage.messages,
        bonus: selectedPackage.bonus,
        totalMessages,
        stars: selectedPackage.stars
      }
    });

  } catch (error) {
    console.error('[Telegram Purchase] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle successful payment webhook
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramPaymentChargeId, invoicePayload, telegramUserId, totalAmount } = body;

    console.log('[Telegram Purchase] Processing successful payment:', {
      telegramPaymentChargeId,
      invoicePayload,
      telegramUserId,
      totalAmount
    });

    // Find user by Telegram ID
    const users = await getUser(`telegram_${telegramUserId}@telegram.local`);
    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = users[0];

    // Calculate messages from stars (reverse calculation)
    const starsSpent = totalAmount;
    let messagesAdded = 0;
    let packageUsed = null;

    // Find which package was purchased
    for (const pkg of PAYMENT_CONFIG.PACKAGES) {
      if (pkg.stars === starsSpent) {
        messagesAdded = pkg.messages + pkg.bonus;
        packageUsed = pkg;
        break;
      }
    }

    if (messagesAdded === 0) {
      console.error('[Telegram Purchase] Could not determine package from stars amount:', starsSpent);
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      );
    }

    // Add messages to user's balance
    await addPaidMessages(user.id, messagesAdded);

    // Record the payment
    await recordStarPayment({
      userId: user.id,
      telegramPaymentChargeId,
      starAmount: starsSpent,
      messagesAdded
    });

    console.log('[Telegram Purchase] Payment processed successfully:', {
      userId: user.id,
      messagesAdded,
      starsSpent,
      package: packageUsed
    });

    return NextResponse.json({
      success: true,
      messagesAdded,
      starsSpent,
      package: packageUsed
    });

  } catch (error) {
    console.error('[Telegram Purchase] Error processing payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 