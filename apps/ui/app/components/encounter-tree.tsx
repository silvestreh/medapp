import { type FC } from 'react';
import { Accordion, Text, Stack } from '@mantine/core';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';
import { styled } from '~/stitches';

dayjs.locale('es');

interface Encounter {
  id: string;
  date: string;
  reason?: string;
  [key: string]: any;
}

interface EncounterTreeProps {
  encounters: Encounter[];
  onEncounterClick?: (encounter: Encounter) => void;
}

const StyledAccordion = styled(Accordion, {
  position: 'sticky',
  top: 0,
  width: '100%',

  '& .mantine-Accordion-item': {
    border: 'none',

    '& + &': {
      borderTop: '1px solid var(--mantine-color-gray-1)',
    },

    '&[data-active="true"]': {
      backgroundColor: '#FAFBFB',
    },
  },
  '& .mantine-Accordion-control': {
    padding: '1em',

    '&:hover': {
      backgroundColor: 'transparent',
    },
  },
  '& .mantine-Accordion-label': {
    padding: 0,
  },
  '& .mantine-Accordion-content': {
    padding: 0,
  },
  '& .mantine-Accordion-chevron': {
    color: 'var(--mantine-color-blue-6)',
  },
});

const YearText = styled(Text, {
  fontWeight: 600,
  fontSize: '1.125rem', // lg
  color: 'var(--mantine-color-blue-6)', // blue.6
});

const MonthText = styled(Text, {
  fontWeight: 400,
  fontSize: '1rem', // md
  color: 'var(--mantine-color-blue-4)', // blue.4
  textTransform: 'capitalize',
});

const EncounterBox = styled('div', {
  padding: '1rem', // md
  cursor: 'pointer',
  borderBottom: '1px solid #f1f3f5',
});

const EncounterDateText = styled(Text, {
  fontWeight: 600,
  fontSize: '1rem', // md
  color: 'var(--mantine-color-gray-7)', // gray.7
  marginBottom: '1rem',
});

// const EncounterDetailText = styled(Text, {
//   fontSize: '0.875rem', // sm
//   color: 'var(--mantine-color-gray-5)', // gray.5
// });

const EncounterTree: FC<EncounterTreeProps> = ({ encounters, onEncounterClick }) => {
  // Group encounters by Year -> Month using lodash
  const groupedEncounters = mapValues(
    groupBy(encounters, encounter => dayjs(encounter.date).format('YYYY')),
    yearEncounters => groupBy(yearEncounters, encounter => dayjs(encounter.date).format('MMMM, YYYY'))
  );

  const years = Object.keys(groupedEncounters).sort((a, b) => b.localeCompare(a));

  return (
    <StyledAccordion variant="default">
      {years.map(year => (
        <Accordion.Item key={year} value={year}>
          <Accordion.Control>
            <YearText>{year}</YearText>
          </Accordion.Control>
          <Accordion.Panel>
            <StyledAccordion variant="default">
              {Object.keys(groupedEncounters[year])
                .sort((a, b) => {
                  // Sort months chronologically (newest first)
                  return dayjs(b, 'MMMM, YYYY', 'es').valueOf() - dayjs(a, 'MMMM, YYYY', 'es').valueOf();
                })
                .map(monthYear => (
                  <Accordion.Item key={monthYear} value={monthYear}>
                    <Accordion.Control>
                      <MonthText>{monthYear}</MonthText>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={0}>
                        {groupedEncounters[year][monthYear]
                          .sort((a: Encounter, b: Encounter) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
                          .map((encounter: Encounter) => (
                            <EncounterBox key={encounter.id} onClick={() => onEncounterClick?.(encounter)}>
                              <EncounterDateText>{dayjs(encounter.date).format('dddd D, HH:mm')}</EncounterDateText>
                              {/* <Stack gap={12}>
                                {encounter.reason && <EncounterDetailText>{encounter.reason}</EncounterDetailText>}
                                {encounter.motivo && (
                                  <EncounterDetailText>Motivo de consulta-internación</EncounterDetailText>
                                )}
                                {encounter.antecedentes && (
                                  <EncounterDetailText>Antecedentes Personales</EncounterDetailText>
                                )}
                                {encounter.evolucion && (
                                  <EncounterDetailText>Evolución/evaluación de consulta-inte...</EncounterDetailText>
                                )}
                                {!encounter.motivo &&
                                  !encounter.antecedentes &&
                                  !encounter.evolucion &&
                                  !encounter.reason && (
                                    <EncounterDetailText>Evolución/evaluación de consulta-inte...</EncounterDetailText>
                                  )}
                              </Stack> */}
                            </EncounterBox>
                          ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
            </StyledAccordion>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </StyledAccordion>
  );
};

export default EncounterTree;
