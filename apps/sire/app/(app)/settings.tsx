import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Pressable, Switch, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import tw from 'styledwind-native';
import { router } from 'expo-router';
import { Bell, Clock, ListDashes, SignOut } from 'phosphor-react-native';
import { useAuth } from '../../src/contexts/auth-context';
import { BottomSheet } from '../../src/components/bottom-sheet';
import {
  requestPermissions,
  getNotificationsEnabled,
  setNotificationsEnabled,
  getReminderTime,
  setReminderTime,
  cancelAllDoseReminders,
  scheduleDoseReminders,
} from '../../src/notifications';
import { usePreferences } from '../../src/contexts/preferences-context';
import type { SireTreatment, SireDoseSchedule } from '../../src/types';

const Title = tw.Text`text-lg font-bold text-gray-900 mb-4 px-6`;
const Row = tw.View`border-t border-gray-100 py-4 flex-row items-center px-6`;
const IconBox = tw.View`w-10 h-10 rounded-xl items-center justify-center mr-3`;
const RowTitle = tw.Text`text-base font-semibold text-gray-900`;
const RowSubtitle = tw.Text`text-sm text-gray-400`;
const LogoutText = tw.Text`text-base font-semibold text-red-500`;
const TimeText = tw.Text`text-base font-semibold text-[#52A8B9]`;

export default function SettingsScreen() {
  const { logout, apiClient, patient } = useAuth();
  const { simpleMode, toggleSimpleMode } = usePreferences();

  const [notifEnabled, setNotifEnabled] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [treatment, setTreatment] = useState<SireTreatment | null>(null);
  const [doseSchedule, setDoseSchedule] = useState<SireDoseSchedule | null>(null);

  // Load preferences and current treatment data
  useEffect(() => {
    async function load() {
      const [enabled, time] = await Promise.all([
        getNotificationsEnabled(),
        getReminderTime(),
      ]);
      setNotifEnabled(enabled);
      setHour(time.hour);
      setMinute(time.minute);

      if (patient && apiClient) {
        try {
          const tRes = await apiClient.service('sire-treatments').find({
            query: { patientId: patient.id, status: 'active', $limit: 1, $sort: { createdAt: -1 } },
          });
          const active = ((tRes as any).data || tRes)[0] || null;
          setTreatment(active);

          if (active) {
            const sRes = await apiClient.service('sire-dose-schedules').find({
              query: { treatmentId: active.id, $sort: { startDate: -1, createdAt: -1 }, $limit: 1 },
            });
            setDoseSchedule(((sRes as any).data || sRes)[0] || null);
          }
        } catch (e) {
          console.error('Settings: failed to load treatment:', e);
        }
      }
    }
    load();
  }, [patient, apiClient]);

  const reschedule = useCallback(async (h: number, m: number) => {
    if (!treatment || !doseSchedule) return;
    await scheduleDoseReminders(doseSchedule.schedule, treatment.medication, h, m);
  }, [treatment, doseSchedule]);

  const handleToggle = useCallback(async () => {
    if (!notifEnabled) {
      const granted = await requestPermissions();
      if (!granted) return;
      await setNotificationsEnabled(true);
      setNotifEnabled(true);
      await reschedule(hour, minute);
    } else {
      await setNotificationsEnabled(false);
      await cancelAllDoseReminders();
      setNotifEnabled(false);
    }
  }, [notifEnabled, hour, minute, reschedule]);

  const handleTimeChange = useCallback(async (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!date) return;
    const h = date.getHours();
    const m = date.getMinutes();
    setHour(h);
    setMinute(m);
    await setReminderTime(h, m);
    if (notifEnabled) {
      await reschedule(h, m);
    }
  }, [notifEnabled, reschedule]);

  const handleShowTimePicker = useCallback(() => {
    setShowTimePicker(true);
  }, []);

  const handleDismissTimePicker = useCallback(() => {
    setShowTimePicker(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/(auth)/login');
  }, [logout]);

  const timeLabel = useMemo(() => {
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `${hh}:${mm}`;
  }, [hour, minute]);

  const pickerDate = useMemo(() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [hour, minute]);

  return (
    <BottomSheet>
      <Title>Configuración</Title>

      <Row>
        <IconBox style={tw`bg-amber-100`}>
          <Bell size={20} color="#F59E0B" />
        </IconBox>
        <View style={tw`flex-1`}>
          <RowTitle>Activar notificaciones</RowTitle>
          <RowSubtitle>Recordatorios de dosis y citas</RowSubtitle>
        </View>
        <Switch
          value={notifEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#E0E0E0', true: '#69C6D8' }}
          thumbColor="#fff"
        />
      </Row>

      {notifEnabled && (
        <Pressable onPress={handleShowTimePicker}>
          <Row>
            <IconBox style={tw`bg-teal-100`}>
              <Clock size={20} color="#52A8B9" />
            </IconBox>
            <View style={tw`flex-1`}>
              <RowTitle>Hora del recordatorio</RowTitle>
              <RowSubtitle>Te notificaremos todos los días a esta hora</RowSubtitle>
            </View>
            <TimeText>{timeLabel}</TimeText>
          </Row>
        </Pressable>
      )}

      {showTimePicker && (
        <View style={tw`px-6 pb-4`}>
          <DateTimePicker
            value={pickerDate}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            locale="es-AR"
          />
          {Platform.OS === 'ios' && (
            <Pressable onPress={handleDismissTimePicker} style={tw`items-center pt-2`}>
              <TimeText>Listo</TimeText>
            </Pressable>
          )}
        </View>
      )}

      <Row>
        <IconBox style={tw`bg-blue-100`}>
          <ListDashes size={20} color="#3B82F6" />
        </IconBox>
        <View style={tw`flex-1`}>
          <RowTitle>Modo simple</RowTitle>
          <RowSubtitle>Solo muestra la dosis y la próxima cita</RowSubtitle>
        </View>
        <Switch
          value={simpleMode}
          onValueChange={toggleSimpleMode}
          trackColor={{ false: '#E0E0E0', true: '#69C6D8' }}
          thumbColor="#fff"
        />
      </Row>

      <View style={tw`border-t border-gray-100 pt-4 px-6`}>
        <Pressable onPress={handleLogout} style={tw`flex-row items-center`}>
          <IconBox style={tw`bg-red-100`}>
            <SignOut size={20} color="#EF4444" />
          </IconBox>
          <LogoutText>Cerrar sesión</LogoutText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
