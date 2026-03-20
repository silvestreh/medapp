import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stepper,
  SegmentedControl,
  Textarea,
  NumberInput,
  Checkbox,
  Button,
  Group,
  Stack,
  ActionIcon,
  Text,
  Popover,
  ScrollArea,
  Box,
  Table,
  Loader,
  TextInput,
  SimpleGrid,
  Select,
  Divider,
  Anchor,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon, PencilIcon } from '@phosphor-icons/react';
import { AsYouType, type CountryCode } from 'libphonenumber-js';

import { Icd10Selector } from '~/components/icd10-selector';
import { PrepagaSelector } from '~/components/prepaga-selector';
import { trackAction } from '~/utils/breadcrumbs';

const COUNTRY_PHONE_OPTIONS = [
  { value: '54', label: '🇦🇷 +54', country: 'AR' as CountryCode },
  { value: '55', label: '🇧🇷 +55', country: 'BR' as CountryCode },
  { value: '56', label: '🇨🇱 +56', country: 'CL' as CountryCode },
  { value: '57', label: '🇨🇴 +57', country: 'CO' as CountryCode },
  { value: '52', label: '🇲🇽 +52', country: 'MX' as CountryCode },
  { value: '598', label: '🇺🇾 +598', country: 'UY' as CountryCode },
  { value: '595', label: '🇵🇾 +595', country: 'PY' as CountryCode },
  { value: '51', label: '🇵🇪 +51', country: 'PE' as CountryCode },
  { value: '1', label: '🇺🇸 +1', country: 'US' as CountryCode },
  { value: '34', label: '🇪🇸 +34', country: 'ES' as CountryCode },
];

function formatPhoneForDisplay(digits: string, callingCode: string): string {
  const country = COUNTRY_PHONE_OPTIONS.find(o => o.value === callingCode)?.country || 'AR';
  const formatter = new AsYouType(country);
  // Feed the full international number so the formatter knows the format
  const formatted = formatter.input(`+${callingCode}${digits}`);
  // Strip the country code prefix from the display (e.g. "+54 " → "")
  const prefix = `+${callingCode} `;
  return formatted.startsWith(prefix)
    ? formatted.slice(prefix.length)
    : formatted.replace(`+${callingCode}`, '').trim();
}

interface MedicineRow {
  medication: RecetarioSelectedMedication | null;
  quantity: number;
  posology: string;
  longTerm: boolean;
  genericOnly: boolean;
}

interface RecetarioMed {
  id: number;
  brand: string;
  drug: string;
  requiresDuplicate: boolean;
  hivSpecific: boolean;
  packages?: {
    id: number;
    name: string;
    externalId: string;
    shape?: string;
  };
}

interface RecetarioSelectedMedication {
  externalId: string;
  text: string;
  requiresDuplicate: boolean;
}

interface RecetarioMedicinePickerProps {
  value: RecetarioSelectedMedication | null;
  onChange: (value: RecetarioSelectedMedication | null) => void;
}

function RecetarioMedicinePicker({ value, onChange }: RecetarioMedicinePickerProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchFetcher = useFetcher<any>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch.length < 3) return;
    searchFetcher.submit(
      { intent: 'search-recetario-medications', data: JSON.stringify({ search: debouncedSearch }) },
      { method: 'post' }
    );
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const results: RecetarioMed[] = searchFetcher.data?.medications || [];
  const isLoading = searchFetcher.state !== 'idle';

  const handleSelect = useCallback(
    (med: RecetarioMed) => {
      const text = [med.brand, med.packages?.name].filter(Boolean).join(' - ') || med.drug;
      onChange({ externalId: med.packages?.externalId || '', text, requiresDuplicate: med.requiresDuplicate });
      setSearch(text);
      setOpened(false);
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setSearch('');
  }, [onChange]);

  const displayValue = value ? value.text : '';

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width="target"
      position="bottom-start"
      offset={4}
      styles={{ dropdown: { padding: 0, minWidth: '500px' } }}
    >
      <Popover.Target>
        <TextInput
          placeholder={t('common.search')}
          value={opened ? search : displayValue}
          onChange={e => {
            setSearch(e.currentTarget.value);
            if (!opened) setOpened(true);
            if (!opened || !value) {
              onChange({ externalId: '', text: e.currentTarget.value, requiresDuplicate: false });
            }
          }}
          onFocus={() => {
            setSearch(displayValue);
            setOpened(true);
          }}
          onBlur={() => setTimeout(() => setOpened(false), 150)}
          rightSection={
            value ? (
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleClear}>
                <MagnifyingGlassIcon size={14} />
              </ActionIcon>
            ) : isLoading ? (
              <Loader size="xs" />
            ) : (
              <MagnifyingGlassIcon size={14} color="gray" />
            )
          }
        />
      </Popover.Target>
      <Popover.Dropdown>
        <ScrollArea.Autosize mah={300}>
          <Box p="xs">
            {results.length === 0 && !isLoading && (
              <Text size="sm" c="dimmed" ta="center" py="sm">
                {debouncedSearch ? t('common.no_results') : t('forms.type_to_search_medications')}
              </Text>
            )}
            {results.length > 0 && (
              <Table variant="simple" verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('forms.medication_commercial_name')}</Table.Th>
                    <Table.Th>{t('forms.medication_generic_drug')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {results.map(med => (
                    <Table.Tr
                      key={med.id}
                      style={{ cursor: 'pointer' }}
                      onMouseDown={e => {
                        e.preventDefault();
                        handleSelect(med);
                      }}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {med.brand}
                        </Text>
                        {med.packages?.name && (
                          <Text size="xs" c="dimmed">
                            {med.packages.name}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{med.drug}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Box>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

const defaultMedicine = (): MedicineRow => ({
  medication: null,
  quantity: 1,
  posology: '',
  longTerm: false,
  genericOnly: false,
});

const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

export interface PrescriptionResult {
  prescriptionId: string | null;
  recetarioDocumentId: number | null;
  url: string | null;
  type: 'prescription' | 'order';
  diagnosis: string;
}

export interface RepeatData {
  diagnosis: string;
  medicines: MedicineRow[];
}

interface PrescribeModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patient?: any;
  medicId?: string;
  initialPrescriptionResult?: PrescriptionResult;
  repeatData?: RepeatData;
}

export function PrescribeModal({
  opened,
  onClose,
  onSuccess,
  patient,
  medicId,
  initialPrescriptionResult,
  repeatData,
}: PrescribeModalProps) {
  const { t } = useTranslation();
  const fetcher = useFetcher<any>();
  const patientFetcher = useFetcher<any>();
  const shareFetcher = useFetcher<any>();
  const submitting = fetcher.state !== 'idle';

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [prescriptionResult, setPrescriptionResult] = useState<PrescriptionResult | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePhoneCountry, setSharePhoneCountry] = useState('54');
  const [sharePhone, setSharePhone] = useState('');

  const [rxDiagnosisId, setRxDiagnosisId] = useState('');
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [editingRepeatDiagnosis, setEditingRepeatDiagnosis] = useState(false);
  const [orderDiagnosisId, setOrderDiagnosisId] = useState('');
  const [orderDiagnosis, setOrderDiagnosis] = useState('');

  const patientForm = useForm({
    initialValues: {
      documentValue: '',
      documentType: 'DNI',
      firstName: '',
      lastName: '',
      gender: '',
      birthDate: '',
      email: '',
      phone: '',
      medicareId: '',
      healthInsuranceName: '',
      insuranceNumber: '',
    },
    validate: {
      insuranceNumber: (v, values) => ((values as any).medicareId && !v.trim() ? t('common.required') : null),
    },
  });

  const rxForm = useForm({
    initialValues: {
      medicines: [defaultMedicine()] as MedicineRow[],
      hiv: false,
    },
    validate: {
      medicines: {
        medication: m => (!m ? t('common.required') : null),
        quantity: q => (q < 1 || q > 10 ? t('common.invalid') : null),
      },
    },
  });

  const orderForm = useForm({
    initialValues: {
      content: '',
    },
    validate: {
      content: v => (!v.trim() ? t('common.required') : null),
    },
  });

  const [rxDiagnosisError, setRxDiagnosisError] = useState('');
  const [orderDiagnosisError, setOrderDiagnosisError] = useState('');
  const [activeTab, setActiveTab] = useState('prescription');

  // Pre-fill from props synchronously (if available); fire Recetario fetch for gap-fill
  useEffect(() => {
    if (opened) {
      trackAction('Opened prescribe modal');
      if (initialPrescriptionResult) {
        setPrescriptionResult(initialPrescriptionResult);
        setStep(2);
      }
      if (patient) {
        const pd = patient.personalData || {};
        const cd = patient.contactData || {};
        const email = cd.email || '';
        patientForm.setValues({
          documentValue: pd.documentValue || '',
          documentType: pd.documentType || 'DNI',
          firstName: pd.firstName || '',
          lastName: pd.lastName || '',
          gender: ({ male: 'm', female: 'f', other: 'o' } as any)[pd.gender] || '',
          birthDate: pd.birthDate ? formatDate(pd.birthDate) : '',
          email,
          phone: (cd.phoneNumber || '').replace(/^tel:/i, ''),
          medicareId: patient.medicareId || '',
          healthInsuranceName: '',
          insuranceNumber: patient.medicareNumber || '',
        });
        setShareEmail(email);
        setSharePhone((cd.phoneNumber || '').replace(/^tel:/i, ''));
      }
      if (repeatData) {
        setRxDiagnosis(repeatData.diagnosis);
        setEditingRepeatDiagnosis(false);
        rxForm.setValues({ medicines: repeatData.medicines, hiv: false });
        setActiveTab('prescription');
        if (patient) setStep(1);
      }
      patientFetcher.submit({ intent: 'get-patient-data' }, { method: 'post' });
    }
  }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fill fields from fetcher: if no patient prop, use mhsPatientData; then gap-fill from Recetario
  useEffect(() => {
    if (patientFetcher.state !== 'idle' || !patientFetcher.data) return;
    const { recetarioData, matchedPrepagaId, mhsPatientData } = patientFetcher.data;
    if (!patient && mhsPatientData) {
      const email = mhsPatientData.email || '';
      patientForm.setValues({
        ...mhsPatientData,
        gender: ({ male: 'm', female: 'f', other: 'o' } as any)[mhsPatientData.gender] || '',
        healthInsuranceName: '',
      });
      setShareEmail(prev => prev || email);
      setSharePhone(prev => prev || mhsPatientData.phone || '');
    }
    if (!recetarioData) return;
    patientForm.setValues((prev: any) => ({
      ...prev,
      gender: prev.gender || recetarioData.gender,
      birthDate: prev.birthDate || recetarioData.birthDate,
      email: prev.email || recetarioData.email,
      phone: prev.phone || recetarioData.phone,
      insuranceNumber: prev.insuranceNumber || recetarioData.insuranceNumber,
      medicareId: prev.medicareId || matchedPrepagaId || '',
      healthInsuranceName:
        prev.medicareId || matchedPrepagaId ? prev.healthInsuranceName : recetarioData.healthInsuranceName,
    }));
    setShareEmail(prev => prev || recetarioData.email || '');
    setSharePhone(prev => prev || recetarioData.phone || '');
  }, [patientFetcher.state, patientFetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset all state when modal closes
  useEffect(() => {
    if (!opened) {
      setStep(0);
      setPrescriptionResult(null);
      setShareEmail('');
      setSharePhoneCountry('54');
      setSharePhone('');
      rxForm.reset();
      orderForm.reset();
      patientForm.reset();
      setRxDiagnosisId('');
      setRxDiagnosis('');
      setOrderDiagnosisId('');
      setOrderDiagnosis('');
      setRxDiagnosisError('');
      setOrderDiagnosisError('');
    }
  }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle prescription/order submit response
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    if (fetcher.data.success) {
      setPrescriptionResult({
        prescriptionId: fetcher.data.prescriptionId ?? null,
        recetarioDocumentId: fetcher.data.recetarioDocumentId ?? null,
        url: fetcher.data.url ?? null,
        type: fetcher.data.intent === 'create-prescription' ? 'prescription' : 'order',
        diagnosis: activeTab === 'prescription' ? rxDiagnosis : orderDiagnosis,
      });
      onSuccess();
      setStep(2);
    } else if (fetcher.data.error) {
      showNotification({ color: 'red', message: fetcher.data.error });
    }
  }, [fetcher.state, fetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle share response
  useEffect(() => {
    if (shareFetcher.state !== 'idle' || !shareFetcher.data) return;
    if (shareFetcher.data.success) {
      showNotification({ color: 'green', message: t('recetario.share_success') });
    }
  }, [shareFetcher.state, shareFetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNextStep = () => {
    if (!patientForm.validate().hasErrors) setStep(1);
  };

  const handlePrescriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rxErrors = rxForm.validate();
    if (!rxDiagnosis.trim()) {
      setRxDiagnosisError(t('common.required'));
      return;
    }
    setRxDiagnosisError('');
    if (rxErrors.hasErrors) return;

    const medications = rxForm.values.medicines.map(m => ({
      externalId: m.medication?.externalId || undefined,
      text: m.medication?.text || '',
      requiresDuplicate: m.medication?.requiresDuplicate || false,
      quantity: m.quantity,
      posology: m.posology,
      longTermTreatment: m.longTerm,
      genericOnly: m.genericOnly,
    }));

    const healthInsuranceName = patientForm.values.medicareId ? patientForm.values.healthInsuranceName : 'PARTICULAR';

    fetcher.submit(
      {
        intent: 'create-prescription',
        data: JSON.stringify({
          diagnosis: rxDiagnosis,
          medications,
          hiv: rxForm.values.hiv,
          patientData: { ...patientForm.values, healthInsuranceName },
          ...(patient?.id && { patientId: patient.id }),
          ...(medicId && { medicId }),
        }),
      },
      { method: 'post' }
    );
  };

  const handleOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orderErrors = orderForm.validate();
    if (!orderDiagnosis.trim()) {
      setOrderDiagnosisError(t('common.required'));
      return;
    }
    setOrderDiagnosisError('');
    if (orderErrors.hasErrors) return;

    const healthInsuranceName = patientForm.values.medicareId ? patientForm.values.healthInsuranceName : 'PARTICULAR';

    fetcher.submit(
      {
        intent: 'create-order',
        data: JSON.stringify({
          diagnosis: orderDiagnosis,
          content: orderForm.values.content,
          patientData: { ...patientForm.values, healthInsuranceName },
          ...(patient?.id && { patientId: patient.id }),
          ...(medicId && { medicId }),
        }),
      },
      { method: 'post' }
    );
  };

  const handleShareEmail = () => {
    if (!prescriptionResult || !shareEmail.trim()) return;
    shareFetcher.submit(
      {
        intent: 'share-prescription',
        data: JSON.stringify({
          prescriptionId: prescriptionResult.prescriptionId,
          shareChannel: 'email',
          shareRecipient: shareEmail,
          pdfUrl: prescriptionResult.url,
        }),
      },
      { method: 'post' }
    );
  };

  const handleShareWhatsApp = () => {
    if (!prescriptionResult || !sharePhone.trim()) return;
    const digits = sharePhone.replace(/[^0-9]/g, '');
    const fullPhone = sharePhoneCountry === '54' ? `549${digits}` : sharePhoneCountry + digits;
    shareFetcher.submit(
      {
        intent: 'share-prescription',
        data: JSON.stringify({
          prescriptionId: prescriptionResult.prescriptionId,
          shareChannel: 'whatsapp',
          shareRecipient: fullPhone,
          pdfUrl: prescriptionResult.url,
        }),
      },
      { method: 'post' }
    );
  };

  const addMedicine = () => {
    if (rxForm.values.medicines.length < 3) {
      rxForm.insertListItem('medicines', defaultMedicine());
    }
  };

  const removeMedicine = (index: number) => {
    rxForm.removeListItem('medicines', index);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      styles={{
        header: { position: 'absolute', right: 0 },
        body: { paddingTop: '1rem' },
      }}
    >
      <Stepper active={step} mb="xl" size="sm" mr="3rem">
        <Stepper.Step label={t('recetario.step_patient')} />
        <Stepper.Step label={t('recetario.step_form')} />
        <Stepper.Step label={t('recetario.step_share')} />
      </Stepper>

      {/* Step 0 — Patient & Insurance */}
      {step === 0 && (
        <Stack gap="sm">
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label={t('recetario.document_value')} {...patientForm.getInputProps('documentValue')} />
            <Select
              label={t('recetario.gender')}
              data={[
                { value: 'm', label: t('recetario.gender_male') },
                { value: 'f', label: t('recetario.gender_female') },
                { value: 'o', label: t('recetario.gender_other') },
              ]}
              {...patientForm.getInputProps('gender')}
            />
            <TextInput
              label={t('recetario.birth_date')}
              placeholder="YYYY-MM-DD"
              {...patientForm.getInputProps('birthDate')}
            />
            <PrepagaSelector
              label={t('recetario.health_insurance_name')}
              value={patientForm.values.medicareId}
              variant="default"
              onChange={id => {
                patientForm.setFieldValue('medicareId', id);
                if (!id) {
                  patientForm.setFieldValue('healthInsuranceName', '');
                  patientForm.setFieldValue('insuranceNumber', '');
                }
              }}
              onSelectPrepaga={p => {
                patientForm.setFieldValue(
                  'healthInsuranceName',
                  (p as any).recetarioHealthInsuranceName || (p as any).shortName
                );
              }}
            />
            <TextInput
              label={t('recetario.insurance_number')}
              disabled={!patientForm.values.medicareId}
              required={!!patientForm.values.medicareId}
              {...patientForm.getInputProps('insuranceNumber')}
            />
            <TextInput label={t('recetario.email')} {...patientForm.getInputProps('email')} />
            <TextInput label={t('recetario.phone')} {...patientForm.getInputProps('phone')} />
          </SimpleGrid>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleNextStep}>{t('common.next')}</Button>
          </Group>
        </Stack>
      )}

      {/* Step 1 — Prescription / Order */}
      {step === 1 && (
        <>
          {!repeatData && (
            <SegmentedControl
              value={activeTab}
              onChange={setActiveTab}
              mb="md"
              w="300px"
              data={[
                { label: t('recetario.type_prescription'), value: 'prescription' },
                { label: t('recetario.type_order'), value: 'order' },
              ]}
            />
          )}

          {activeTab === 'prescription' && (
            <form onSubmit={handlePrescriptionSubmit}>
              <Stack gap="md">
                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    {t('recetario.diagnosis')} <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>
                  </Text>
                  {repeatData && !editingRepeatDiagnosis ? (
                    <Group gap="xs">
                      <TextInput value={rxDiagnosis} readOnly variant="default" style={{ flex: 1 }} />
                      <ActionIcon variant="subtle" color="gray" onClick={() => setEditingRepeatDiagnosis(true)}>
                        <PencilIcon size={16} />
                      </ActionIcon>
                    </Group>
                  ) : (
                    <Icd10Selector
                      value={rxDiagnosisId}
                      onChange={v => {
                        const id = Array.isArray(v) ? v[0] || '' : v;
                        setRxDiagnosisId(id);
                        if (!id) setRxDiagnosis('');
                      }}
                      onSelectNode={node => setRxDiagnosis(`${node.id} - ${node.name}`)}
                      error={rxDiagnosisError}
                      variant="default"
                      autoFocus={editingRepeatDiagnosis}
                    />
                  )}
                </Box>

                <Stack gap="xs">
                  {rxForm.values.medicines.map((_, index) => (
                    <Group key={index} align="flex-start" gap="xs">
                      <Box style={{ flex: 2, minWidth: 0 }}>
                        <Text size="sm" fw={500} mb="0.3em">
                          {t('recetario.medicines')}
                        </Text>
                        <RecetarioMedicinePicker
                          value={rxForm.values.medicines[index].medication}
                          onChange={val => rxForm.setFieldValue(`medicines.${index}.medication`, val)}
                        />
                        {rxForm.errors[`medicines.${index}.medication`] && (
                          <Text size="xs" c="red" mt={2}>
                            {rxForm.errors[`medicines.${index}.medication`]}
                          </Text>
                        )}
                      </Box>
                      <NumberInput
                        style={{ width: 72 }}
                        min={1}
                        max={10}
                        label={t('recetario.quantity')}
                        {...rxForm.getInputProps(`medicines.${index}.quantity`)}
                      />
                      <TextInput
                        style={{ flex: 1 }}
                        label={t('recetario.posology')}
                        {...rxForm.getInputProps(`medicines.${index}.posology`)}
                      />
                      <Stack gap={4} mt={24}>
                        <Checkbox
                          label={t('recetario.long_term')}
                          size="xs"
                          {...rxForm.getInputProps(`medicines.${index}.longTerm`, { type: 'checkbox' })}
                        />
                        <Checkbox
                          label={t('recetario.generic_only')}
                          size="xs"
                          {...rxForm.getInputProps(`medicines.${index}.genericOnly`, { type: 'checkbox' })}
                        />
                      </Stack>
                      {rxForm.values.medicines.length > 1 && (
                        <ActionIcon color="red" variant="subtle" mt={24} onClick={() => removeMedicine(index)}>
                          <TrashIcon size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  ))}
                  {rxForm.values.medicines.length < 3 && (
                    <Button
                      variant="subtle"
                      size="xs"
                      leftSection={<PlusIcon size={14} />}
                      onClick={addMedicine}
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {t('recetario.add_medicine')}
                    </Button>
                  )}
                </Stack>

                <Checkbox label={t('recetario.hiv')} {...rxForm.getInputProps('hiv', { type: 'checkbox' })} />

                <Group justify="flex-end" mt="sm">
                  <Button
                    variant="default"
                    onClick={repeatData && patient ? onClose : () => setStep(0)}
                    disabled={submitting}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" loading={submitting}>
                    {t('recetario.prescribe')}
                  </Button>
                </Group>
              </Stack>
            </form>
          )}

          {activeTab === 'order' && (
            <form onSubmit={handleOrderSubmit}>
              <Stack gap="md">
                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    {t('recetario.diagnosis')} <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>
                  </Text>
                  <Icd10Selector
                    value={orderDiagnosisId}
                    onChange={v => {
                      const id = Array.isArray(v) ? v[0] || '' : v;
                      setOrderDiagnosisId(id);
                      if (!id) setOrderDiagnosis('');
                    }}
                    onSelectNode={node => setOrderDiagnosis(`${node.id} - ${node.name}`)}
                    error={orderDiagnosisError}
                    variant="default"
                  />
                </Box>
                <Textarea
                  label={t('recetario.order_content')}
                  required
                  minRows={2}
                  autosize
                  {...orderForm.getInputProps('content')}
                />
                <Group justify="flex-end" mt="sm">
                  <Button variant="default" onClick={() => setStep(0)} disabled={submitting}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" loading={submitting}>
                    {t('recetario.create_order')}
                  </Button>
                </Group>
              </Stack>
            </form>
          )}
        </>
      )}

      {/* Step 2 — Confirmation & Share */}
      {step === 2 && prescriptionResult && (
        <Stack gap="md">
          <Text fw={600} c="green" size="lg">
            {t(
              prescriptionResult.type === 'prescription' ? 'recetario.prescription_success' : 'recetario.order_success'
            )}
          </Text>
          <Text size="sm" c="dimmed">
            {prescriptionResult.diagnosis}
          </Text>
          {prescriptionResult.url && (
            <Anchor href={prescriptionResult.url} target="_blank" size="sm">
              {t('recetario.view_pdf')}
            </Anchor>
          )}

          <Divider label={t('recetario.send_via')} labelPosition="center" mt="sm" />

          <Group align="flex-end" gap="xs">
            <TextInput
              style={{ flex: 1 }}
              label={t('recetario.send_email_recipient')}
              value={shareEmail}
              onChange={e => setShareEmail(e.currentTarget.value)}
            />
            <Button loading={shareFetcher.state !== 'idle'} disabled={!shareEmail.trim()} onClick={handleShareEmail}>
              {t('recetario.share_email')}
            </Button>
          </Group>

          <Group align="flex-end" gap="xs">
            <Select
              style={{ width: 100 }}
              label={t('recetario.phone_recipient')}
              data={COUNTRY_PHONE_OPTIONS}
              value={sharePhoneCountry}
              onChange={v => setSharePhoneCountry(v || '54')}
              searchable
              allowDeselect={false}
            />
            <TextInput
              style={{ flex: 1 }}
              placeholder={formatPhoneForDisplay('1112345678', sharePhoneCountry)}
              value={formatPhoneForDisplay(sharePhone, sharePhoneCountry)}
              onChange={e => setSharePhone(e.currentTarget.value.replace(/[^0-9]/g, ''))}
            />
            <Button loading={shareFetcher.state !== 'idle'} disabled={!sharePhone.trim()} onClick={handleShareWhatsApp}>
              {t('recetario.share_whatsapp')}
            </Button>
          </Group>

          <Group gap="xs">
            {(['send_sms', 'send_telegram'] as const).map(key => (
              <Tooltip key={key} label={t('recetario.coming_soon')}>
                <Button variant="default" disabled style={{ pointerEvents: 'none' }}>
                  {t(`recetario.${key}`)}
                </Button>
              </Tooltip>
            ))}
          </Group>

          <Group justify="flex-end" mt="sm">
            <Button
              onClick={() => {
                onSuccess();
                onClose();
              }}
            >
              {t('common.close')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
