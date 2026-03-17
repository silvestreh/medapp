import React from 'react';
import { View } from 'react-native';
import tw from 'styledwind-native';
import dayjs from 'dayjs';
import { CalendarCheck, CaretRight } from 'phosphor-react-native';
import { BlurView } from 'expo-blur';

const Card = tw.View`
  flex-row
  items-center
  rounded-2xl
  p-4
  justify-between
  bg-cyan-400/10
  border
  border-cyan-400/10
`;

const IconBox = tw.View`
  w-11
  h-11
  rounded-xl
  bg-white/40
  items-center
  justify-center
  mr-3
`;

const Title = tw.Text`
  text-sm
  font-bold
  text-cyan-950
`;

const DateLabel = tw.Text`
  text-[13px]
  text-cyan-800
  mt-0.5
`;

interface NextControlCardProps {
  nextControlDate: string;
}

export function NextControlCard({ nextControlDate }: NextControlCardProps) {
  return (
    <BlurView intensity={100} style={tw`absolute bottom-8 left-0 right-0 mx-4 rounded-2xl overflow-hidden`}>
      <Card>
        <IconBox><CalendarCheck size={22} color="#265D6A" /></IconBox>
        <View style={{ flex: 1 }}>
          <Title>Próxima cita</Title>
          <DateLabel>{dayjs(nextControlDate).format('dddd D [de] MMMM')}</DateLabel>
        </View>
        <CaretRight size={24} color="#265D6A" />
      </Card>
    </BlurView>
  );
}
