import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import tw from 'styledwind-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/contexts/auth-context';
import { listOrganizations } from '../../src/api/auth';

const Header = tw.View`items-center pt-20 pb-10`;
const LogoCircle = tw.View`w-20 h-20 rounded-full bg-white items-center justify-center mb-3`;
const LogoText = tw.Text`text-3xl font-bold text-[#53B3C6]`;
const AppName = tw.Text`text-2xl font-semibold text-white mb-1`;
const Subtitle = tw.Text`text-sm text-white/90`;

const FormArea = tw.View`flex-1 bg-white rounded-t-3xl px-6 pt-8`;
const Title = tw.Text`text-xl font-bold text-gray-900 mb-2`;
const Description = tw.Text`text-sm text-gray-500 mb-6 leading-5`;
const Label = tw.Text`text-xs font-semibold text-gray-400 mb-2 tracking-wider`;
const Input = tw.TextInput`border border-gray-200 rounded-xl px-4 text-base text-gray-900 mb-4 leading-0 py-4`;
const ErrorText = tw.Text`text-red-500 text-sm mb-2`;
const HelpLink = tw.Text`text-center text-[#53B3C6] mt-4 text-sm`;
const Terms = tw.Text`text-center text-gray-400 text-xs mt-6 leading-4`;

type OrgChipTextProps = {
  selected?: boolean;
};

const OrgChipText = tw.Text<OrgChipTextProps>`
  text-sm
  font-medium

  ${(p) => p.selected ? tw`text-white` : tw`text-gray-600`}
`;

type BtnTextProps = {
  disabled?: boolean;
};

const BtnText = tw.Text<BtnTextProps>`
  text-base
  font-semibold

  ${(p) => p.disabled ? tw`text-gray-400` : tw`text-white`}
`;

export default function LoginScreen() {
  const { requestOtp } = useAuth();
  const [documentNumber, setDocumentNumber] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadOrgs() {
      try {
        const orgs = await listOrganizations();
        setOrganizations(orgs);
        if (orgs.length === 1) setSelectedOrg(orgs[0]);
      } catch (e) {
        console.error('Failed to load organizations:', e);
      }
    }
    loadOrgs();
  }, []);

  const handleContinue = useCallback(async () => {
    if (!documentNumber.trim() || !selectedOrg) return;
    setLoading(true);
    setError('');

    try {
      const result = await requestOtp(documentNumber.trim(), selectedOrg.slug);

      if (result.status === 'otp_sent') {
        router.push({
          pathname: '/(auth)/verify',
          params: {
            documentNumber: documentNumber.trim(),
            slug: selectedOrg.slug,
            maskedPhone: result.maskedPhone,
          },
        });
      } else if (result.status === 'not_found') {
        setError('No se encontró un paciente con ese documento.');
      } else if (result.status === 'no_phone') {
        setError('No hay un número de teléfono asociado. Contactá a tu médico.');
      } else if (result.status === 'rate_limited') {
        setError('Demasiados intentos. Esperá unos minutos.');
      }
    } catch {
      setError('Error al enviar el código. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [documentNumber, selectedOrg, requestOtp]);

  const isDisabled = loading || !documentNumber.trim() || !selectedOrg;

  return (
    <KeyboardAvoidingView style={tw`flex-1 bg-[#69C6D8]`} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Header>
          <LogoCircle>
            <LogoText>S</LogoText>
          </LogoCircle>
          <AppName>Sírë</AppName>
          <Subtitle>Gestión de anticoagulación</Subtitle>
        </Header>

        <FormArea>
          <Title>Ingresá tu documento</Title>
          <Description>
            Te enviaremos un código de verificación por SMS al número asociado a tu DNI.
          </Description>

          {organizations.length > 1 && (
            <View style={{ marginBottom: 16 }}>
              <Label>CENTRO DE SALUD</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {organizations.map((org) => {
                  const selected = selectedOrg?.id === org.id;
                  return (
                    <Pressable
                      key={org.id}
                      onPress={() => setSelectedOrg(org)}
                      style={tw`px-4 py-2 rounded-full mr-2 border ${selected ? 'bg-[#53B3C6] border-[#53B3C6]' : 'bg-white border-gray-200'}`}
                    >
                      <OrgChipText selected={selected}>{org.name}</OrgChipText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Label>NÚMERO DE DOCUMENTO</Label>
          <Input
            value={documentNumber}
            onChangeText={setDocumentNumber}
            placeholder="Ej: 12.345.678"
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            placeholderTextColor="#aaa"
          />

          {!!error && <ErrorText>{error}</ErrorText>}

          <Pressable
            onPress={handleContinue}
            disabled={isDisabled}
            style={tw`mt-2 rounded-xl py-4 items-center ${isDisabled ? 'bg-gray-200' : 'bg-[#53B3C6]'}`}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <BtnText disabled={isDisabled}>Continuar</BtnText>
            }
          </Pressable>

          <HelpLink>¿No tenés acceso? Contactá a tu médico</HelpLink>
          <Terms>
            Al continuar aceptás los Términos y Condiciones y la Política de Privacidad de Athelas.
          </Terms>
        </FormArea>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
