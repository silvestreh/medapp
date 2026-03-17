import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, RefreshControl, AppState } from 'react-native';
import tw from 'styledwind-native';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { useAuth } from '../../src/contexts/auth-context';
import { HeaderBar } from '../../src/components/header-bar';
import { HeroSection } from '../../src/components/hero-section';
import { LabValues } from '../../src/components/lab-values';
import { ReadingHistory } from '../../src/components/reading-history';
import { NextControlCard } from '../../src/components/next-control-card';
import { useNotifications } from '../../src/hooks/use-notifications';
import { getSimpleMode } from '../../src/preferences';
import type { SireTreatment, SireReading, SireDoseSchedule, SireDoseLog } from '../../src/types';

dayjs.locale('es');

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

const Content = tw.View`pt-4`;
const EmptyBox = tw.View`items-center p-8 mt-10`;
const EmptyTitle = tw.Text`text-lg font-bold text-gray-900 mb-2`;
const EmptyText = tw.Text`text-sm text-gray-400 text-center leading-5`;

export default function DashboardScreen() {
  const { patient, apiClient } = useAuth();
  const [treatment, setTreatment] = useState<SireTreatment | null>(null);
  const [readings, setReadings] = useState<SireReading[]>([]);
  const [doseSchedule, setDoseSchedule] = useState<SireDoseSchedule | null>(null);
  const [todayLog, setTodayLog] = useState<SireDoseLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [simpleMode, setSimpleMode] = useState(false);

  const todayIndex = useMemo(() => {
    const jsDay = dayjs().day();
    return jsDay === 0 ? 6 : jsDay - 1;
  }, []);

  const todayDose = useMemo(() => {
    if (!doseSchedule) return null;
    return doseSchedule.schedule[DAY_KEYS[todayIndex]];
  }, [doseSchedule, todayIndex]);

  const latestReading = useMemo(() => readings[0] || null, [readings]);

  const loadData = useCallback(async () => {
    if (!patient) return;
    try {
      const tRes = await apiClient.service('sire-treatments').find({
        query: { patientId: patient.id, status: 'active', $limit: 1, $sort: { createdAt: -1 } },
      });
      const active = ((tRes as any).data || tRes)[0] || null;
      setTreatment(active);

      if (active) {
        const [rRes, sRes, lRes] = await Promise.all([
          apiClient.service('sire-readings').find({ query: { treatmentId: active.id, $sort: { date: -1, createdAt: -1 }, $limit: 10 } }),
          apiClient.service('sire-dose-schedules').find({ query: { treatmentId: active.id, $sort: { startDate: -1, createdAt: -1 }, $limit: 1 } }),
          apiClient.service('sire-dose-logs').find({ query: { treatmentId: active.id, date: dayjs().format('YYYY-MM-DD'), $limit: 1 } }),
        ]);
        setReadings((rRes as any).data || rRes);
        setDoseSchedule(((sRes as any).data || sRes)[0] || null);
        setTodayLog(((lRes as any).data || lRes)[0] || null);
      }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    }
  }, [patient, apiClient]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load simple mode preference on mount
  useEffect(() => { getSimpleMode().then(setSimpleMode); }, []);

  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        loadData();
        getSimpleMode().then(setSimpleMode);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleLogDose = useCallback(async (taken: boolean) => {
    if (!treatment || !patient) return;
    try {
      const today = dayjs().format('YYYY-MM-DD');
      if (todayLog) {
        await apiClient.service('sire-dose-logs').patch(todayLog.id, { taken });
        setTodayLog({ ...todayLog, taken });
      } else {
        const log = await apiClient.service('sire-dose-logs').create({
          treatmentId: treatment.id, patientId: patient.id, date: today, taken, expectedDose: todayDose,
        });
        setTodayLog(log as any);
      }
    } catch (e) {
      console.error('Failed to log dose:', e);
    }
  }, [treatment, patient, todayLog, todayDose, apiClient]);

  const handleDoseAction = useCallback((action: 'taken' | 'not-taken') => {
    handleLogDose(action === 'taken');
  }, [handleLogDose]);

  // Set up local notifications (scheduling + action handling)
  useNotifications(treatment, doseSchedule, handleDoseAction);

  const handleTaken = useCallback(() => handleLogDose(true), [handleLogDose]);
  const handleNotTaken = useCallback(() => handleLogDose(false), [handleLogDose]);
  const handleOpenSettings = useCallback(() => router.push('/(app)/settings'), []);
  const handleViewAll = useCallback(() => router.push('/(app)/history'), []);

  const greeting = useMemo(() => {
    const h = dayjs().hour();
    if (h < 12) return 'Buen día';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }, []);

  return (
    <>
      <View style={tw`bg-[#69C6D8]`}>
        <HeaderBar
          greeting={greeting}
          patientName={patient?.name || ''}
          onOpenSettings={handleOpenSettings}
        />
      </View>
      {simpleMode && (
        <HeroSection
          treatment={treatment}
          doseSchedule={doseSchedule}
          todayDose={todayDose}
          todayLog={todayLog}
          todayIndex={todayIndex}
          simpleMode
          onTaken={handleTaken}
          onNotTaken={handleNotTaken}
        />
      )}

      {!simpleMode && (
        <ScrollView
          style={tw`flex-1 bg-gray-50`}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
          alwaysBounceVertical
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />}
        >
          <HeroSection
            treatment={treatment}
            doseSchedule={doseSchedule}
            todayDose={todayDose}
            todayLog={todayLog}
            todayIndex={todayIndex}
            onTaken={handleTaken}
            onNotTaken={handleNotTaken}
          />

          <Content>
            {treatment && latestReading && (
              <LabValues
                percentage={latestReading.percentage}
                inr={latestReading.inr}
                targetInrMin={treatment.targetInrMin}
                targetInrMax={treatment.targetInrMax}
              />
            )}

            {treatment && readings.length > 0 && (
              <ReadingHistory
                readings={readings.slice(0, 5)}
                targetInrMin={treatment.targetInrMin}
                targetInrMax={treatment.targetInrMax}
                onViewAll={handleViewAll}
              />
            )}

            {!treatment && (
              <EmptyBox>
                <EmptyTitle>Sin tratamiento activo</EmptyTitle>
                <EmptyText>Tu médico aún no ha configurado un tratamiento de anticoagulación.</EmptyText>
              </EmptyBox>
            )}

            <View style={{ height: 40 }} />
          </Content>
        </ScrollView>
      )}

      {treatment?.nextControlDate && (
        <NextControlCard nextControlDate={treatment.nextControlDate} />
      )}
    </>
  );
}
