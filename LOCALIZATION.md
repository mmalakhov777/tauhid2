# Localization with Lingo.dev

This project uses [Lingo.dev](https://lingo.dev) for internationalization (i18n) and localization.

## Supported Languages

- English (en) - Source language
- Turkish (tr)
- Arabic (ar)
- Russian (ru)
- German (de)
- French (fr)
- Spanish (es)

## Setup

The localization system is already configured with:

- **Configuration**: `i18n.json` - Lingo.dev configuration
- **Source translations**: `public/locales/en.json` - English source file
- **Generated translations**: `public/locales/[language].json` - Auto-generated translations
- **Utilities**: `lib/i18n.ts` - Translation utilities and types
- **Context Provider**: `contexts/TranslationContext.tsx` - Global translation state
- **API Key**: Set in `.env.local` as `LINGODOTDEV_API_TOKEN`

## Usage

### In React Components

```tsx
import { useTranslations } from '@/lib/i18n';

export function MyComponent() {
  const { t, language, changeLanguage, isLoading } = useTranslations();

  if (isLoading) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div>
      <h1>{t('about.aboutTitle')}</h1>
      <p>{t('about.aboutDescription')}</p>
      <button onClick={() => changeLanguage('tr')}>
        Switch to Turkish
      </button>
    </div>
  );
}
```

### Translation Keys

Translation keys use dot notation to access nested values:

```tsx
// For this JSON structure:
{
  "common": {
    "loading": "Loading...",
    "error": "Error"
  },
  "sidebar": {
    "newChat": "New Chat"
  }
}

// Use these keys:
t('common.loading')     // "Loading..."
t('common.error')       // "Error"
t('sidebar.newChat')    // "New Chat"
```

### With Fallbacks

```tsx
// Provide a fallback if the key doesn't exist
t('some.missing.key', 'Default text')
```

## Adding New Translations

1. **Add to source file**: Edit `public/locales/en.json` with new keys
2. **Run translation**: Execute `npm run i18n` to generate translations
3. **Use in components**: Import and use the `useTranslations` hook

## Scripts

- `npm run i18n` - Generate translations for all target languages
- `npm run i18n:check` - Check available source and target languages

## File Structure

```
public/locales/
├── en.json     # Source (English)
├── tr.json     # Turkish
├── ar.json     # Arabic
├── ru.json     # Russian
├── de.json     # German
├── fr.json     # French
└── es.json     # Spanish
```

## Language Switching

The language selector in the sidebar automatically:
- Loads the user's preferred language from localStorage
- **Updates all components instantly without page reload** (using global context)
- Persists the selection across sessions
- Syncs language changes across multiple tabs/windows
- Integrates with your existing chat language instructions

## API Integration

For server-side translations (API routes):

```tsx
import { getServerTranslations, serverTranslate } from '@/lib/i18n';

export async function POST(request: Request) {
  const language = 'tr'; // Get from request
  const translations = await getServerTranslations(language);
  const message = serverTranslate(translations, 'common.success');
  
  return Response.json({ message });
}
```

## Best Practices

1. **Organize keys logically**: Group related translations under common prefixes
2. **Use descriptive keys**: `auth.signIn` instead of `btn1`
3. **Keep fallbacks**: Always provide fallback text for missing keys
4. **Test all languages**: Verify translations work in your UI
5. **Update regularly**: Run `npm run i18n` after adding new keys

## Integration with Existing Features

The localization system integrates seamlessly with your existing:
- Language selector in the sidebar
- Chat language instructions
- localStorage persistence
- All UI components

Your chat system will continue to work as before, but now the UI text will be properly localized based on the user's language selection. 