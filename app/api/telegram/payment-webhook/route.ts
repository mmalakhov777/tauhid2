import { NextRequest, NextResponse } from 'next/server';
import { getUserByTelegramId, addPaidMessages, recordStarPayment } from '@/lib/db/queries';
import { PAYMENT_CONFIG } from '@/lib/ai/entitlements';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramPreCheckoutQuery {
  id: string;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  currency: string;
  total_amount: number;
  invoice_payload: string;
}

interface TelegramSuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  telegram_payment_charge_id: string;
  provider_payment_charge_id?: string;
}

interface TelegramPaymentUpdate {
  update_id: number;
  pre_checkout_query?: TelegramPreCheckoutQuery;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    successful_payment?: TelegramSuccessfulPayment;
  };
}

async function sendMessage(chatId: number, text: string, parseMode: string = 'Markdown') {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('[Payment Webhook] Failed to send message:', result);
    }
    return result;
  } catch (error) {
    console.error('[Payment Webhook] Error sending message:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TelegramPaymentUpdate = await request.json();
    
    console.log('[Payment Webhook] Received update:', JSON.stringify(body, null, 2));

    // Handle pre-checkout query (payment authorization)
    if (body.pre_checkout_query) {
      const preCheckout = body.pre_checkout_query;
      
      console.log('[Payment Webhook] Processing pre-checkout query:', {
        queryId: preCheckout.id,
        telegramUserId: preCheckout.from.id,
        amount: preCheckout.total_amount,
        currency: preCheckout.currency,
        payload: preCheckout.invoice_payload
      });

      // Validate the payment
      let isValid = true;
      let errorMessage = '';

      // Check if user exists
      const users = await getUserByTelegramId(preCheckout.from.id);
      if (users.length === 0) {
        isValid = false;
        errorMessage = 'User not found in our system';
      }

      // Validate amount against our packages
      if (isValid) {
        const packageExists = PAYMENT_CONFIG.PACKAGES.some(pkg => pkg.stars === preCheckout.total_amount);
        if (!packageExists) {
          isValid = false;
          errorMessage = 'Invalid payment amount';
        }
      }

      // Answer the pre-checkout query
      await fetch(`${TELEGRAM_API_URL}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: preCheckout.id,
          ok: isValid,
          error_message: isValid ? undefined : errorMessage
        }),
      });

      console.log('[Payment Webhook] Pre-checkout query answered:', {
        queryId: preCheckout.id,
        approved: isValid,
        error: errorMessage || 'none'
      });

      return NextResponse.json({ ok: true, pre_checkout_handled: true });
    }

    // Handle successful payment
    if (body.message?.successful_payment) {
      const payment = body.message.successful_payment;
      const telegramUserId = body.message.from.id;
      const chatId = body.message.chat.id;

      console.log('[Payment Webhook] Processing successful payment:', {
        telegramUserId,
        chatId,
        amount: payment.total_amount,
        currency: payment.currency,
        chargeId: payment.telegram_payment_charge_id,
        payload: payment.invoice_payload
      });

      // Find user in database
      const users = await getUserByTelegramId(telegramUserId);
      if (users.length === 0) {
        console.error('[Payment Webhook] User not found for successful payment:', telegramUserId);
        await sendMessage(chatId, '❌ Payment processed but user not found. Please contact support.', 'Markdown');
        return NextResponse.json({ ok: true, error: 'User not found' });
      }

      const user = users[0];

      // Find which package was purchased
      const purchasedPackage = PAYMENT_CONFIG.PACKAGES.find(pkg => pkg.stars === payment.total_amount);
      if (!purchasedPackage) {
        console.error('[Payment Webhook] Invalid payment amount:', payment.total_amount);
        await sendMessage(chatId, '❌ Invalid payment amount. Please contact support.', 'Markdown');
        return NextResponse.json({ ok: true, error: 'Invalid payment amount' });
      }

      const messagesAdded = purchasedPackage.messages + purchasedPackage.bonus;

      try {
        // Add messages to user's balance
        await addPaidMessages(user.id, messagesAdded);

        // Record the payment
        await recordStarPayment({
          userId: user.id,
          telegramPaymentChargeId: payment.telegram_payment_charge_id,
          starAmount: payment.total_amount,
          messagesAdded
        });

        // Send success message
        const successMessage = `✅ **Payment Successful!**

🎉 **${messagesAdded} messages** have been added to your account!

**Purchase Details:**
• Package: ${purchasedPackage.messages} messages${purchasedPackage.bonus > 0 ? ` + ${purchasedPackage.bonus} bonus` : ''}
• Cost: ${payment.total_amount} ⭐ Telegram Stars
• Transaction ID: \`${payment.telegram_payment_charge_id}\`

💰 Your paid messages never expire and work alongside your daily trial messages.
📊 Use /balance to check your current message balance.

Thank you for your purchase! 🌟`;

        await sendMessage(chatId, successMessage, 'Markdown');

        console.log('[Payment Webhook] Payment processed successfully:', {
          userId: user.id,
          telegramUserId,
          messagesAdded,
          starsSpent: payment.total_amount,
          chargeId: payment.telegram_payment_charge_id
        });

        return NextResponse.json({ 
          ok: true, 
          payment_processed: true,
          messages_added: messagesAdded,
          stars_spent: payment.total_amount
        });

      } catch (error) {
        console.error('[Payment Webhook] Error processing payment:', error);
        await sendMessage(chatId, '❌ Payment received but failed to add messages. Please contact support with transaction ID: `' + payment.telegram_payment_charge_id + '`', 'Markdown');
        return NextResponse.json({ ok: true, error: 'Payment processing failed' });
      }
    }

    console.log('[Payment Webhook] No relevant payment data found in update');
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('[Payment Webhook] Error processing payment webhook:', error);
    return NextResponse.json({ 
      ok: true, 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 