import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import tw from 'styledwind-native';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { useAuth } from '../../src/contexts/auth-context';
import { getInrStatus, getStatusColor } from '../../src/constants';
import type { SireReading, SireTreatment } from '../../src/types';

dayjs.locale('es');

const Screen = tw.View`flex-1 bg-gray-100`;
const Header = tw.View`flex-row items-center justify-between pt-14 pb-2 px-1 bg-white border-b border-gray-200`;
const HeaderTitle = tw.Text`text-lg font-bold text-gray-900`;
const BackBtn = tw.TouchableOpacity`w-12 h-12 items-center justify-center`;
const BackArrow = tw.Text`text-2xl text-gray-900`;

const Row = tw.View`flex-row items-center bg-white rounded-xl py-3.5 px-4 mb-2`;
const DateCol = tw.View`flex-1`;
const DateText = tw.Text`text-sm font-semibold text-gray-900`;
const AgoText = tw.Text`text-xs text-gray-400 mt-0.5`;
const ValuesCol = tw.View`flex-row gap-4 mr-3`;
const ValItem = tw.View`items-center`;
const ValLabel = tw.Text`text-[10px] font-bold text-gray-300`;
const ValNum = tw.Text`text-base font-bold text-gray-900`;

const EmptyText = tw.Text`text-center text-gray-400 text-sm py-10`;

export default function HistoryScreen() {
  const { patient, apiClient } = useAuth();
  const [readings, setReadings] = useState<SireReading[]>([]);
  const [treatment, setTreatment] = useState<SireTreatment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!patient) return;
      try {
        const tRes = await apiClient.service('sire-treatments').find({
          query: { patientId: patient.id, status: 'active', $limit: 1 },
        });
        const ts = (tRes as any).data || tRes;
        const active = ts[0] || null;
        setTreatment(active);

        if (active) {
          const rRes = await apiClient.service('sire-readings').find({
            query: { treatmentId: active.id, $sort: { date: -1, createdAt: -1 }, $limit: 50 },
          });
          setReadings((rRes as any).data || rRes);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patient, apiClient]);

  const handleBack = useCallback(() => router.back(), []);

  const renderReading = useCallback(({ item }: { item: SireReading }) => {
    if (!treatment) return null;
    const status = getInrStatus(item.inr, treatment.targetInrMin, treatment.targetInrMax);
    const color = getStatusColor(status);
    const d = dayjs(item.date);
    const daysAgo = dayjs().diff(d, 'day');

    return (
      <Row>
        <DateCol>
          <DateText>{d.format('D MMM YYYY')}</DateText>
          <AgoText>Hace {daysAgo} días</AgoText>
        </DateCol>
        <ValuesCol>
          <ValItem>
            <ValLabel>%</ValLabel>
            <ValNum>{item.percentage != null ? Math.round(item.percentage) : '—'}</ValNum>
          </ValItem>
          <ValItem>
            <ValLabel>RIN</ValLabel>
            <ValNum style={{ color }}>{item.inr.toFixed(1)}</ValNum>
          </ValItem>
        </ValuesCol>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: color + '18' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color }}>{status}</Text>
        </View>
      </Row>
    );
  }, [treatment]);

  return (
    <Screen>
      <Header>
        <BackBtn onPress={handleBack}>
          <BackArrow>‹</BackArrow>
        </BackBtn>
        <HeaderTitle>Historial de lecturas</HeaderTitle>
        <View style={{ width: 48 }} />
      </Header>

      <FlatList
        data={readings}
        renderItem={renderReading}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <EmptyText>{loading ? 'Cargando...' : 'No hay lecturas registradas.'}</EmptyText>
        }
      />
    </Screen>
  );
}
