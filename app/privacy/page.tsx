'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function PrivacyPage() {
  const { t } = useTranslations();
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('privacyPage.backToChat')}
          </Link>
        </div>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8">{t('privacyPage.title')}</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('privacyPage.informationCollectTitle')}</h2>
              <p>
                {t('privacyPage.informationCollectText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('privacyPage.howWeUseTitle')}</h2>
              <p>
                {t('privacyPage.howWeUseText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('privacyPage.informationSharingTitle')}</h2>
              <p>
                {t('privacyPage.informationSharingText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('privacyPage.dataSecurityTitle')}</h2>
              <p>
                {t('privacyPage.dataSecurityText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('privacyPage.cookiesTitle')}</h2>
              <p>
                {t('privacyPage.cookiesText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('privacyPage.changesTitle')}</h2>
              <p>
                {t('privacyPage.changesText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('privacyPage.contactTitle')}</h2>
              <p>
                {t('privacyPage.contactText')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 