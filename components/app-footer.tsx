'use client';

import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';

export function AppFooter() {
  const { t } = useTranslations();
  
  const footerLinks = [
    { label: t('navigation.sources'), href: '/sources' },
    { label: t('navigation.terms'), href: '/terms' },
    { label: t('navigation.privacy'), href: '/privacy' },
    { label: t('navigation.about'), href: '/about' },
    { label: t('navigation.contact'), href: '/contact' },
  ];

  return (
    <div className="w-full max-w-full mt-6 sm:mt-8">
      <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 px-2">
        {footerLinks.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div className="text-center mt-3 sm:mt-4">
        <p className="text-xs text-muted-foreground">
          © 2025 Islamic Knowledge Assistant. All rights reserved.
        </p>
      </div>
    </div>
  );
} 