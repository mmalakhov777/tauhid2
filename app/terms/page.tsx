'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function TermsPage() {
  const { t } = useTranslations();
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('termsPage.backToChat')}
          </Link>
        </div>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8">{t('termsPage.title')}</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('termsPage.acceptanceTitle')}</h2>
              <p>
                {t('termsPage.acceptanceText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('termsPage.useLicenseTitle')}</h2>
              <p>
                {t('termsPage.useLicenseText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('termsPage.disclaimerTitle')}</h2>
              <p>
                {t('termsPage.disclaimerText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('termsPage.limitationsTitle')}</h2>
              <p>
                {t('termsPage.limitationsText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('termsPage.accuracyTitle')}</h2>
              <p>
                {t('termsPage.accuracyText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('termsPage.modificationsTitle')}</h2>
              <p>
                {t('termsPage.modificationsText')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 