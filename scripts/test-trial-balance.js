#!/usr/bin/env node

// Simple test to verify the trial balance system logic
console.log('🧪 Testing Trial Balance System Logic\n');

// Mock the trial balance logic
function testTrialBalanceLogic() {
  console.log('1️⃣ Testing user type detection...');
  
  // Test cases for user type detection
  const testUsers = [
    { email: 'guest-123456@example.com', expected: 'guest', trialMessages: 2 },
    { email: 'telegram_987654321@telegram.local', expected: 'guest', trialMessages: 2 },
    { email: 'user@example.com', expected: 'regular', trialMessages: 5 },
    { email: 'test@gmail.com', expected: 'regular', trialMessages: 5 },
  ];
  
  testUsers.forEach(user => {
    const isGuest = user.email.startsWith('guest-') || user.email.includes('@telegram.local');
    const userType = isGuest ? 'guest' : 'regular';
    const trialMessages = userType === 'guest' ? 2 : 5;
    
    const correct = userType === user.expected && trialMessages === user.trialMessages;
    console.log(`   📧 ${user.email}: ${userType} (${trialMessages} messages) ${correct ? '✅' : '❌'}`);
  });
  
  console.log('\n2️⃣ Testing daily reset logic...');
  
  // Test daily reset scenarios
  const now = new Date();
  const testResetScenarios = [
    { lastReset: new Date(now.getTime() - 25 * 60 * 60 * 1000), shouldReset: true, desc: '25 hours ago' },
    { lastReset: new Date(now.getTime() - 23 * 60 * 60 * 1000), shouldReset: false, desc: '23 hours ago' },
    { lastReset: new Date(now.getTime() - 24 * 60 * 60 * 1000), shouldReset: true, desc: 'exactly 24 hours ago' },
    { lastReset: new Date(now.getTime() - 1 * 60 * 60 * 1000), shouldReset: false, desc: '1 hour ago' },
  ];
  
  testResetScenarios.forEach(scenario => {
    const hoursSinceReset = (now.getTime() - scenario.lastReset.getTime()) / (1000 * 60 * 60);
    const needsReset = hoursSinceReset >= 24;
    
    const correct = needsReset === scenario.shouldReset;
    console.log(`   ⏰ ${scenario.desc}: ${needsReset ? 'RESET' : 'NO RESET'} ${correct ? '✅' : '❌'}`);
  });
  
  console.log('\n3️⃣ Testing message consumption logic...');
  
  // Test message consumption scenarios
  const testConsumptionScenarios = [
    { trial: 2, paid: 0, expected: { success: true, usedTrial: true, remaining: 1 }, desc: 'Use trial message' },
    { trial: 0, paid: 5, expected: { success: true, usedTrial: false, remaining: 4 }, desc: 'Use paid message' },
    { trial: 1, paid: 3, expected: { success: true, usedTrial: true, remaining: 3 }, desc: 'Use trial first when both available' },
    { trial: 0, paid: 0, expected: { success: false, usedTrial: false, remaining: 0 }, desc: 'No messages left' },
  ];
  
  testConsumptionScenarios.forEach(scenario => {
    let trialRemaining = scenario.trial;
    let paidRemaining = scenario.paid;
    let success = false;
    let usedTrial = false;
    
    const totalRemaining = trialRemaining + paidRemaining;
    
    if (totalRemaining > 0) {
      success = true;
      if (trialRemaining > 0) {
        trialRemaining--;
        usedTrial = true;
      } else if (paidRemaining > 0) {
        paidRemaining--;
        usedTrial = false;
      }
    }
    
    const finalRemaining = trialRemaining + paidRemaining;
    const result = { success, usedTrial, remaining: finalRemaining };
    
    const correct = (
      result.success === scenario.expected.success &&
      result.usedTrial === scenario.expected.usedTrial &&
      result.remaining === scenario.expected.remaining
    );
    
    console.log(`   💬 ${scenario.desc}: ${JSON.stringify(result)} ${correct ? '✅' : '❌'}`);
  });
  
  console.log('\n4️⃣ Testing payment packages...');
  
  // Test payment packages
  const PAYMENT_PACKAGES = [
    { messages: 20, stars: 100, popular: false, bonus: 0 },
    { messages: 50, stars: 250, popular: true, bonus: 0 },
    { messages: 100, stars: 500, popular: false, bonus: 5 },
    { messages: 200, stars: 1000, popular: false, bonus: 20 }
  ];
  
  PAYMENT_PACKAGES.forEach((pkg, index) => {
    const totalMessages = pkg.messages + pkg.bonus;
    const starsPerMessage = (pkg.stars / totalMessages).toFixed(2);
    console.log(`   💰 Package ${index + 1}: ${pkg.messages}+${pkg.bonus} messages for ${pkg.stars} stars (${starsPerMessage} stars/msg) ${pkg.popular ? '⭐ POPULAR' : ''}`);
  });
  
  console.log('\n✅ All trial balance logic tests completed!');
}

// Run the test
testTrialBalanceLogic(); 