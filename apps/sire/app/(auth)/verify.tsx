import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import tw from 'styledwind-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';

import { useAuth } from '../../src/contexts/auth-context';

const CODE_LENGTH = 6;
const COUNTDOWN_SECONDS = 165;

const HeaderArea = tw.View`items-center pt-16 pb-8`;
const BackArrow = tw.Text`text-white text-2xl`;
const IconCircle = tw.View`w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-3`;
const IconEmoji = tw.Text`text-3xl`;
const HeaderTitle = tw.Text`text-xl font-bold text-white`;
const HeaderSub = tw.Text`text-sm text-white/80`;

const FormArea = tw.View`flex-1 bg-white rounded-t-3xl px-6 pt-8`;
const Title = tw.Text`text-lg font-bold text-gray-900 mb-2`;
const Desc = tw.Text`text-sm text-gray-500 leading-5`;
const Phone = tw.Text`text-base font-semibold text-gray-900 mb-6`;
const Label = tw.Text`text-xs font-semibold text-gray-400 mb-3 tracking-wider`;

const CountdownRow = tw.View`flex-row justify-between mb-4`;
const CountdownLabel = tw.Text`text-sm text-gray-400`;
const CountdownValue = tw.Text`text-sm text-[#53B3C6] font-semibold`;

const ErrorText = tw.Text`text-red-500 text-sm mb-2 text-center`;

type BtnTextProps = {
  disabled?: boolean;
};

const BtnText = tw.Text<BtnTextProps>`
  text-base
  font-semibold

  ${(p) => p.disabled ? tw`text-gray-400` : tw`text-white`}
`;

const ExpiryBox = tw.View`flex-row justify-center items-center mt-6 p-3 bg-gray-50 rounded-lg`;
const ExpiryText = tw.Text`text-xs text-gray-400`;

export default function VerifyScreen() {
  const { login, requestOtp } = useAuth();
  const params = useLocalSearchParams<{
    documentNumber: string;
    slug: string;
    maskedPhone: string;
  }>();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const inputRefs = useRef<(RNTextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  const handleCodeChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      const chars = value.replace(/\D/g, '').slice(0, CODE_LENGTH).split('');
      const newCode = [...code];
      chars.forEach((char, i) => {
        if (index + i < CODE_LENGTH) newCode[index + i] = char;
      });
      setCode(newCode);
      inputRefs.current[Math.min(index + chars.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, '');
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }, [code]);

  const handleKeyPress = useCallback((index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
    }
  }, [code]);

  const handleVerify = useCallback(async () => {
    const fullCode = code.join('');
    if (fullCode.length !== CODE_LENGTH) return;
    setLoading(true);
    setError('');
    try {
      await login(params.documentNumber, fullCode, params.slug);
      router.replace('/(app)');
    } catch {
      setError('Código inválido o expirado. Intentá de nuevo.');
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [code, login, params]);

  const handleResend = useCallback(async () => {
    if (countdown > 0) return;
    try {
      await requestOtp(params.documentNumber, params.slug);
      setCountdown(COUNTDOWN_SECONDS);
      setError('');
    } catch {
      setError('No se pudo reenviar el código.');
    }
  }, [countdown, requestOtp, params]);

  useEffect(() => {
    if (code.join('').length === CODE_LENGTH && !loading) {
      handleVerify();
    }
  }, [code, loading, handleVerify]);

  const isDisabled = loading || code.join('').length !== CODE_LENGTH;

  return (
    <KeyboardAvoidingView style={tw`flex-1 bg-[#69C6D8]`} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <HeaderArea>
        <Pressable onPress={() => router.back()} style={tw`absolute top-12 left-3 w-10 h-10 items-center justify-center`}>
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
        <IconCircle>
          <IconEmoji>✉</IconEmoji>
        </IconCircle>
        <HeaderTitle>Verificación</HeaderTitle>
        <HeaderSub>Sírë</HeaderSub>
      </HeaderArea>

      <FormArea>
        <Title>Código de verificación</Title>
        <Desc>Enviamos un código de 6 dígitos al número terminado en</Desc>
        <Phone>•••• {params.maskedPhone?.slice(-4)}</Phone>

        <Label>INGRESÁ EL CÓDIGO</Label>
        <View style={tw`flex-row justify-between mb-4`}>
          {Array(CODE_LENGTH).fill(null).map((_, index) => (
            <RNTextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              value={code[index]}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={(e) => handleKeyPress(index, e.nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={index === 0 ? CODE_LENGTH : 1}
              textContentType="oneTimeCode"
              autoFocus={index === 0}
              style={tw`w-12 h-14 border-2 rounded-xl text-center text-xl font-bold text-gray-900 leading-0 ${code[index] ? 'border-[#69C6D8] bg-[#EEF9FB]' : 'border-gray-200 bg-white'}`}
            />
          ))}
        </View>

        <CountdownRow>
          <CountdownLabel>Reenviar código en</CountdownLabel>
          <CountdownValue>{countdown > 0 ? formatCountdown(countdown) : ''}</CountdownValue>
        </CountdownRow>

        {!!error && <ErrorText>{error}</ErrorText>}

        <Pressable
          onPress={handleVerify}
          disabled={isDisabled}
          style={tw`rounded-xl py-4 items-center mb-4 ${isDisabled ? 'bg-gray-200' : 'bg-[#53B3C6]'}`}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <BtnText disabled={isDisabled}>Verificar código</BtnText>
          }
        </Pressable>

        <Pressable onPress={handleResend} disabled={countdown > 0}>
          <Text style={tw`text-center text-sm ${countdown > 0 ? 'text-gray-300' : 'text-[#53B3C6]'}`}>
            ¿No recibiste el código? Reenviarlo
          </Text>
        </Pressable>

        <ExpiryBox>
          <ExpiryText>Este código expira en <Text style={tw`font-bold`}>10 minutos</Text></ExpiryText>
        </ExpiryBox>
      </FormArea>
    </KeyboardAvoidingView>
  );
}
