import React from 'react';
import { View, Text, Pressable } from 'react-native';
import tw from 'styledwind-native';
import dayjs from 'dayjs';
import { getInrStatus, getStatusColor } from '../constants';
import type { SireReading } from '../types';

const Section = tw.View`mb-4`;
const Header = tw.View`flex-row justify-between items-center mb-2.5 px-4`;
const Title = tw.Text`text-lg font-bold text-gray-900`;
const ViewAll = tw.Text`text-sm font-semibold text-[#53B3C6]`;
const Container = tw.View`border border-gray-200 rounded-xl`;

type RowProps = { isFirst: boolean; isLast: boolean };
const Row = tw.View<RowProps>`
  flex-row items-center bg-white border-b border-gray-200 py-3.5 px-4
  ${({ isFirst }) => isFirst && tw`rounded-t-xl`}
  ${({ isLast }) => isLast && tw`rounded-b-xl border-b-0`}
`;
const DateCol = tw.View`flex-1`;
const DateText = tw.Text`text-sm font-semibold text-gray-900`;
const Ago = tw.Text`text-xs text-gray-400 mt-0.5`;
const Vals = tw.View`flex-row gap-4 mr-3`;
const Val = tw.View`items-center`;
const ValLabel = tw.Text`text-[10px] font-bold text-gray-300`;
const ValNum = tw.Text`text-base font-bold text-gray-900`;

interface ReadingHistoryProps {
  readings: SireReading[];
  targetInrMin: number;
  targetInrMax: number;
  onViewAll: () => void;
}

export function ReadingHistory({ readings, targetInrMin, targetInrMax, onViewAll }: ReadingHistoryProps) {
  const today = dayjs();

  return (
    <Section>
      <Header>
        <Title>Historial</Title>
        <Pressable onPress={onViewAll}><ViewAll>Ver todo</ViewAll></Pressable>
      </Header>
      <Container>
        {readings.map((r, index) => {
          const status = getInrStatus(r.inr, targetInrMin, targetInrMax);
          const color = getStatusColor(status);
          const d = dayjs(r.date);

          return (
            <Row key={r.id} isFirst={index === 0} isLast={index === readings.length - 1}>
              <DateCol>
                <DateText>{d.format('D MMM YYYY')}</DateText>
                <Ago>Hace {today.diff(d, 'day')} días</Ago>
              </DateCol>
              <Vals>
                <Val>
                  <ValLabel>%</ValLabel>
                  <ValNum>{r.percentage != null ? Math.round(r.percentage) : '—'}</ValNum>
                </Val>
                <Val>
                  <ValLabel>RIN</ValLabel>
                  <ValNum style={{ color }}>{r.inr.toFixed(1)}</ValNum>
                </Val>
              </Vals>
              <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: color + '18' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color }}>{status}</Text>
              </View>
            </Row>
          );
        })}
      </Container>
    </Section>
  );
}
