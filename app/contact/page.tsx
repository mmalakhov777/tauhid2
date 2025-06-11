'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function ContactPage() {
  const { t } = useTranslations();
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('contactPage.backToChat')}
          </Link>
        </div>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8">{t('contactPage.title')}</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('contactPage.getInTouchTitle')}</h2>
              <p>
                {t('contactPage.getInTouchText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('contactPage.supportTitle')}</h2>
              <p>
                {t('contactPage.supportText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('contactPage.feedbackTitle')}</h2>
              <p>
                {t('contactPage.feedbackText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('contactPage.contentConcernsTitle')}</h2>
              <p>
                {t('contactPage.contentConcernsText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('contactPage.partnershipTitle')}</h2>
              <p>
                {t('contactPage.partnershipText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('contactPage.responseTimeTitle')}</h2>
              <p>
                {t('contactPage.responseTimeText')}
              </p>
            </section>

            <div className="mt-8 p-6 bg-muted/50 rounded-lg">
              <p className="text-sm text-center">
                <strong>{t('contactPage.noteLabel')}</strong> {t('contactPage.noteText')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 