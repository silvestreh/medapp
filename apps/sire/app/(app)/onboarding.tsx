import React, { useState, useCallback } from 'react';
import { ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import tw from 'styledwind-native';
import { BellRinging, Gauge, Baby } from 'phosphor-react-native';
import { setPostAuthOnboardingDone } from '../../src/preferences';
import {
  requestPermissions,
  setNotificationsEnabled,
  getExpoPushToken,
  configureNotificationHandler,
  setupAndroidChannel,
  setupNotificationCategories,
} from '../../src/notifications';
import { useAuth } from '../../src/contexts/auth-context';
import { usePreferences } from '../../src/contexts/preferences-context';

type Step = 'notifications' | 'mode';

const Container = tw.View`flex-1 bg-[#69C6D8]`;
const Content = tw.View`flex-1 justify-center items-center px-8`;
const IconCircle = tw.View`w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-8`;
const Title = tw.Text`text-2xl font-bold text-white text-center mb-3`;
const Desc = tw.Text`text-base text-white/80 text-center leading-6 mb-10`;
const PrimaryButton = tw.TouchableOpacity`bg-white rounded-2xl py-4 px-8 items-center w-full`;
const PrimaryButtonText = tw.Text`text-[#69C6D8] text-lg font-bold`;
const SecondaryButton = tw.TouchableOpacity`py-4 px-8 items-center mt-3`;
const SecondaryButtonText = tw.Text`text-white/70 text-base`;
const ModeCard = tw.TouchableOpacity`bg-white/20 rounded-2xl p-5 mb-4 flex-row items-center w-full`;
const ModeCardSelected = tw.TouchableOpacity`bg-white/40 rounded-2xl p-5 mb-4 flex-row items-center w-full border-2 border-white`;
const ModeIcon = tw.View`w-12 h-12 bg-white/30 rounded-full items-center justify-center mr-4`;
const ModeText = tw.View`flex-1`;
const ModeTitle = tw.Text`text-base font-semibold text-white mb-1`;
const ModeDesc = tw.Text`text-sm text-white/80 leading-5`;

export default function PostAuthOnboarding() {
  const [step, setStep] = useState<Step>('notifications');
  const [selectedMode, setSelectedMode] = useState<'normal' | 'simple'>('normal');
  const { apiClient } = useAuth();
  const { toggleSimpleMode } = usePreferences();

  const handleEnableNotifications = useCallback(async () => {
    configureNotificationHandler();
    await setupAndroidChannel();
    await setupNotificationCategories();

    const granted = await requestPermissions();
    if (granted) {
      await setNotificationsEnabled(true);

      const pushToken = await getExpoPushToken();
      if (pushToken) {
        try {
          await apiClient.service('sire-push-tokens').create({
            action: 'register',
            token: pushToken,
            platform: Platform.OS,
          });
        } catch (err) {
          console.warn('Failed to register push token:', err);
        }
      }
    }

    setStep('mode');
  }, [apiClient]);

  const handleSkipNotifications = useCallback(() => {
    setStep('mode');
  }, []);

  const handleSelectNormal = useCallback(() => {
    setSelectedMode('normal');
  }, []);

  const handleSelectSimple = useCallback(() => {
    setSelectedMode('simple');
  }, []);

  const handleFinish = useCallback(async () => {
    // If user picked simple and current is normal (default), toggle it
    if (selectedMode === 'simple') {
      toggleSimpleMode();
    }
    await setPostAuthOnboardingDone();
    router.replace('/(app)');
  }, [selectedMode, toggleSimpleMode]);

  return (
    <Container>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 'notifications' && (
          <Content>
            <IconCircle>
              <BellRinging size={48} color="#fff" weight="fill" />
            </IconCircle>
            <Title>Recordatorios de dosis</Title>
            <Desc>
              Sírë puede enviarte un recordatorio diario para que no te olvides de tomar tu
              medicación. Para eso necesitamos tu permiso para enviar notificaciones.
            </Desc>
            <PrimaryButton onPress={handleEnableNotifications}>
              <PrimaryButtonText>Activar notificaciones</PrimaryButtonText>
            </PrimaryButton>
            <SecondaryButton onPress={handleSkipNotifications}>
              <SecondaryButtonText>Ahora no</SecondaryButtonText>
            </SecondaryButton>
          </Content>
        )}

        {step === 'mode' && (
          <Content>
            <Title>Elegí tu modo</Title>
            <Desc>
              Podés cambiar esto en cualquier momento desde los ajustes.
            </Desc>

            {selectedMode === 'normal' && (
              <ModeCardSelected onPress={handleSelectNormal}>
                <ModeIcon>
                  <Gauge size={24} color="#fff" weight="fill" />
                </ModeIcon>
                <ModeText>
                  <ModeTitle>Normal</ModeTitle>
                  <ModeDesc>
                    Dosis del día, historial de lecturas, valores de laboratorio y próximo control.
                  </ModeDesc>
                </ModeText>
              </ModeCardSelected>
            )}

            {selectedMode !== 'normal' && (
              <ModeCard onPress={handleSelectNormal}>
                <ModeIcon>
                  <Gauge size={24} color="#fff" weight="fill" />
                </ModeIcon>
                <ModeText>
                  <ModeTitle>Normal</ModeTitle>
                  <ModeDesc>
                    Dosis del día, historial de lecturas, valores de laboratorio y próximo control.
                  </ModeDesc>
                </ModeText>
              </ModeCard>
            )}

            {selectedMode === 'simple' && (
              <ModeCardSelected onPress={handleSelectSimple}>
                <ModeIcon>
                  <Baby size={24} color="#fff" weight="fill" />
                </ModeIcon>
                <ModeText>
                  <ModeTitle>Simple</ModeTitle>
                  <ModeDesc>
                    Solo muestra la dosis de hoy en grande. Ideal si un familiar te ayuda con la
                    medicación.
                  </ModeDesc>
                </ModeText>
              </ModeCardSelected>
            )}

            {selectedMode !== 'simple' && (
              <ModeCard onPress={handleSelectSimple}>
                <ModeIcon>
                  <Baby size={24} color="#fff" weight="fill" />
                </ModeIcon>
                <ModeText>
                  <ModeTitle>Simple</ModeTitle>
                  <ModeDesc>
                    Solo muestra la dosis de hoy en grande. Ideal si un familiar te ayuda con la
                    medicación.
                  </ModeDesc>
                </ModeText>
              </ModeCard>
            )}

            <PrimaryButton onPress={handleFinish} style={{ marginTop: 24 }}>
              <PrimaryButtonText>Continuar</PrimaryButtonText>
            </PrimaryButton>
          </Content>
        )}
      </ScrollView>
    </Container>
  );
}
