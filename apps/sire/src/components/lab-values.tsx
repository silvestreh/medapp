import React from 'react';
import { Text } from 'react-native';
import tw from 'styledwind-native';
import { getInrStatus, getStatusColor } from '../constants';
import { StatusBadge, getLabColor } from './status-badge';

const Card = tw.View`flex-row bg-white border border-gray-200 rounded-2xl py-5 mb-5 px-4`;
const Item = tw.View`flex-1 items-center px-4`;
const Divider = tw.View`w-px bg-gray-200 my-2`;
const Label = tw.Text`text-[10px] font-bold text-gray-400 tracking-wider px-4`;
const Unit = tw.Text`text-xs text-gray-400 -mt-0.5 mb-1.5 px-4`;

interface LabValuesProps {
  percentage: number | null;
  inr: number;
  targetInrMin: number;
  targetInrMax: number;
}

export function LabValues({ percentage, inr, targetInrMin, targetInrMax }: LabValuesProps) {
  return (
    <Card>
      <Item>
        <Label>PORCENTAJE</Label>
        <Text style={{ fontSize: 36, fontWeight: '700', marginTop: 2, color: getLabColor('pct', percentage) }}>
          {percentage != null ? Math.round(percentage) : '—'}
        </Text>
        <Unit>%</Unit>
        {percentage != null && <StatusBadge value={percentage} type="pct" />}
      </Item>
      <Divider />
      <Item>
        <Label>RIN</Label>
        <Text style={{ fontSize: 42, fontWeight: '700', marginTop: 2, color: getStatusColor(getInrStatus(inr, targetInrMin, targetInrMax)) }}>
          {inr.toFixed(1)}
        </Text>
        <Unit>{' '}</Unit>
        <StatusBadge value={inr} type="inr" min={targetInrMin} max={targetInrMax} />
      </Item>
    </Card>
  );
}
