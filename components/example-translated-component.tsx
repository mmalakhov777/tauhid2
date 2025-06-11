'use client';

import { useTranslations } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

export function ExampleTranslatedComponent() {
  const { t, language, changeLanguage, isLoading, supportedLanguages } = useTranslations();

  if (isLoading) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">{t('about.aboutTitle')}</h1>
      <p className="text-muted-foreground">{t('about.aboutDescription')}</p>
      
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t('common.select')} {t('profile.language')}</h2>
        <div className="flex flex-wrap gap-2">
          {supportedLanguages.map((lang) => (
            <Button
              key={lang.code}
              variant={language === lang.code ? "default" : "outline"}
              size="sm"
              onClick={() => changeLanguage(lang.code)}
            >
              {lang.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-md font-medium">{t('common.examples')}:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>{t('common.loading')}</li>
          <li>{t('common.error')}</li>
          <li>{t('common.success')}</li>
          <li>{t('sidebar.newChat')}</li>
          <li>{t('chat.typeMessage')}</li>
          <li>{t('auth.signIn')}</li>
        </ul>
      </div>

      <div className="text-xs text-muted-foreground">
        Current language: {language} ({supportedLanguages.find(l => l.code === language)?.name})
      </div>
    </div>
  );
} 