'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTelegram } from '@/hooks/useTelegram';
import { guestRegex } from '@/lib/constants';
import { 
  Sparkles,
  ArrowRight,
  Heart,
  Zap,
  Mail,
  User,
  Building2,
  MessageSquare,
  X,
  Check
} from 'lucide-react';
import React from 'react';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsage?: number;
  maxLimit?: number;
}

interface FormData {
  purposes: string[];
  role: string;
  name: string;
  email: string;
  organization?: string;
}

type Step = 'limit' | 'purpose' | 'info' | 'beta';

// Simple Button Component - Using design system colors
const SimpleButton = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary',
  size = 'default',
  className = '',
  ...props 
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  [key: string]: any;
}) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'bg-transparent hover:bg-accent text-accent-foreground'
  };

  const sizes = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-8 px-3 py-1.5 text-xs',
    lg: 'h-12 px-6 py-3 text-base'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-colors duration-200 cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

// Custom Input Component - Using design system colors
const CustomInput = ({ 
  placeholder, 
  value, 
  onChange, 
  type = 'text',
  className = '',
  ...props 
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`
        w-full px-4 py-3 rounded-lg text-sm
        bg-background border border-input text-foreground placeholder:text-muted-foreground
        focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring
        transition-colors duration-200
        ${className}
      `}
      {...props}
    />
  );
};

// Custom Textarea Component - Using design system colors
const CustomTextarea = ({ 
  placeholder, 
  value, 
  onChange,
  className = '',
  ...props 
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`
        w-full px-4 py-3 rounded-lg text-sm min-h-[120px] resize-none
        bg-background border border-input text-foreground placeholder:text-muted-foreground
        focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring
        transition-colors duration-200
        ${className}
      `}
      {...props}
    />
  );
};

// Form Step Progress - Stepper style for form navigation
const FormStepProgress = ({ value, className = '' }: { value: number; className?: string }) => {
  const steps = 4; // Total number of steps
  const currentStep = Math.ceil((value / 100) * steps);
  
  return (
    <div className={`flex items-center gap-2 w-full ${className}`}>
      {Array.from({ length: steps }, (_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber <= currentStep;
        const isActive = stepNumber === currentStep;
        
        return (
          <div key={index} className="flex items-center flex-1">
            {/* Step line */}
            <div 
              className={`h-0.5 flex-1 transition-all duration-300 ${
                isCompleted 
                  ? 'bg-primary' 
                  : 'bg-border'
              }`}
            />
            {/* Step dot (except for last step) */}
            {index < steps - 1 && (
              <div 
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-primary' 
                    : isActive 
                    ? 'bg-primary/50' 
                    : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Message Usage Progress - Simple bar for message limits (UNTOUCHED)
const MessageProgress = ({ value, className = '' }: { value: number; className?: string }) => {
  return (
    <div className={`w-full bg-secondary rounded-full h-1 overflow-hidden ${className}`}>
      <div 
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

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
    purposes: [],
    role: '',
    name: '',
    email: '',
    organization: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setFormData(prev => ({
        ...prev,
        purposes: [],
        role: ''
      }));
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
        return formData.purposes.length > 0;
      case 'info':
        return formData.role.trim().length > 0;
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

  const togglePurpose = (purpose: string) => {
    setFormData(prev => ({
      ...prev,
      purposes: prev.purposes.includes(purpose)
        ? prev.purposes.filter(p => p !== purpose)
        : [...prev.purposes, purpose]
    }));
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 backdrop-blur-sm z-[9999] transition-all duration-300"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div 
          className="
            relative w-full max-w-md sm:max-w-lg
            h-[90vh] sm:h-auto sm:max-h-[90vh]
            m-4 sm:m-6
            bg-card border border-border
            rounded-2xl
            shadow-xl
            overflow-hidden
            transform transition-all duration-300 scale-100 opacity-100
          "
          onClick={(e) => e.stopPropagation()}
          >
          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="
              absolute top-4 right-4 z-10 p-2 rounded-full
              bg-white/20 backdrop-blur-md border border-white/30 text-white
              hover:bg-white/30 hover:border-white/40
              transition-all duration-200
            "
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Image - Full width, no padding - Hidden on purpose and info steps */}
          {currentStep !== 'purpose' && currentStep !== 'info' && (
            <div className="w-full">
              <img 
                src="/images/limitsreached_dark.png" 
                alt="Limits reached" 
                className="w-full h-64 object-cover rounded-t-2xl"
              />
            </div>
          )}

          {/* Content */}
          <div className="flex flex-col" style={{ height: currentStep === 'purpose' || currentStep === 'info' ? '100%' : 'calc(100% - 256px)' }}>
            <div className="flex-1 p-6 pt-8 overflow-hidden">
              {/* Limit Step */}
              {currentStep === 'limit' && (
                <div className="space-y-6">
                  <div className="text-center space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-card-foreground">Daily Limit Reached</h3>
                      <p className="text-sm text-muted-foreground">
                        You've used {currentUsage} of your {maxLimit} daily messages
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Purpose Step - Multiple Choice */}
              {currentStep === 'purpose' && (
                <div className="h-full flex flex-col space-y-4">
                  <div className="space-y-2 flex-shrink-0">
                    <label className="text-sm font-medium text-card-foreground">
                      What do you plan to use our Islamic AI for? (Select all that apply)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Choose the areas where you need Islamic guidance
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        'Quranic verses and interpretation',
                        'Hadith research and authentication',
                        'Islamic jurisprudence (Fiqh) questions',
                        'Prayer and worship guidance',
                        'Islamic history and biography',
                        'Halal/Haram clarifications',
                        'Islamic finance and business ethics',
                        'Family and marriage guidance',
                        'Academic research on Islam',
                        'Converting to Islam guidance',
                        'Daily Islamic living advice',
                        'Comparative religion studies'
                      ].map((purpose) => (
                        <button
                          key={purpose}
                          onClick={() => togglePurpose(purpose)}
                          className={`
                            w-full px-3 py-2.5 text-sm text-left rounded-lg border transition-all duration-200
                            flex items-center justify-between
                            ${formData.purposes.includes(purpose)
                              ? 'bg-primary/10 border-primary text-primary' 
                              : 'bg-secondary border-border text-secondary-foreground hover:bg-secondary/80'
                            }
                          `}
                        >
                          <span className="flex-1 pr-2">{purpose}</span>
                          {formData.purposes.includes(purpose) && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Info Step - Role Selection */}
              {currentStep === 'info' && (
                <div className="h-full flex flex-col space-y-4">
                  <div className="space-y-2 flex-shrink-0">
                    <label className="text-sm font-medium text-card-foreground">
                      What best describes your background?
                    </label>
                    <p className="text-xs text-muted-foreground">
                      This helps us understand our user community
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        'Muslim seeking guidance',
                        'Islamic studies student', 
                        'Islamic scholar/Teacher', 
                        'Imam/Religious leader',
                        'Academic researcher', 
                        'New Muslim/Convert', 
                        'Non-Muslim learning about Islam',
                        'Islamic content creator',
                        'Islamic finance professional',
                        'Chaplain/Counselor',
                        'Parent seeking Islamic guidance',
                        'Other'
                      ].map((role) => (
                        <button
                          key={role}
                          onClick={() => setFormData(prev => ({ ...prev, role }))}
                          className={`
                            w-full px-3 py-2.5 text-sm text-left rounded-lg border transition-all duration-200
                            flex items-center justify-between
                            ${formData.role === role 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'bg-secondary border-border text-secondary-foreground hover:bg-secondary/80'
                            }
                          `}
                        >
                          <span className="flex-1 pr-2">{role}</span>
                          {formData.role === role && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Beta Step */}
              {currentStep === 'beta' && (
                <div className="space-y-4">
                  <div className="text-center space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-card-foreground">We're in Beta</h3>
                      <p className="text-sm text-muted-foreground">
                        Thanks for your interest! We'll notify you when subscriptions are available.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl space-y-3 bg-muted border border-border">
                      <div className="flex items-center justify-center gap-2">
                        <Heart className="w-4 h-4 text-pink-500" />
                        <span className="text-sm font-medium text-card-foreground">Support Our Project</span>
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-card-foreground">USDT (TRC-20)</p>
                        <div className="flex items-center gap-2 p-2 bg-background rounded border">
                          <span className="text-xs font-mono text-muted-foreground flex-1 break-all">
                            TXkGC7GzZBQQgqMVX4bhfQj1BAtLbg2Tgw
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText('TXkGC7GzZBQQgqMVX4bhfQj1BAtLbg2Tgw')}
                            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Bottom Buttons */}
            <div className="p-6 pt-0 border-t border-border/50">
              {currentStep === 'limit' && (
                <SimpleButton 
                  onClick={nextStep}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </SimpleButton>
              )}

              {currentStep === 'purpose' && (
                <SimpleButton 
                  onClick={nextStep}
                  disabled={!canProceed()}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </SimpleButton>
              )}

              {currentStep === 'info' && (
                <SimpleButton 
                  onClick={nextStep}
                  disabled={!canProceed()}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </SimpleButton>
              )}

              {currentStep === 'beta' && (
                <SimpleButton 
                  onClick={() => window.open('https://t.me/+joudeWBlIzIxOTdi', '_blank')}
                  variant="primary"
                  size="lg"
                  className="w-full"
                >
                  <MessageSquare className="w-4 h-4" />
                  Join our Telegram
                </SimpleButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}