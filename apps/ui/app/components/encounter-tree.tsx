import { type FC, useCallback } from 'react';
import { Accordion, Text, Stack } from '@mantine/core';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';
import { useTranslation } from 'react-i18next';

import { styled } from '~/styled-system/jsx';

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
  onFormClick?: (encounter: Encounter, formKey: string) => void;
  activeEncounterId?: string;
  activeFormKey?: string;
}

const StyledAccordion = styled(Accordion, {
  base: {
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
  },
});

const YearText = styled(Text, {
  base: {
    fontWeight: 600,
    fontSize: '1.125rem',
    color: 'var(--mantine-color-blue-6)',
  },
});

const MonthText = styled(Text, {
  base: {
    fontWeight: 400,
    fontSize: '1rem',
    color: 'var(--mantine-color-blue-4)',
    textTransform: 'capitalize',
  },
});

const EncounterBox = styled('div', {
  base: {
    padding: '1rem',
    paddingBottom: 0,
    cursor: 'pointer',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
  },

  variants: {
    active: {
      true: {
        backgroundColor: 'var(--mantine-color-blue-0)',
      },
    },
  },
});

const EncounterDateText = styled(Text, {
  base: {
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--mantine-color-gray-7)',
    marginBottom: '1rem',
    cursor: 'default',
  },
});

const FormItem = styled('div', {
  base: {
    cursor: 'pointer',
    color: 'var(--mantine-color-blue-6)',
    fontSize: 'var(--mantine-font-size-md)',
    padding: '1rem',
    marginLeft: '-1rem',
    width: 'calc(100% + 2rem)',

    '&:hover': {
      backgroundColor: 'var(--mantine-color-blue-0)',
    },
  },

  variants: {
    active: {
      true: {
        backgroundColor: 'var(--mantine-color-blue-4)',
        color: 'white',

        '&:hover': {
          backgroundColor: 'var(--mantine-color-blue-4)',
        },
      },
    },
  },
});

const EncounterTree: FC<EncounterTreeProps> = ({ encounters, activeEncounterId, activeFormKey, onFormClick }) => {
  const { t } = useTranslation();

  const handleFormItemClick = useCallback(
    (e: React.MouseEvent, encounter: Encounter, key: string) => {
      e.stopPropagation();
      onFormClick?.(encounter, key);
    },
    [onFormClick]
  );

  // Group encounters by Year -> Month using lodash
  const groupedEncounters = mapValues(
    groupBy(encounters, encounter => dayjs(encounter.date).format('YYYY')),
    yearEncounters => groupBy(yearEncounters, encounter => dayjs(encounter.date).format('MMMM, YYYY'))
  );

  const years = Object.keys(groupedEncounters).sort((a, b) => b.localeCompare(a));

  return (
    <StyledAccordion variant="default" multiple>
      {years.map(year => (
        <Accordion.Item key={year} value={year}>
          <Accordion.Control>
            <YearText>{year}</YearText>
          </Accordion.Control>
          <Accordion.Panel>
            <StyledAccordion variant="default" multiple>
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
                            <EncounterBox
                              key={encounter.id}
                              active={activeEncounterId === encounter.id && !activeFormKey}
                            >
                              <EncounterDateText as="div">
                                {dayjs(encounter.date).format('dddd D, HH:mm')}
                              </EncounterDateText>
                              {encounter.data &&
                                Object.keys(encounter.data).map(key => (
                                  <FormItem
                                    key={key}
                                    onClick={e => handleFormItemClick(e, encounter, key)}
                                    active={activeEncounterId === encounter.id && activeFormKey === key}
                                  >
                                    {t(`forms.${encounter.data[key].type}` as any)}
                                  </FormItem>
                                ))}
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
