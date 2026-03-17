import React from 'react';
import { View, Text } from 'react-native';
import { getInrStatus, getStatusColor } from '../constants';

interface StatusBadgeProps {
  value: number;
  type: 'pct' | 'inr';
  min?: number;
  max?: number;
}

export function StatusBadge({ value, type, min, max }: StatusBadgeProps) {
  let status: 'Normal' | 'Bajo' | 'Alto';
  if (type === 'pct') {
    status = value >= 70 && value <= 120 ? 'Normal' : value < 70 ? 'Bajo' : 'Alto';
  } else {
    status = getInrStatus(value, min ?? 2, max ?? 3);
  }
  const color = getStatusColor(status);
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, backgroundColor: color + '18' }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{status}</Text>
    </View>
  );
}

export function getLabColor(type: 'pct' | 'inr', value: number | null, min?: number, max?: number): string {
  if (value == null) return '#1a1a1a';
  if (type === 'pct') {
    if (value >= 70 && value <= 120) return '#4CAF50';
    return value < 70 ? '#FF9800' : '#F44336';
  }
  return getStatusColor(getInrStatus(value, min ?? 2, max ?? 3));
}
