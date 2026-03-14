import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from '@remix-run/node';
import { useLoaderData, useFetcher, useParams, Link } from '@remix-run/react';
import { Button, TextInput, Title, Text, Radio, Modal, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { DatePicker } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { styled } from '~/styled-system/jsx';
import { getPatientToken } from '~/session.server';
import {
  findMedics,
  findAppointments,
  createBooking,
  verifyTurnstile,
  type MedicData,
  type AnonymizedSlot,
} from '~/api.server';

dayjs.locale('es');

export const meta: MetaFunction = ({ matches }) => {
  const slugData = matches.find(m => m.id === 'routes/$slug')?.data as { organization?: { name: string } } | undefined;
  const orgName = slugData?.organization?.name;
  return [{ title: orgName ? `Nuevo turno | ${orgName}` : 'Nuevo turno' }];
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const token = await getPatientToken(request);

  if (!token) {
    return redirect(`/${params.slug}/auth`);
  }

  try {
    const medics = await findMedics(token);
    const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || '';
    return json({ medics, turnstileSiteKey });
  } catch {
    return redirect(`/${params.slug}/auth`);
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const token = await getPatientToken(request);

  if (!token) {
    return json({ intent: 'unknown', error: 'unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'find-appointments') {
    const medicId = formData.get('medicId') as string;
    const date = formData.get('date') as string;

    try {
      const slots = await findAppointments(token, medicId, date);
      return json({ intent, slots });
    } catch {
      return json({ intent, slots: [] as AnonymizedSlot[] });
    }
  }

  if (intent === 'create-booking') {
    const medicId = formData.get('medicId') as string;
    const startDate = formData.get('startDate') as string;
    const turnstileToken = formData.get('cf-turnstile-response') as string;

    if (!turnstileToken) {
      return json({ intent, ok: false, error: 'captcha_required' });
    }

    const turnstileOk = await verifyTurnstile(turnstileToken);
    if (!turnstileOk) {
      return json({ intent, ok: false, error: 'captcha_failed' });
    }

    try {
      const result = await createBooking(token, medicId, startDate);
      return json({ intent, ok: true, appointmentId: result.appointmentId });
    } catch (err: any) {
      return json({ intent, ok: false, error: err?.message || 'booking_failed' });
    }
  }

  return json({ intent: 'unknown' });
};

// -- Styled components --

const Page = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '59vh',
    width: 'auto',
  },
});

const ProgressBar = styled('div', {
  base: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.25rem',
    maxWidth: '10rem',
  },
});

const ProgressSegment = styled('div', {
  base: {
    height: '4px',
    flex: 1,
    borderRadius: '2px',
    background: 'var(--mantine-color-gray-2)',
  },
  variants: {
    active: {
      true: {
        background: 'var(--mantine-primary-color-filled)',
      },
    },
  },
});

const StepLabel = styled('span', {
  base: {
    fontSize: '0.75rem',
    color: 'var(--mantine-primary-color-filled)',
    marginBottom: '0.5rem',
  },
});

const Subtitle = styled('p', {
  base: {
    color: 'var(--mantine-color-dimmed)',
    margin: '0 0 1rem',
  },
});

const ChipRow = styled('div', {
  base: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginBottom: '1rem',
  },
});

const Chip = styled('button', {
  base: {
    border: '1px solid var(--mantine-color-gray-3)',
    borderRadius: '999px',
    padding: '0.25rem 0.75rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    background: 'white',
    color: 'var(--mantine-color-gray-7)',
    transition: 'all 0.15s',
  },
  variants: {
    active: {
      true: {
        background: 'var(--mantine-primary-color-filled)',
        color: 'white',
        borderColor: 'var(--mantine-primary-color-filled)',
      },
    },
  },
});

const MedicList = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  },
});

const MedicRow = styled('label', {
  base: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  variants: {
    selected: {
      true: {
        borderLeft: '3px solid var(--mantine-primary-color-filled)',
        paddingLeft: '0.5rem',
        background: 'rgb(from var(--mantine-primary-color-0) r g b / 25%)',
      },
    },
  },
});

const Avatar = styled('div', {
  base: {
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '50%',
    background: 'var(--mantine-primary-color-1)',
    color: 'var(--mantine-primary-color-filled)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '0.85rem',
    flexShrink: 0,
  },
});

const MedicInfo = styled('div', {
  base: {
    flex: 1,
    minWidth: 0,
  },
});

const MedicName = styled('span', {
  base: {
    display: 'block',
    fontWeight: 600,
    lineHeight: 1.3,
  },
});

const MedicSpecialty = styled('span', {
  base: {
    display: 'block',
    fontSize: '0.85rem',
    color: 'var(--mantine-color-dimmed)',
  },
});

const BottomBar = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    paddingTop: '1rem',
    marginTop: 'auto',
    borderTop: '1px solid var(--mantine-color-gray-2)',
  },
});

const Step2Layout = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,

    md: {
      flexDirection: 'row',
    },
  },
});

const CalendarSide = styled('div', {
  base: {
    md: {
      flex: '0 0 auto',
    },
  },
});

const SlotsSide = styled('div', {
  base: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    borderLeft: 'none',
    md: {
      borderLeft: '1px solid var(--mantine-color-gray-2)',
    },
  },
});

const SlotRow = styled('div', {
  base: {
    display: 'flex',
    alignItems: 'stretch',
    borderBottom: '1px solid var(--mantine-color-gray-2)',
    borderRight: '1px solid var(--mantine-color-gray-2)',
    minHeight: '3rem',

    '&:first-child': {
      borderTop: '1px solid var(--mantine-color-gray-2)',
    },

    '&:last-child': {
      borderBottom: 'none',
    },
  },
  variants: {
    selected: {
      true: {
        background: 'var(--mantine-primary-color-1)',
      },
    },
  },
});

const SlotTime = styled('div', {
  base: {
    width: '4rem',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    color: 'var(--mantine-primary-color-filled)',
    background: 'var(--mantine-primary-color-0)',
  },
});

const SlotContent = styled('div', {
  base: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 0.75rem',
    cursor: 'pointer',
  },
  variants: {
    disabled: {
      true: {
        cursor: 'default',
      },
    },
  },
});

// -- Helpers --

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getUniqueSpecialties(medics: MedicData[]): string[] {
  const set = new Set<string>();
  for (const m of medics) {
    if (m.specialty) {
      m.specialty.split(',').forEach(s => {
        const trimmed = s.trim();
        if (trimmed) set.add(trimmed);
      });
    }
  }
  return Array.from(set).sort();
}

// -- Main component --

export default function BookingPage() {
  const { t } = useTranslation();
  const params = useParams();
  const { medics, turnstileSiteKey } = useLoaderData<typeof loader>();
  const slotsFetcher = useFetcher<{ intent: string; slots?: AnonymizedSlot[] }>();
  const bookingFetcher = useFetcher<{ intent: string; ok?: boolean; error?: string }>();

  const [step, setStep] = useState(1);
  const [selectedMedicId, setSelectedMedicId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [selectedSlotDate, setSelectedSlotDate] = useState<string | null>(null);
  const [captchaOpen, { open: openCaptcha, close: closeCaptcha }] = useDisclosure(false);

  const slots = slotsFetcher.data?.slots ?? [];
  const loadingSlots = slotsFetcher.state !== 'idle';
  const isBooking = bookingFetcher.state !== 'idle';

  const specialties = useMemo(() => getUniqueSpecialties(medics), [medics]);

  const filteredMedics = useMemo(() => {
    let result = medics;

    if (activeFilter) {
      result = result.filter(m => m.specialty.toLowerCase().includes(activeFilter.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        m =>
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.specialty.toLowerCase().includes(q)
      );
    }

    return result;
  }, [medics, search, activeFilter]);

  const selectedMedic = useMemo(() => medics.find(m => m.id === selectedMedicId), [medics, selectedMedicId]);

  const loadSlots = useCallback(
    (medicId: string, date: string) => {
      setSelectedSlotDate(null);
      slotsFetcher.submit(
        { intent: 'find-appointments', medicId, date },
        { method: 'post' }
      );
    },
    [slotsFetcher]
  );

  const handleSelectMedic = useCallback((id: string) => {
    setSelectedMedicId(id);
  }, []);

  const handleFilterClick = useCallback((specialty: string | null) => {
    setActiveFilter(specialty);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.currentTarget.value);
  }, []);

  const handleContinue = useCallback(() => {
    if (!selectedMedicId) return;
    setStep(2);
    loadSlots(selectedMedicId, selectedDate);
  }, [selectedMedicId, selectedDate, loadSlots]);

  const handleBack = useCallback(() => {
    setStep(1);
    setSelectedSlotDate(null);
  }, []);

  const handleDateChange = useCallback(
    (date: string | null) => {
      if (!date || !selectedMedicId) return;
      setSelectedDate(date);
      loadSlots(selectedMedicId, date);
    },
    [selectedMedicId, loadSlots]
  );

  const handleSlotClick = useCallback((slotDate: string, taken: boolean) => {
    if (taken) return;
    setSelectedSlotDate(slotDate);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedSlotDate || !selectedMedicId) return;
    openCaptcha();
  }, [selectedSlotDate, selectedMedicId, openCaptcha]);

  // Clear selected slot when new slots arrive
  useEffect(() => {
    if (slotsFetcher.state === 'idle' && slotsFetcher.data) {
      setSelectedSlotDate(null);
    }
  }, [slotsFetcher.state, slotsFetcher.data]);

  // Handle booking result
  useEffect(() => {
    if (bookingFetcher.state === 'idle' && bookingFetcher.data?.intent === 'create-booking') {
      if (bookingFetcher.data.ok) {
        setStep(3);
      }
    }
  }, [bookingFetcher.state, bookingFetcher.data]);

  // Turnstile explicit rendering inside modal
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const submitWithToken = useCallback(
    (token: string) => {
      if (!selectedSlotDate || !selectedMedicId) return;
      closeCaptcha();
      bookingFetcher.submit(
        {
          intent: 'create-booking',
          medicId: selectedMedicId,
          startDate: selectedSlotDate,
          'cf-turnstile-response': token,
        },
        { method: 'post' }
      );
    },
    [selectedSlotDate, selectedMedicId, closeCaptcha, bookingFetcher]
  );

  useEffect(() => {
    if (!turnstileSiteKey || !captchaOpen) return;

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      if (!turnstile || !turnstileRef.current) return;

      if (turnstileWidgetId.current) {
        turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }

      turnstileWidgetId.current = turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'light',
        callback: (token: string) => submitWithToken(token),
      });
    };

    // Small delay to ensure modal DOM is mounted
    const timer = setTimeout(() => {
      if ((window as any).turnstile) {
        renderWidget();
      } else {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (turnstileWidgetId.current && (window as any).turnstile) {
        (window as any).turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [turnstileSiteKey, captchaOpen, submitWithToken]);

  return (
    <Page>
      {step < 3 && (
        <>
          <ProgressBar>
            <ProgressSegment active />
            <ProgressSegment active={step >= 2} />
          </ProgressBar>
          <StepLabel>{t('booking.step_of', { step, total: 2 })}</StepLabel>
        </>
      )}

      {step === 1 && (
        <>
          <Title order={2} mb={4}>
            {t('booking.choose_medic')}
          </Title>
          <Subtitle>{t('booking.choose_medic_subtitle')}</Subtitle>

          <TextInput
            placeholder={t('booking.search_placeholder')}
            leftSection={<MagnifyingGlassIcon size={16} />}
            value={search}
            onChange={handleSearchChange}
            mb="sm"
          />

          <ChipRow>
            <Chip active={!activeFilter} onClick={() => handleFilterClick(null)}>
              {t('booking.all')}
            </Chip>
            {specialties.map(s => (
              <Chip key={s} active={activeFilter === s} onClick={() => handleFilterClick(s)}>
                {s}
              </Chip>
            ))}
          </ChipRow>

          <MedicList>
            {filteredMedics.map(medic => (
              <MedicRow key={medic.id} selected={selectedMedicId === medic.id}>
                <Avatar>{getInitials(medic.firstName, medic.lastName)}</Avatar>
                <MedicInfo>
                  <MedicName>
                    {medic.lastName.toUpperCase()}, {medic.firstName}
                  </MedicName>
                  <MedicSpecialty>{medic.specialty}</MedicSpecialty>
                </MedicInfo>
                <Radio
                  checked={selectedMedicId === medic.id}
                  onChange={() => handleSelectMedic(medic.id)}
                  styles={{ radio: { cursor: 'pointer' } }}
                />
              </MedicRow>
            ))}
          </MedicList>

          <BottomBar>
            <Button variant="default" onClick={() => window.history.back()}>
              {t('booking.cancel')}
            </Button>
            <Button disabled={!selectedMedicId} onClick={handleContinue}>
              {t('booking.continue')} &rarr;
            </Button>
          </BottomBar>
        </>
      )}

      {step === 2 && selectedMedic && (
        <>
          <Title order={2} mb={4}>
            {t('booking.date_and_time')}
          </Title>
          <Subtitle>
            Dra. {selectedMedic.lastName.toUpperCase()}, {selectedMedic.firstName} &middot;{' '}
            {selectedMedic.specialty}
          </Subtitle>

          <Step2Layout>
            <CalendarSide>
              <DatePicker
                value={selectedDate}
                onChange={handleDateChange}
                locale="es"
                minDate={dayjs().format('YYYY-MM-DD')}
                excludeDate={date => {
                  const d = dayjs(date).day();
                  return d === 0 || d === 6;
                }}
              />
            </CalendarSide>

            <SlotsSide>
              {loadingSlots && (
                <Text c="dimmed" p="md">
                  Cargando...
                </Text>
              )}

              {!loadingSlots && slots.length === 0 && (
                <Text c="dimmed" p="md">
                  {t('booking.no_schedule')}
                </Text>
              )}

              {!loadingSlots &&
                slots.map(slot => {
                  const isSelected = selectedSlotDate === slot.date;
                  return (
                    <SlotRow key={slot.date} selected={isSelected}>
                      <SlotTime>{slot.extra ? 'ST' : dayjs(slot.date).format('HH:mm')}</SlotTime>
                      <SlotContent
                        disabled={slot.taken}
                        onClick={() => handleSlotClick(slot.date, slot.taken)}
                      >
                        {slot.taken && (
                          <div>
                            <Text fw={600} size="sm" lh={1.3}>
                              {t('booking.unavailable')}
                            </Text>
                            <Text c="dimmed" size="xs">
                              {t('booking.taken')}
                            </Text>
                          </div>
                        )}

                        {!slot.taken && !isSelected && (
                          <Text c="dimmed" size="sm">
                            {t('booking.free')}
                          </Text>
                        )}

                        {!slot.taken && isSelected && (
                          <Text c="var(--mantine-primary-color-filled)" fw={600} size="sm">
                            {t('booking.selected_slot')}
                          </Text>
                        )}
                      </SlotContent>
                    </SlotRow>
                  );
                })}
            </SlotsSide>
          </Step2Layout>

          {bookingFetcher.data?.error && (
            <Text c="red" size="sm" mt="sm">
              {bookingFetcher.data.error}
            </Text>
          )}

          <BottomBar>
            <Button variant="default" onClick={handleBack}>
              &larr; {t('booking.back')}
            </Button>
            <Button
              disabled={!selectedSlotDate}
              loading={isBooking}
              onClick={handleConfirm}
            >
              {t('booking.confirm')}
            </Button>
          </BottomBar>

          <Modal opened={captchaOpen} onClose={closeCaptcha} centered size="sm" title={t('booking.captcha_required')}>
            <Stack align="center" py="md">
              <div ref={turnstileRef} />
              <Text c="dimmed" size="sm" ta="center">
                {t('booking.captcha_required')}
              </Text>
            </Stack>
          </Modal>
        </>
      )}

      {step === 3 && selectedMedic && selectedSlotDate && (
        <Stack align="center" gap="md" py="xl">
          <Title order={2} ta="center">
            {t('booking.confirmed_title', 'Turno confirmado')}
          </Title>
          <Text ta="center" c="dimmed">
            {t('booking.confirmed_message', {
              defaultValue:
                'Tu turno con {{medic}} el {{date}} a las {{time}} fue confirmado.',
              medic: `${selectedMedic.lastName.toUpperCase()}, ${selectedMedic.firstName}`,
              date: dayjs(selectedSlotDate).format('DD/MM/YYYY'),
              time: dayjs(selectedSlotDate).format('HH:mm'),
              interpolation: { escapeValue: false },
            })}
          </Text>
          <Button component={Link} to={`/${params.slug}`} mt="md">
            OK
          </Button>
        </Stack>
      )}
    </Page>
  );
}
