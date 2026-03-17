import React, { useCallback } from 'react';
import { ScrollView, Dimensions } from 'react-native';
import { router } from 'expo-router';
import tw from 'styledwind-native';
import { ChatCircleDots, Pill, ShieldCheck } from 'phosphor-react-native';
import { setPreAuthOnboardingDone } from '../../src/preferences';

const { width } = Dimensions.get('window');

const Container = tw.View`flex-1 bg-[#69C6D8]`;
const Content = tw.View`flex-1 justify-center items-center px-8`;
const Title = tw.Text`text-3xl font-bold text-white text-center mb-2`;
const Subtitle = tw.Text`text-base text-white/80 text-center mb-10 leading-6`;
const Card = tw.View`bg-white/20 rounded-2xl p-5 mb-4 flex-row items-center`;
const CardIcon = tw.View`w-12 h-12 bg-white/30 rounded-full items-center justify-center mr-4`;
const CardText = tw.View`flex-1`;
const CardTitle = tw.Text`text-base font-semibold text-white mb-1`;
const CardDesc = tw.Text`text-sm text-white/80 leading-5`;
const Button = tw.TouchableOpacity`bg-white rounded-2xl py-4 px-8 items-center mt-8`;
const ButtonText = tw.Text`text-[#69C6D8] text-lg font-bold`;

export default function PreAuthOnboarding() {
  const handleContinue = useCallback(async () => {
    await setPreAuthOnboardingDone();
    router.replace('/(auth)/login');
  }, []);

  return (
    <Container>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <Content>
          <Title>Bienvenido a Sírë</Title>
          <Subtitle>
            Tu asistente personal para el control de anticoagulación
          </Subtitle>

          <Card style={{ width: width - 64 }}>
            <CardIcon>
              <Pill size={24} color="#fff" weight="fill" />
            </CardIcon>
            <CardText>
              <CardTitle>Control de dosis</CardTitle>
              <CardDesc>
                Consultá tu dosis diaria de anticoagulante y registrá si la tomaste o no.
              </CardDesc>
            </CardText>
          </Card>

          <Card style={{ width: width - 64 }}>
            <CardIcon>
              <ShieldCheck size={24} color="#fff" weight="fill" />
            </CardIcon>
            <CardText>
              <CardTitle>Seguimiento seguro</CardTitle>
              <CardDesc>
                Tu médico actualiza tu tratamiento y vos lo ves reflejado al instante en la app.
              </CardDesc>
            </CardText>
          </Card>

          <Card style={{ width: width - 64 }}>
            <CardIcon>
              <ChatCircleDots size={24} color="#fff" weight="fill" />
            </CardIcon>
            <CardText>
              <CardTitle>Inicio de sesión fácil</CardTitle>
              <CardDesc>
                Para ingresar, vas a recibir un código por WhatsApp. No necesitás recordar contraseñas.
              </CardDesc>
            </CardText>
          </Card>

          <Button onPress={handleContinue}>
            <ButtonText>Comenzar</ButtonText>
          </Button>
        </Content>
      </ScrollView>
    </Container>
  );
}
