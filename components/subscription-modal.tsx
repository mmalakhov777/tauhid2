'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTelegram } from '@/hooks/useTelegram';
import { guestRegex } from '@/lib/constants';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles,
  ArrowRight,
  Heart,
  Zap,
  Mail,
  User,
  Building2,
  MessageSquare
} from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsage?: number;
  maxLimit?: number;
}

interface FormData {
  purpose: string;
  name: string;
  email: string;
  organization?: string;
}

type Step = 'limit' | 'purpose' | 'info' | 'beta';

export function SubscriptionModal({ 
  open, 
  onOpenChange, 
  currentUsage = 0, 
  maxLimit = 0 
}: SubscriptionModalProps) {
  const { data: session } = useSession();
  const { user: telegramUser } = useTelegram();
  const [currentStep, setCurrentStep] = useState<Step>('limit');
  const [formData, setFormData] = useState<FormData>({
    purpose: '',
    name: '',
    email: '',
    organization: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Minimalistic glassmorphism styles
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* MINIMALISTIC GLASS EFFECTS */
      [data-glass="true"] {
        background: rgba(255, 255, 255, 0.02) !important;
        backdrop-filter: blur(40px) saturate(150%) !important;
        -webkit-backdrop-filter: blur(40px) saturate(150%) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        box-shadow: 
          0 8px 32px rgba(0, 0, 0, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
      }
      .dark [data-glass="true"] {
        background: rgba(255, 255, 255, 0.01) !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
        box-shadow: 
          0 8px 32px rgba(0, 0, 0, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.02) !important;
      }
      
      /* ACCENT GLASS */
      [data-glass-accent="true"] {
        background: linear-gradient(135deg, 
          rgba(99, 102, 241, 0.08) 0%, 
          rgba(99, 102, 241, 0.04) 100%) !important;
        backdrop-filter: blur(40px) saturate(150%) !important;
        -webkit-backdrop-filter: blur(40px) saturate(150%) !important;
        border: 1px solid rgba(99, 102, 241, 0.15) !important;
        box-shadow: 
          0 8px 32px rgba(99, 102, 241, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
      }
      .dark [data-glass-accent="true"] {
        background: linear-gradient(135deg, 
          rgba(99, 102, 241, 0.06) 0%, 
          rgba(99, 102, 241, 0.02) 100%) !important;
        border: 1px solid rgba(99, 102, 241, 0.1) !important;
        box-shadow: 
          0 8px 32px rgba(99, 102, 241, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.02) !important;
      }
      
      /* SMOOTH TRANSITIONS */
      [data-glass="true"], [data-glass-accent="true"] {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
      
      /* HOVER EFFECTS */
      [data-glass-hover="true"]:hover {
        background: rgba(255, 255, 255, 0.04) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        transform: translateY(-1px) !important;
      }
      .dark [data-glass-hover="true"]:hover {
        background: rgba(255, 255, 255, 0.02) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const user = session?.user;
  const isGuest = guestRegex.test(user?.email ?? '');
  const isTelegramUser = user?.email?.startsWith('telegram_') && user?.email?.endsWith('@telegram.local');

  // Pre-fill user data
  useEffect(() => {
    if (open && user) {
      const displayName = telegramUser && isTelegramUser
        ? `${telegramUser.first_name}${telegramUser.last_name ? ' ' + telegramUser.last_name : ''}`
        : isGuest 
        ? '' 
        : user?.name || '';
      
      const userEmail = isGuest ? '' : user?.email || '';
      
      setFormData(prev => ({
        ...prev,
        name: displayName,
        email: userEmail
      }));
    }
  }, [open, user, telegramUser, isTelegramUser, isGuest]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setCurrentStep('limit');
    }
  }, [open]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      console.log('Subscription request:', formData);
      await new Promise(resolve => setTimeout(resolve, 1000));
      onOpenChange(false);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: Step[] = ['limit', 'purpose', 'info', 'beta'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'purpose':
        return formData.purpose.trim().length > 0;
      case 'info':
        return formData.name.trim().length > 0 && formData.email.trim().length > 0;
      default:
        return true;
    }
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        data-glass="true"
        className="max-w-md p-0 overflow-hidden border-0"
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-normal tracking-tight">
              Upgrade Your Experience
            </DialogTitle>
          </DialogHeader>
          
          {/* Progress */}
          <div className="mt-6">
            <Progress value={progress} className="h-1" />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Limit Step */}
          {currentStep === 'limit' && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-orange-500" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Daily Limit Reached</h3>
                  <p className="text-sm text-muted-foreground">
                    You've used {currentUsage} of your {maxLimit} daily messages
                  </p>
                </div>

                <div className="relative pt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{currentUsage} used</span>
                    <span>{maxLimit - currentUsage} left</span>
                  </div>
                  <Progress value={(currentUsage / maxLimit) * 100} className="h-2" />
                </div>
              </div>

              <Button 
                onClick={nextStep}
                className="w-full"
                size="lg"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Purpose Step */}
          {currentStep === 'purpose' && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    How will you use our service?
                  </label>
                  <Textarea
                    placeholder="Tell us about your use case..."
                    value={formData.purpose}
                    onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                    className="min-h-[120px] resize-none bg-transparent"
                    data-glass="true"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {['Research', 'Business', 'Education', 'Personal'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        purpose: prev.purpose ? `${prev.purpose} ${tag}` : tag 
                      }))}
                      className="px-3 py-1.5 text-xs rounded-full border border-border/50 hover:bg-accent/50 transition-colors"
                      data-glass="true"
                      data-glass-hover="true"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={prevStep}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Info Step */}
          {currentStep === 'info' && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Name
                  </label>
                  <Input
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-transparent"
                    data-glass="true"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="bg-transparent"
                    data-glass="true"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Organization
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    placeholder="Company or institution"
                    value={formData.organization}
                    onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                    className="bg-transparent"
                    data-glass="true"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={prevStep}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="flex-1"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Beta Step */}
          {currentStep === 'beta' && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-indigo-500" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">We're in Beta</h3>
                  <p className="text-sm text-muted-foreground">
                    Thanks for your interest! We'll notify you when subscriptions are available.
                  </p>
                </div>

                <div 
                  className="p-4 rounded-xl space-y-3"
                  data-glass-accent="true"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-medium">Support Our Project</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Help us grow with crypto donations
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="w-full"
                    onClick={() => console.log('Open donations')}
                  >
                    View Options
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={prevStep}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting
                    </>
                  ) : (
                    <>
                      Submit
                      <MessageSquare className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}