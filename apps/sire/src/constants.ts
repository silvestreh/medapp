export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3030';

export const COLORS = {
  primary: '#69C6D8',
  primaryDark: '#52A8B9',
  primaryLight: '#D1F1F5',
  background: '#F5F5F5',
  white: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#FFFFFF',
  border: '#E0E0E0',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#F44336',
  normal: '#4CAF50',
  low: '#FF9800',
  high: '#F44336',
};

export const INR_THRESHOLDS = {
  low: 2.0,
  high: 3.0,
};

export function getInrStatus(inr: number, targetMin: number, targetMax: number): 'Normal' | 'Bajo' | 'Alto' {
  if (inr < targetMin) return 'Bajo';
  if (inr > targetMax) return 'Alto';
  return 'Normal';
}

export function getStatusColor(status: 'Normal' | 'Bajo' | 'Alto'): string {
  switch (status) {
  case 'Normal': return COLORS.normal;
  case 'Bajo': return COLORS.warning;
  case 'Alto': return COLORS.danger;
  }
}

export function doseToFraction(dose: number | null): string {
  if (dose === null || dose === undefined) return '—';
  if (dose === 0) return '—';
  if (dose === 0.25) return '¼';
  if (dose === 0.5) return '½';
  if (dose === 0.75) return '¾';
  if (dose === 1) return '1';
  if (dose === 1.5) return '1½';
  if (dose === 2) return '2';
  return String(dose);
}
