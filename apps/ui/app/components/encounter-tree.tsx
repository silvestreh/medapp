import { type FC, useCallback, useMemo } from 'react';
import { Accordion, Text, Stack } from '@mantine/core';
import dayjs from 'dayjs';
import groupBy from 'lodash/groupBy';
import mapValues from 'lodash/mapValues';
import { useTranslation } from 'react-i18next';
import { useRouteLoaderData } from '@remix-run/react';

import { styled } from '~/styled-system/jsx';
import { studySchemas } from '~/components/forms/study-schemas';
import { formatInLocale, parseInLocale } from '~/utils';

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

interface Prescription {
  id: string;
  type: 'prescription' | 'order';
  status: string;
  createdAt: string;
  content: {
    diagnosis?: string;
    medicines?: { text: string; quantity: number; posology?: string; longTerm: boolean }[];
    orderText?: string;
  } | null;
  recetarioDocumentIds?: { id: number; type: string; url: string }[];
}

/** A unified timeline entry that can be either an encounter, study, or prescription. */
export type TimelineEntry =
  | { kind: 'encounter'; date: string; data: Encounter }
  | { kind: 'study'; date: string; data: Study }
  | { kind: 'prescription'; date: string; data: Prescription };

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType: string, t: any): string {
  if (mimeType.startsWith('image/')) return t('encounters.file_type_image');
  if (mimeType === 'application/pdf') return t('encounters.file_type_pdf');
  if (mimeType === 'application/dicom') return t('encounters.file_type_dicom');
  return t('encounters.file_type_file');
}

interface EncounterTreeProps {
  encounters: Encounter[];
  studies?: Study[];
  prescriptions?: Prescription[];
  onEncounterClick?: (encounter: Encounter) => void;
  onFormClick?: (encounter: Encounter, formKey: string) => void;
  onStudyClick?: (study: Study) => void;
  onPrescriptionClick?: (prescription: Prescription) => void;
  onAttachmentClick?: (encounter: Encounter, attachmentIndex: number) => void;
  activeEncounterId?: string;
  activeFormKey?: string;
  activeStudyId?: string;
  activePrescriptionId?: string;
  activeAttachmentIndex?: number | null;
}

const StyledAccordion = styled(Accordion, {
  base: {
    position: 'sticky',
    top: '5em',
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

const EncounterTree: FC<EncounterTreeProps> = ({
  encounters,
  studies = [],
  prescriptions = [],
  activeEncounterId,
  activeFormKey,
  activeStudyId,
  activePrescriptionId,
  activeAttachmentIndex,
  onFormClick,
  onStudyClick,
  onPrescriptionClick,
  onAttachmentClick,
}) => {
  const { t } = useTranslation();

  const handleFormItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, encounter: Encounter, key: string) => {
      e.stopPropagation();
      onFormClick?.(encounter, key);
    },
    [onFormClick]
  );

  const handleStudyClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, study: Study) => {
      e.stopPropagation();
      onStudyClick?.(study);
    },
    [onStudyClick]
  );

  const handlePrescriptionClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, prescription: Prescription) => {
      e.stopPropagation();
      onPrescriptionClick?.(prescription);
    },
    [onPrescriptionClick]
  );

  const handleAttachmentItemClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, encounter: Encounter, index: number) => {
      e.stopPropagation();
      onAttachmentClick?.(encounter, index);
    },
    [onAttachmentClick]
  );

  const timeline: TimelineEntry[] = useMemo(() => {
    const nonEmptyStudies = studies.filter(study => {
      if (!study.results || study.results.length === 0) return false;
      return study.results.some(result => {
        if (!result.data || typeof result.data !== 'object') return false;
        return Object.values(result.data).some(v => {
          if (v === null || v === undefined || v === '') return false;
          if (typeof v === 'object' && 'value' in v) return !!v.value;
          return true;
        });
      });
    });

    const entries: TimelineEntry[] = [
      ...encounters.map((enc): TimelineEntry => ({ kind: 'encounter', date: enc.date, data: enc })),
      ...nonEmptyStudies.map((study): TimelineEntry => ({ kind: 'study', date: study.date, data: study })),
      ...prescriptions.map((rx): TimelineEntry => ({ kind: 'prescription', date: rx.createdAt, data: rx })),
    ];
    return entries;
  }, [encounters, studies, prescriptions]);

  const rootData = useRouteLoaderData('root') as { locale?: string } | undefined;
  const locale = rootData?.locale ?? 'es';

  const groupedEntries = useMemo(
    () =>
      mapValues(
        groupBy(timeline, entry => formatInLocale(entry.date, 'YYYY', locale)),
        yearEntries => groupBy(yearEntries, entry => formatInLocale(entry.date, 'MMMM, YYYY', locale))
      ),
    [timeline, locale]
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
                  return (
                    parseInLocale(b, 'MMMM, YYYY', locale).valueOf() - parseInLocale(a, 'MMMM, YYYY', locale).valueOf()
                  );
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
                          .map(entry => {
                            if (entry.kind === 'encounter') {
                              const encounter = entry.data;
                              return (
                                <EncounterBox
                                  key={`enc-${encounter.id}`}
                                  active={activeEncounterId === encounter.id && !activeFormKey}
                                >
                                  <EncounterDateText>
                                    {formatInLocale(encounter.date, 'dddd D, HH:mm', locale)}
                                  </EncounterDateText>
                                  {encounter.data &&
                                    Object.keys(encounter.data).filter(key => key !== 'attachments').map(key => (
                                      <FormItem
                                        key={key}
                                        onClick={e => handleFormItemClick(e, encounter, key)}
                                        active={activeEncounterId === encounter.id && activeFormKey === key}
                                      >
                                        {t(`forms.${encounter.data[key].type}` as any)}
                                      </FormItem>
                                    ))}
                                  {encounter.data?.attachments?.map((att: any, i: number) => (
                                    <FormItem
                                      key={`att-${i}`}
                                      onClick={e => handleAttachmentItemClick(e, encounter, i)}
                                      active={activeEncounterId === encounter.id && activeAttachmentIndex === i}
                                    >
                                      {getFileTypeLabel(att.mimeType, t)}
                                      <Text
                                        size="xs"
                                        c={activeEncounterId === encounter.id && activeAttachmentIndex === i ? 'white' : 'gray.5'}
                                        mt={2}
                                        style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}
                                      >
                                        {att.fileName} · {formatFileSize(att.fileSize)}
                                      </Text>
                                    </FormItem>
                                  ))}
                                </EncounterBox>
                              );
                            }

                            if (entry.kind === 'study') {
                              const study = entry.data;
                              const studyTypes = study.results
                                ? study.results.map(r => studySchemas[r.type]?.label ?? r.type)
                                : Object.keys(study.studies ?? {})
                                    .filter(k => study.studies[k])
                                    .map(k => studySchemas[k]?.label ?? k);

                              return (
                                <EncounterBox key={`study-${study.id}`}>
                                  <EncounterDateText>
                                    {formatInLocale(study.date, 'dddd D, HH:mm', locale)}
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
                            }

                            // Prescription / Order
                            const rx = entry.data;
                            const isActive = activePrescriptionId === rx.id;
                            return (
                              <EncounterBox key={`rx-${rx.id}`}>
                                <EncounterDateText>
                                  {formatInLocale(rx.createdAt, 'dddd D, HH:mm', locale)}
                                </EncounterDateText>
                                <FormItem onClick={e => handlePrescriptionClick(e, rx)} active={isActive}>
                                  {t(`recetario.type_${rx.type}` as any)}
                                  {rx.content?.diagnosis && (
                                    <Text
                                      size="xs"
                                      c={isActive ? 'white' : 'gray.5'}
                                      mt={2}
                                      style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        maxWidth: '250px',
                                      }}
                                    >
                                      {rx.content.diagnosis}
                                    </Text>
                                  )}
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
