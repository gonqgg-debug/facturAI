import { get } from 'svelte/store';
import { locale } from '../stores';
import { en } from './translations/en';
import { es } from './translations/es';

export type Locale = 'en' | 'es';

const translations = {
  en,
  es
};

export function t(key: string, currentLocale?: Locale | string): string {
  const localeValue = (currentLocale || get(locale)) as Locale;
  const keys = key.split('.');
  let value: any = translations[localeValue] || translations.en;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English if key not found
      value = translations.en;
      for (const k2 of keys) {
        if (value && typeof value === 'object' && k2 in value) {
          value = value[k2];
        } else {
          return key; // Return key if not found in fallback
        }
      }
      break;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

// Helper function for template strings with placeholders
export function tWithParams(key: string, params: Record<string, string>): string {
  let translation = t(key);
  Object.entries(params).forEach(([param, value]) => {
    translation = translation.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
  });
  return translation;
}

