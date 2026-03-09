import * as Sentry from '@sentry/remix';

/** Track route navigation with semantic context */
export function trackNavigation(description: string, data?: Record<string, string>): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: description,
    level: 'info',
    data,
  });
}

/** Track discrete user actions (clicks, searches, uploads) */
export function trackAction(action: string, data?: Record<string, string>): void {
  Sentry.addBreadcrumb({
    category: 'user.action',
    message: action,
    level: 'info',
    data,
  });
}

/** Track higher-level feature interactions */
export function trackFeature(feature: string, data?: Record<string, string>): void {
  Sentry.addBreadcrumb({
    category: 'feature',
    message: feature,
    level: 'info',
    data,
  });
}
