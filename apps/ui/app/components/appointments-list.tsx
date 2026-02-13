import { useState, type FC } from 'react';
import dayjs from 'dayjs';
import { ActionIcon, Popover, Group, Button, Stack } from '@mantine/core';
import { useClickOutside } from '@mantine/hooks';
import { Trash } from 'lucide-react';

import { styled } from '~/styled-system/jsx';
import { useMutation } from '~/components/provider';
import PatientSearch from '~/components/patient-search';
import type { Appointment, Slot as SlotType } from '~/declarations';

interface AppointmentsListProps {
  slots: SlotType[];
  readonly?: boolean;
  onRemove?: (id: string) => void;
  onAppointmentClick?: (appointment: Appointment | null) => void;
  medicId?: string;
  className?: string;
}

const Container = styled('div', {
  base: {
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid var(--mantine-color-gray-2)',
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
});

const Slot = styled('div', {
  base: {
    alignItems: 'center',
    display: 'flex',
    gap: '4px',
    color: 'var(--mantine-color-gray-8)',
    height: '3em',

    '& + &': {
      borderTop: '1px solid var(--mantine-color-gray-2)',
    },

    '&:last-child': {
      borderBottom: '1px solid var(--mantine-color-gray-2)',
    },

    md: {
      height: '4em',
    },
  },

  variants: {
    isClickable: {
      true: {
        cursor: 'pointer',
      },
      false: {
        cursor: 'default',
      },
    },
    isActiveSlot: {
      true: {
        background: 'rgb(from var(--mantine-color-blue-0) r g b / 35%)',
      },
    },
  },
});

const Time = styled('span', {
  base: {
    padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
    background: 'var(--mantine-color-blue-0)',
    fontFamily: 'monospace',
    color: 'rgba(0, 0, 0, 0.5)',
    flexShrink: 0,
    height: '100%',
    display: 'inline-flex',
    alignItems: 'center',
  },

  variants: {
    isExtra: {
      true: {
        background: 'var(--mantine-color-yellow-0)',
      },
    },
  },
});

const MainContent = styled('div', {
  base: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
});

const Text = styled('span', {
  base: {
    flex: 1,
    paddingRight: '1em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
    lineHeight: 1,

    '& + &': {
      marginTop: '0.5em',
    },
  },

  variants: {
    variant: {
      light: {
        color: 'var(--mantine-color-gray-5)',
      },
    },
    small: {
      true: {
        fontSize: '0.8em',
      },
    },
  },
});

const TextContent = styled('div', {
  base: {
    width: 'calc(100% - 2em)',
  },
});

const AppointmentsList: FC<AppointmentsListProps> = ({
  slots: initialSlots,
  onRemove,
  readonly,
  onAppointmentClick,
  medicId,
  className,
}) => {
  const [slots, setSlots] = useState(initialSlots);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const { create, remove } = useMutation('appointments');
  const ref = useClickOutside(() => setOpenPopover(null));

  const handleOpenPopover = (id: string) => () => setOpenPopover(id);
  const handleClosePopover = () => setOpenPopover(null);

  const handleRemove = (id: string) => () => {
    const slotIndex = slots.findIndex(slot => slot.appointment?.id === id);
    const isExtra = slots[slotIndex].appointment?.extra;

    remove(id);
    handleClosePopover();
    onRemove?.(id);
    setSlots(prev => {
      if (isExtra) {
        return prev.filter(slot => slot.appointment?.id !== id);
      }

      return prev.map((slot, index) => {
        return index === slotIndex ? { ...slot, appointment: null } : slot;
      });
    });
  };

  const handleClickSlot = (slot: SlotType) => () => {
    if (!readonly && !slot.appointment) {
      setActiveSlot(slot.date);
    }
    onAppointmentClick?.(slot.appointment);
  };

  const handlePatientChange =
    (slot: SlotType, extra: boolean = false) =>
    async (patientId: string) => {
      const slotIndex = slots.findIndex(s => s.date === slot.date);
      const result = await create({ patientId, medicId, startDate: slot.date, extra });

      setSlots(prev => {
        if (extra) {
          return [...prev, { ...slot, appointment: result }];
        }

        return prev.map((slot, index) => {
          return index === slotIndex ? { ...slot, appointment: result } : slot;
        });
      });
    };

  return (
    <Container className={className}>
      {slots.map((slot, index) => {
        const isExtra = slot.appointment?.extra;
        const isActiveSlot = activeSlot === slot.date;
        const isAssignedSlot = !!slot.appointment;
        const isClickable = (() => {
          if (readonly && typeof onAppointmentClick === 'function' && isAssignedSlot) {
            return true;
          }

          if (readonly && !isAssignedSlot) {
            return false;
          }

          if (!readonly && !isAssignedSlot) {
            return true;
          }

          return false;
        })();

        return (
          <Slot key={index} onClick={handleClickSlot(slot)} isActiveSlot={isActiveSlot} isClickable={isClickable}>
            <Time isExtra={isExtra}>{isExtra ? <>&nbsp;&nbsp;&nbsp;ST</> : dayjs(slot.date).format('HH:mm')}</Time>
            <MainContent>
              {slot.appointment && (
                <>
                  <TextContent>
                    <Text>
                      <strong>{slot.appointment.patient.personalData.lastName.toUpperCase()}</strong>
                      {', '}
                      {slot.appointment.patient.personalData.firstName}
                    </Text>
                    <Text variant="light" small>
                      {slot.appointment.patient.medicare || 'Particular'}
                    </Text>
                  </TextContent>
                  {!readonly && (
                    <Popover
                      position="left"
                      withArrow
                      arrowSize={12}
                      opened={openPopover === slot.appointment.id}
                      shadow="xs"
                    >
                      <Popover.Target>
                        <ActionIcon variant="subtle" onClick={handleOpenPopover(slot.appointment.id)}>
                          <Trash size={16} />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown ref={ref}>
                        <Stack align="flex-end">
                          <Text>¿Estás seguro de querer eliminar este turno?</Text>
                          <Group>
                            <Button size="compact-sm" onClick={handleRemove(slot.appointment.id)} color="red">
                              Eliminar
                            </Button>
                            <Button size="compact-sm" variant="outline" onClick={handleClosePopover}>
                              Cancelar
                            </Button>
                          </Group>
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                  )}
                </>
              )}
              {!slot.appointment && readonly && <Text variant="light">Libre</Text>}
              {!slot.appointment && !isActiveSlot && !readonly && <Text variant="light">Libre</Text>}
              {!slot.appointment && !readonly && isActiveSlot && (
                <PatientSearch autoFocus onChange={handlePatientChange(slot)} onBlur={() => setActiveSlot(null)} />
              )}
            </MainContent>
          </Slot>
        );
      })}
      {!readonly && (
        <Slot>
          <Time isExtra>&nbsp;&nbsp;&nbsp;ST</Time>
          <MainContent>
            <PatientSearch
              onChange={handlePatientChange({ date: dayjs().format('YYYY-MM-DD'), appointment: null }, true)}
              placeholder="Agregar sobre turno"
              key={slots.length}
            />
          </MainContent>
        </Slot>
      )}
    </Container>
  );
};

export default AppointmentsList;
