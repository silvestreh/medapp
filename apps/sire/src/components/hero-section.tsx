import React, { useCallback } from 'react';
import tw from 'styledwind-native';
import dayjs from 'dayjs';
import { Check, X } from 'phosphor-react-native';

import { doseToFraction } from '../constants';
import type { SireTreatment, SireDoseSchedule, SireDoseLog } from '../types';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const Hero = tw.View`
  bg-[#69C6D8]
  pb-5
  rounded-b-2xl
`;

const Filler = tw.View`
  bg-teal-400
  absolute
  -top-96
  left-0
  right-0
  h-96
`;

const DoseLabel = tw.Text`
  text-center
  text-[11px]
  font-semibold
  text-white/65
  tracking-widest
  mt-4
`;

const DoseBig = tw.Text`
  text-center
  text-7xl
  font-bold
  text-white
  leading-tight
`;

const DoseUnit = tw.Text`
  text-center
  text-lg
  text-white/85
  -mt-1
`;

const MedLabel = tw.Text`
  text-center
  text-sm
  text-white/75
  mt-1
`;

const ActionRow = tw.View`
  flex-row
  justify-center
  gap-3
  mt-5
  px-5
`;

type ActionBtnProps = {
  pressed: boolean;
}

const ActionBtn = tw.TouchableOpacity<ActionBtnProps>`
  flex-1
  py-3.5
  rounded-full
  border-2
  border-white
  items-center
  flex-row
  justify-center
  gap-2

  ${({ pressed }) => pressed && tw`bg-white`}
`;

const ActionText = tw.Text<ActionBtnProps>`
  text-[15px]
  font-semibold
  text-white

  ${({ pressed }) => pressed && tw`text-[#53B3C6]`}
`;

const WeekRow = tw.View`
  flex-row
  mt-5
  mx-4
  gap-2
  overflow-hidden
`;

type DayCellProps = {
  isToday: boolean;
};

const DayCell = tw.View<DayCellProps>`
  flex-1
  items-center
  py-2.5
  rounded-lg
  bg-white/20

  ${({ isToday }) => isToday && tw`
    bg-white
  `}
`;

const DayLabelText = tw.Text<DayCellProps>`
  text-xs
  font-semibold
  text-white/65
  mb-0.5

  ${({ isToday }) => isToday && tw`
    text-cyan-600
  `}
`;

const DayDoseText = tw.Text<DayCellProps>`
  text-lg
  font-bold
  text-white/80

  ${({ isToday }) => isToday && tw`text-cyan-600`}
`;

// -- Simple mode (grandma mode) --

const SimpleHero = tw.View`flex-1 bg-[#69C6D8] justify-center pb-10`;
const SimpleDoseLabel = tw.Text`text-center text-lg font-semibold text-white/65 tracking-widest`;
const SimpleDoseBig = tw.Text`text-center font-bold text-white`;
const SimpleDoseUnit = tw.Text`text-center text-[32px] text-white/85`;
const SimpleMedLabel = tw.Text`text-center text-2xl text-white/75 mt-1`;
const SimpleActionCol = tw.View`mt-10 px-8 gap-4`;
const SimpleActionBtn = tw.TouchableOpacity`rounded-full border-3 border-white py-5 flex-row items-center justify-center gap-3`;
const SimpleActionBtnText = tw.Text`text-2xl font-semibold text-white`;

interface HeroSectionProps {
  treatment: SireTreatment | null;
  doseSchedule: SireDoseSchedule | null;
  todayDose: number | null;
  todayLog: SireDoseLog | null;
  todayIndex: number;
  simpleMode?: boolean;
  onTaken: () => void;
  onNotTaken: () => void;
}

export function HeroSection({
  treatment,
  doseSchedule,
  todayDose,
  todayLog,
  todayIndex,
  simpleMode,
  onTaken,
  onNotTaken,
}: HeroSectionProps) {
  const today = dayjs();

  const handleActionButtonPress = useCallback((taken: boolean) => () => {
    if (taken) {
      onTaken();
    } else {
      onNotTaken();
    }
  }, [onTaken, onNotTaken]);

  if (simpleMode) {
    const takenActive = todayLog?.taken === true;
    const notTakenActive = todayLog?.taken === false;
    return (
      <SimpleHero>
        {treatment && doseSchedule && (
          <>
            <SimpleDoseLabel>
              DOSIS DE HOY · {today.format('dddd D MMM').toUpperCase()}
            </SimpleDoseLabel>
            <SimpleDoseBig style={{ fontSize: 180, lineHeight: 195 }}>
              {doseToFraction(todayDose)}
            </SimpleDoseBig>
            <SimpleDoseUnit>comprimido</SimpleDoseUnit>
            <SimpleMedLabel>
              {treatment.medication} {treatment.tabletDoseMg} mg
            </SimpleMedLabel>

            <SimpleActionCol>
              <SimpleActionBtn onPress={handleActionButtonPress(true)}
                style={takenActive ? tw`bg-white` : undefined}>
                <Check size={32} color={takenActive ? '#53B3C6' : '#fff'} />
                <SimpleActionBtnText style={takenActive ? tw`text-[#53B3C6]` : undefined}>
                  Tomado
                </SimpleActionBtnText>
              </SimpleActionBtn>
              <SimpleActionBtn onPress={handleActionButtonPress(false)}
                style={notTakenActive ? tw`bg-white` : undefined}>
                <X size={32} color={notTakenActive ? '#53B3C6' : '#fff'} />
                <SimpleActionBtnText style={notTakenActive ? tw`text-[#53B3C6]` : undefined}>
                  No tomado
                </SimpleActionBtnText>
              </SimpleActionBtn>
            </SimpleActionCol>
          </>
        )}
      </SimpleHero>
    );
  }

  return (
    <Hero>
      <Filler />
      {treatment && doseSchedule && (
        <>
          <DoseLabel>
            DOSIS DE HOY · {today.format('dddd D MMM').toUpperCase()}
          </DoseLabel>
          <DoseBig>{doseToFraction(todayDose)}</DoseBig>
          <DoseUnit>comprimido</DoseUnit>
          <MedLabel>{treatment.medication} {treatment.tabletDoseMg} mg</MedLabel>

          <ActionRow>
            <ActionBtn onPress={handleActionButtonPress(true)} pressed={todayLog?.taken === true}>
              <Check size={20} color={todayLog?.taken === true ? "#53B3C6" : "#fff"} />
              <ActionText pressed={todayLog?.taken === true}>Tomado</ActionText>
            </ActionBtn>
            <ActionBtn onPress={handleActionButtonPress(false)} pressed={todayLog?.taken === false}>
              <X size={20} color={todayLog?.taken === false ? "#53B3C6" : "#fff"} />
              <ActionText pressed={todayLog?.taken === false}>No tomado</ActionText>
            </ActionBtn>
          </ActionRow>

          <WeekRow>
            {DAY_KEYS.map((key, i) => {
              const isToday = i === todayIndex;
              return (
                <DayCell key={key} isToday={isToday}>
                  <DayLabelText isToday={isToday}>{DAY_LABELS[i]}</DayLabelText>
                  <DayDoseText isToday={isToday}>{doseToFraction(doseSchedule.schedule[key])}</DayDoseText>
                </DayCell>
              );
            })}
          </WeekRow>
        </>
      )}
    </Hero>
  );
}
