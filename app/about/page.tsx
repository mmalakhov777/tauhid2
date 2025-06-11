'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export default function AboutPage() {
  const { t } = useTranslations();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <Link 
            href="/" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('aboutPage.backToChat')}
          </Link>
        </div>
        
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold mb-8">{t('aboutPage.title')}</h1>
          
          <div className="space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('aboutPage.ourMission')}</h2>
              <p>
                {t('aboutPage.missionDescription')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('aboutPage.whatWeOffer')}</h2>
              <p>
                {t('aboutPage.whatWeOfferDescription')}
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t('aboutPage.quranicVerses')}</li>
                <li>{t('aboutPage.hadithGuidance')}</li>
                <li>{t('aboutPage.islamicJurisprudence')}</li>
                <li>{t('aboutPage.prayerTimes')}</li>
                <li>{t('aboutPage.islamicHistory')}</li>
                <li>{t('aboutPage.dailyPractices')}</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('aboutPage.preciseGrounding')}</h2>
              <p>
                {t('aboutPage.preciseGroundingDescription')}
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t('aboutPage.risaleNurCollection')}</li>
                <li>{t('aboutPage.classicalHanafi')}</li>
                <li>{t('aboutPage.sadrAlShariah')}</li>
                <li>{t('aboutPage.hadithCollections')}</li>
                <li>{t('aboutPage.tafsirWorks')}</li>
                <li>{t('aboutPage.urduTexts')}</li>
                <li>{t('aboutPage.youtubeChannels')}</li>
                <li>{t('aboutPage.academicPublications')}</li>
              </ul>
              <p className="mt-2">
                {t('aboutPage.groundingConclusion')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('aboutPage.multilingualSupport')}</h2>
              <p>
                {t('aboutPage.multilingualDescription')}
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>{t('aboutPage.askInAnyLanguage')}</li>
                <li>{t('aboutPage.receiveInPreferred')}</li>
                <li>{t('aboutPage.accessSources')}</li>
                <li>{t('aboutPage.preserveAuthenticity')}</li>
                <li>{t('aboutPage.culturalContext')}</li>
              </ul>
              <p className="mt-2">
                {t('aboutPage.multilingualConclusion')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('aboutPage.importantDisclaimer')}</h2>
              <p>
                {t('aboutPage.disclaimerText')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('aboutPage.ourCommitment')}</h2>
              <p>
                {t('aboutPage.commitmentDescription')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">{t('aboutPage.community')}</h2>
              <p>
                {t('aboutPage.communityDescription')}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
} 