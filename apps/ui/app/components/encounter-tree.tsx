import { type FC, useCallback, useMemo } from 'react';
import { Accordion, Text, Stack } from '@mantine/core';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import groupBy from 'lodash/groupBy';
import omit from 'lodash/omit';
import mapValues from 'lodash/mapValues';
import { useTranslation } from 'react-i18next';

import { styled } from '~/styled-system/jsx';
import { studySchemas } from '~/components/forms/study-schemas';

dayjs.locale('es');

interface Encounter {
  id: string;
  date: string;
  reason?: string;
  [key: string]: any;
}

interface Study {
  id: string;
  date: string;
  protocol: number;
  studies: Record<string, boolean>;
  results?: Array<{ id?: string; type: string; data: any }>;
  [key: string]: any;
}

/** A unified timeline entry that can be either an encounter or a study. */
export type TimelineEntry =
  | { kind: 'encounter'; date: string; data: Encounter }
  | { kind: 'study'; date: string; data: Study };

interface EncounterTreeProps {
  encounters: Encounter[];
  studies?: Study[];
  onEncounterClick?: (encounter: Encounter) => void;
  onFormClick?: (encounter: Encounter, formKey: string) => void;
  onStudyClick?: (study: Study) => void;
  activeEncounterId?: string;
  activeFormKey?: string;
  activeStudyId?: string;
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

const StudyBadge = styled('span', {
  base: {
    display: 'inline-block',
    fontSize: 'var(--mantine-font-size-xs)',
    color: 'var(--mantine-color-teal-6)',
    backgroundColor: 'var(--mantine-color-teal-0)',
    borderRadius: 'var(--mantine-radius-sm)',
    padding: '0 0.4rem',
    marginLeft: '0.5rem',
    fontWeight: 600,
    lineHeight: 1.6,
    verticalAlign: 'middle',
  },
});

const EncounterTree: FC<EncounterTreeProps> = ({
  encounters,
  studies = [],
  activeEncounterId,
  activeFormKey,
  activeStudyId,
  onFormClick,
  onStudyClick,
}) => {
  const { t } = useTranslation();

  const handleFormItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, encounter: Encounter, key: string) => {
      e.stopPropagation();
      console.log(JSON.stringify(omit(encounter.data[key], '__class'), null, 2));
      onFormClick?.(encounter, key);
    },
    [onFormClick]
  );

  const handleStudyClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, study: Study) => {
      e.stopPropagation();
      onStudyClick?.(study);
    },
    [onStudyClick],
  );

  // Merge encounters and studies into a unified timeline, filtering out empty studies
  const timeline: TimelineEntry[] = useMemo(() => {
    const nonEmptyStudies = studies.filter((study) => {
      if (!study.results || study.results.length === 0) return false;
      return study.results.some((result) => {
        if (!result.data || typeof result.data !== 'object') return false;
        return Object.values(result.data).some((v) => {
          if (v === null || v === undefined || v === '') return false;
          if (typeof v === 'object' && 'value' in v) return !!v.value;
          return true;
        });
      });
    });

    const entries: TimelineEntry[] = [
      ...encounters.map((enc): TimelineEntry => ({ kind: 'encounter', date: enc.date, data: enc })),
      ...nonEmptyStudies.map((study): TimelineEntry => ({ kind: 'study', date: study.date, data: study })),
    ];
    return entries;
  }, [encounters, studies]);

  // Group timeline entries by Year -> Month
  const groupedEntries = mapValues(
    groupBy(timeline, entry => dayjs(entry.date).format('YYYY')),
    yearEntries => groupBy(yearEntries, entry => dayjs(entry.date).format('MMMM, YYYY'))
  );

  const years = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  return (
    <StyledAccordion variant="default" multiple>
      {years.map(year => (
        <Accordion.Item key={year} value={year}>
          <Accordion.Control>
            <YearText>{year}</YearText>
          </Accordion.Control>
          <Accordion.Panel>
            <StyledAccordion variant="default" multiple>
              {Object.keys(groupedEntries[year])
                .sort((a, b) => {
                  return dayjs(b, 'MMMM, YYYY', 'es').valueOf() - dayjs(a, 'MMMM, YYYY', 'es').valueOf();
                })
                .map(monthYear => (
                  <Accordion.Item key={monthYear} value={monthYear}>
                    <Accordion.Control>
                      <MonthText>{monthYear}</MonthText>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={0}>
                        {groupedEntries[year][monthYear]
                          .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
                          .map((entry) => {
                            if (entry.kind === 'encounter') {
                              const encounter = entry.data;
                              return (
                                <EncounterBox
                                  key={`enc-${encounter.id}`}
                                  active={activeEncounterId === encounter.id && !activeFormKey}
                                >
                                  <EncounterDateText>
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
                              );
                            }

                            // Study entry — single clickable item
                            const study = entry.data;
                            const studyTypes = study.results
                              ? study.results.map((r) => studySchemas[r.type]?.label ?? r.type)
                              : Object.keys(study.studies ?? {})
                                  .filter((k) => study.studies[k])
                                  .map((k) => studySchemas[k]?.label ?? k);

                            return (
                              <EncounterBox
                                key={`study-${study.id}`}
                                active={activeStudyId === study.id}
                              >
                                <EncounterDateText>
                                  {dayjs(study.date).format('dddd D, HH:mm')}
                                </EncounterDateText>
                                <FormItem
                                  onClick={e => handleStudyClick(e, study)}
                                  active={activeStudyId === study.id}
                                >
                                  Protocolo #{study.protocol}
                                  <Text size="xs" c={activeStudyId === study.id ? 'white' : 'gray.5'} mt={2}>
                                    {studyTypes.join(', ')}
                                  </Text>
                                </FormItem>
                              </EncounterBox>
                            );
                          })}
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
