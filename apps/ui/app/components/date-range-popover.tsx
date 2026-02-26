import { useCallback, useMemo, useState } from 'react';
import { Button, Group, NumberInput, Popover, Select, Stack } from '@mantine/core';
import { DatePickerInput, MonthPickerInput } from '@mantine/dates';
import { useClickOutside } from '@mantine/hooks';
import { ChevronDown } from 'lucide-react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

export type DateRangeMode = 'in_last' | 'after' | 'before' | 'between';
export type DateRangeUnit = 'day' | 'week' | 'month' | 'year';
export type DateRangePrecision = 'day' | 'month';

export interface DateRangeFilterState {
  mode: DateRangeMode;
  lastAmount: number;
  lastUnit: DateRangeUnit;
  singleDate: string | null;
  betweenRange: [string | null, string | null];
}

export interface ResolvedDateRange {
  from: dayjs.Dayjs;
  to: dayjs.Dayjs;
}

interface DateRangePopoverLabels {
  modeInLast: string;
  modeAfter: string;
  modeBefore: string;
  modeBetween: string;
  rangeMode: string;
  lastValue: string;
  lastUnit: string;
  unitDays: string;
  unitWeeks: string;
  unitMonths: string;
  unitYears: string;
  pickDate: string;
  pickRange: string;
  invalidRange: string;
  apply: string;
}

function useDateRangeLabels(): DateRangePopoverLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      modeInLast: t('stats.mode_in_last'),
      modeAfter: t('stats.mode_after'),
      modeBefore: t('stats.mode_before'),
      modeBetween: t('stats.mode_between'),
      rangeMode: t('stats.range_mode'),
      lastValue: t('stats.last_value'),
      lastUnit: t('stats.last_unit'),
      unitDays: t('stats.unit_days'),
      unitWeeks: t('stats.unit_weeks'),
      unitMonths: t('stats.unit_months'),
      unitYears: t('stats.unit_years'),
      pickDate: t('stats.pick_date'),
      pickRange: t('stats.pick_range'),
      invalidRange: t('stats.invalid_range'),
      apply: t('stats.apply'),
    }),
    [t]
  );
}

interface ResolveOptions {
  minRangeStart: string;
  maxDate: string;
  precision: DateRangePrecision;
}

interface DateRangePopoverProps {
  value: DateRangeFilterState;
  onApply: (nextState: DateRangeFilterState, range: ResolvedDateRange) => void;
  minRangeStart?: string;
  maxDate?: string;
  precision?: DateRangePrecision;
  fullWidth?: boolean;
  withinPortal?: boolean;
}

function formatSummaryDate(value: dayjs.Dayjs, precision: DateRangePrecision): string {
  return precision === 'month' ? value.format('YYYY-MM') : value.format('YYYY-MM-DD');
}

export function resolveDateRange(state: DateRangeFilterState, options: ResolveOptions): ResolvedDateRange | null {
  const { minRangeStart, maxDate, precision } = options;
  const now = dayjs(maxDate);
  if (!now.isValid()) return null;

  const startUnit = precision === 'month' ? 'month' : 'day';
  const endUnit = precision === 'month' ? 'month' : 'day';

  if (state.mode === 'in_last') {
    if (!state.lastAmount || state.lastAmount <= 0) return null;
    return {
      from: now.subtract(state.lastAmount, state.lastUnit).startOf(startUnit),
      to: now.endOf(endUnit),
    };
  }

  if (state.mode === 'after') {
    if (!state.singleDate) return null;
    const from = dayjs(state.singleDate);
    if (!from.isValid()) return null;
    return {
      from: from.startOf(startUnit),
      to: now.endOf(endUnit),
    };
  }

  if (state.mode === 'before') {
    if (!state.singleDate) return null;
    const to = dayjs(state.singleDate);
    if (!to.isValid()) return null;
    return {
      from: dayjs(minRangeStart).startOf(startUnit),
      to: to.endOf(endUnit),
    };
  }

  const [fromRaw, toRaw] = state.betweenRange;
  if (!fromRaw || !toRaw) return null;
  const from = dayjs(fromRaw);
  const to = dayjs(toRaw);
  if (!from.isValid() || !to.isValid() || to.isBefore(from)) return null;
  return {
    from: from.startOf(startUnit),
    to: to.endOf(endUnit),
  };
}

export function getRangeSummary(
  state: DateRangeFilterState,
  range: ResolvedDateRange | null,
  labels: DateRangePopoverLabels,
  precision: DateRangePrecision
): string {
  if (!range) return labels.invalidRange;

  if (state.mode === 'in_last') {
    const unitLabel =
      state.lastUnit === 'day'
        ? labels.unitDays
        : state.lastUnit === 'week'
          ? labels.unitWeeks
          : state.lastUnit === 'month'
            ? labels.unitMonths
            : labels.unitYears;
    return `${labels.modeInLast} ${state.lastAmount} ${unitLabel}`;
  }

  if (state.mode === 'after') {
    return `${labels.modeAfter} ${formatSummaryDate(range.from, precision)}`;
  }

  if (state.mode === 'before') {
    return `${labels.modeBefore} ${formatSummaryDate(range.to, precision)}`;
  }

  return `${formatSummaryDate(range.from, precision)} - ${formatSummaryDate(range.to, precision)}`;
}

export function DateRangePopover({
  value,
  onApply,
  minRangeStart = '1900-01-01',
  maxDate = dayjs().format('YYYY-MM-DD'),
  precision = 'day',
  fullWidth = false,
  withinPortal = true,
}: DateRangePopoverProps) {
  const labels = useDateRangeLabels();
  const [draft, setDraft] = useState<DateRangeFilterState>(value);
  const [opened, setOpened] = useState(false);
  const [controlNode, setControlNode] = useState<HTMLDivElement | null>(null);
  const [dropdownNode, setDropdownNode] = useState<HTMLDivElement | null>(null);
  const popoverRef = useClickOutside<HTMLDivElement>(
    () => setOpened(false),
    ['mousedown', 'touchstart'],
    [controlNode, dropdownNode].filter(Boolean) as HTMLElement[]
  );

  const modeOptions = useMemo(
    () => [
      { value: 'in_last', label: labels.modeInLast },
      { value: 'after', label: labels.modeAfter },
      { value: 'before', label: labels.modeBefore },
      { value: 'between', label: labels.modeBetween },
    ],
    [labels]
  );

  const unitOptions = useMemo(
    () => [
      { value: 'day', label: labels.unitDays },
      { value: 'week', label: labels.unitWeeks },
      { value: 'month', label: labels.unitMonths },
      { value: 'year', label: labels.unitYears },
    ],
    [labels]
  );

  const resolved = useMemo(
    () => resolveDateRange(value, { minRangeStart, maxDate, precision }),
    [maxDate, minRangeStart, precision, value]
  );
  const draftResolved = useMemo(
    () => resolveDateRange(draft, { minRangeStart, maxDate, precision }),
    [draft, maxDate, minRangeStart, precision]
  );
  const summary = useMemo(
    () => getRangeSummary(value, resolved, labels, precision),
    [labels, precision, resolved, value]
  );

  const handleToggle = useCallback(() => {
    setOpened(prev => {
      if (!prev) {
        setDraft(value);
      }
      return !prev;
    });
  }, [value]);

  const handleModeChange = useCallback((next: string | null) => {
    if (!next) return;
    setDraft(prev => ({ ...prev, mode: next as DateRangeMode }));
  }, []);

  const handleLastAmountChange = useCallback((next: string | number) => {
    const numeric = typeof next === 'number' ? next : Number(next);
    if (Number.isNaN(numeric)) return;
    setDraft(prev => ({ ...prev, lastAmount: numeric }));
  }, []);

  const handleLastUnitChange = useCallback((next: string | null) => {
    if (!next) return;
    setDraft(prev => ({ ...prev, lastUnit: next as DateRangeUnit }));
  }, []);

  const handleSingleDateChange = useCallback((next: string | null) => {
    setDraft(prev => ({ ...prev, singleDate: next }));
  }, []);

  const handleBetweenRangeChange = useCallback((next: [string | null, string | null]) => {
    setDraft(prev => ({ ...prev, betweenRange: next }));
  }, []);

  const handleApply = useCallback(() => {
    if (!draftResolved) return;
    onApply(draft, draftResolved);
    setOpened(false);
  }, [draft, draftResolved, onApply]);

  const pickerProps = {
    maxDate,
    clearable: false,
    popoverProps: { withinPortal: false },
  };

  return (
    <div ref={popoverRef} style={{ flex: fullWidth ? 1 : undefined, width: fullWidth ? '100%' : undefined }}>
      <Popover
        opened={opened}
        onChange={setOpened}
        width={360}
        position="bottom-end"
        withArrow
        shadow="md"
        closeOnClickOutside={false}
        withinPortal={withinPortal}
      >
        <Popover.Target>
          <div ref={setControlNode}>
            <Button
              variant="default"
              onClick={handleToggle}
              rightSection={<ChevronDown size={14} />}
              fullWidth={fullWidth}
              styles={{ label: { flex: fullWidth ? 1 : undefined } }}
            >
              {summary}
            </Button>
          </div>
        </Popover.Target>
        <Popover.Dropdown ref={setDropdownNode}>
          <Stack gap="sm">
            <Select
              data={modeOptions}
              value={draft.mode}
              onChange={handleModeChange}
              allowDeselect={false}
              label={labels.rangeMode}
              comboboxProps={{ withinPortal: false }}
            />

            {draft.mode === 'in_last' && (
              <Group grow>
                <NumberInput
                  min={1}
                  value={draft.lastAmount}
                  onChange={handleLastAmountChange}
                  label={labels.lastValue}
                />
                <Select
                  data={unitOptions}
                  value={draft.lastUnit}
                  onChange={handleLastUnitChange}
                  allowDeselect={false}
                  label={labels.lastUnit}
                  comboboxProps={{ withinPortal: false }}
                />
              </Group>
            )}

            {(draft.mode === 'after' || draft.mode === 'before') &&
              (precision === 'month' ? (
                <MonthPickerInput
                  value={draft.singleDate}
                  onChange={handleSingleDateChange}
                  label={labels.pickDate}
                  valueFormat="MM/YYYY"
                  {...pickerProps}
                />
              ) : (
                <DatePickerInput
                  value={draft.singleDate}
                  onChange={handleSingleDateChange}
                  label={labels.pickDate}
                  {...pickerProps}
                />
              ))}

            {draft.mode === 'between' &&
              (precision === 'month' ? (
                <MonthPickerInput
                  type="range"
                  value={draft.betweenRange}
                  onChange={handleBetweenRangeChange}
                  label={labels.pickRange}
                  valueFormat="MM/YYYY"
                  {...pickerProps}
                />
              ) : (
                <DatePickerInput
                  type="range"
                  value={draft.betweenRange}
                  onChange={handleBetweenRangeChange}
                  label={labels.pickRange}
                  {...pickerProps}
                />
              ))}

            <Group justify="flex-end">
              <Button onClick={handleApply} disabled={!draftResolved}>
                {labels.apply}
              </Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
