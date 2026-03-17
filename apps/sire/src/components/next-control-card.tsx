import React from 'react';
import { View } from 'react-native';
import tw from 'styledwind-native';
import dayjs from 'dayjs';
import { CalendarCheck, CaretRight } from 'phosphor-react-native';

const Card = tw.View`
  flex-row
  items-center
  bg-[#53B3C6]
  rounded-xl
  p-4
  mb-2
  justify-between
  mx-4
  absolute
  bottom-0
  left-0
  right-0
  safe:mb
`;

const IconBox = tw.View`
  w-11
  h-11
  rounded-xl
  bg-white/20
  items-center
  justify-center
  mr-3
`;

const Title = tw.Text`
  text-sm
  font-bold
  text-white
`;

const DateLabel = tw.Text`
  text-[13px]
  text-white/80
  mt-0.5
`;

interface NextControlCardProps {
  nextControlDate: string;
}

export function NextControlCard({ nextControlDate }: NextControlCardProps) {
  return (
    <Card>
      <IconBox><CalendarCheck size={22} color="#fff" /></IconBox>
      <View style={{ flex: 1 }}>
        <Title>Próxima cita</Title>
        <DateLabel>{dayjs(nextControlDate).format('dddd D [de] MMMM')}</DateLabel>
      </View>
      <CaretRight size={24} color="#fff" />
    </Card>
  );
}
