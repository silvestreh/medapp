import React from 'react';
import { View } from 'react-native';
import tw from 'styledwind-native';
import { Gear } from 'phosphor-react-native';

const Row = tw.View`
  flex-row
  justify-between
  items-center
  safe:pt
  px-5
  pb-2
  border-b
  border-b-teal-300
`;

const Greeting = tw.Text`
  text-sm
  text-white/80
`;

const Name = tw.Text`
  text-2xl
  font-bold
  text-white
`;

const SettingsBtn = tw.TouchableOpacity`
  w-10
  h-10
  rounded-full
  bg-white/20
  items-center
  justify-center
`;

interface HeaderBarProps {
  greeting: string;
  patientName: string;
  onOpenSettings: () => void;
}

export function HeaderBar({ greeting, patientName, onOpenSettings }: HeaderBarProps) {
  return (
    <Row>
      <View>
        <Greeting>{greeting},</Greeting>
        <Name>{patientName}</Name>
      </View>
      <SettingsBtn onPress={onOpenSettings}>
        <Gear size={22} color="#fff" />
      </SettingsBtn>
    </Row>
  );
}
