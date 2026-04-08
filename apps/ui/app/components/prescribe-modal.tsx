import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  Stepper,
  SegmentedControl,
  NumberInput,
  Checkbox,
  Button,
  Group,
  Stack,
  ActionIcon,
  Text,
  Box,
  TextInput,
  SimpleGrid,
  Select,
  Divider,
  Anchor,
  Tooltip,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { useFetcher } from '@remix-run/react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TrashIcon, PencilIcon, WarningIcon } from '@phosphor-icons/react';
import { DateInput } from '@mantine/dates';
import dayjs from 'dayjs';

import { Icd10Selector } from '~/components/icd10-selector';
import { HighlightedTextarea } from '~/components/highlighted-textarea';
import { PrepagaSelector } from '~/components/prepaga-selector';
import {
  PracticeSelector,
  resolvePractice,
  applyPracticesToContent,
  detectSelectedFromContent,
  clearEditedPracticeLines,
  practiceLine,
  type Practice,
  type PracticeCodeRecord,
  type ResolvedPractice,
} from '~/components/practice-selector';
import PatientSearch from '~/components/patient-search';
import { useFeathers, useGet } from '~/components/provider';
import { RecetarioInsuranceSelector } from '~/components/recetario-insurance-selector';
import { matchInsurance, type RecetarioInsurance } from '~/utils/match-insurance';
import { trackAction } from '~/utils/breadcrumbs';
import {
  COUNTRY_PHONE_OPTIONS,
  formatPhoneForDisplay,
  formatDate,
  parseDate,
  defaultMedicine,
  type MedicineRow,
  type RecetarioSelectedMedication,
} from '~/components/prescribe-utils';
import { RecetarioMedicinePicker } from '~/components/recetario-medicine-picker';

export interface PrescriptionResult {
  prescriptionId: string | null;
  recetarioDocumentId: number | null;
  url: string | null;
  type: 'prescription' | 'order';
  diagnosis: string;
}

export interface RepeatData {
  type: 'prescription' | 'order';
  diagnosis: string;
  medicines?: MedicineRow[];
  orderContent?: string;
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
  const updatePatientFetcher = useFetcher<any>();
  const feathersClient = useFeathers();
  const submitting = fetcher.state !== 'idle';

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [prescriptionResult, setPrescriptionResult] = useState<PrescriptionResult | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePhoneCountry, setSharePhoneCountry] = useState('54');
  const [sharePhone, setSharePhone] = useState('');

  const [rxDiagnosisId, setRxDiagnosisId] = useState('');
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [editingRepeatDiagnosis, setEditingRepeatDiagnosis] = useState(false);
  const [editingRepeatOrderDiagnosis, setEditingRepeatOrderDiagnosis] = useState(false);
  const [orderDiagnosisId, setOrderDiagnosisId] = useState('');
  const [orderDiagnosis, setOrderDiagnosis] = useState('');
  const [missingPatientFields, setMissingPatientFields] = useState<Set<string>>(new Set());

  // Recetario insurance matching state
  const [recetarioInsurances, setRecetarioInsurances] = useState<RecetarioInsurance[]>([]);
  const [insuranceMatchStatus, setInsuranceMatchStatus] = useState<
    'idle' | 'loading' | 'exact' | 'partial' | 'none' | 'resolved'
  >('idle');
  const [insuranceMatchName, setInsuranceMatchName] = useState('');

  const patientForm = useForm({
    initialValues: {
      documentValue: '',
      documentType: 'DNI',
      firstName: '',
      lastName: '',
      gender: '',
      birthDate: null as Date | null,
      email: '',
      phone: '',
      medicareId: '',
      healthInsuranceName: '',
      insuranceNumber: '',
    },
    validate: {
      insuranceNumber: (v, values) => {
        const hasInsurance = (values as any).medicareId && (values as any).healthInsuranceName !== 'PARTICULAR';
        return hasInsurance && !v.trim() ? t('common.required') : null;
      },
    },
  });

  const rxForm = useForm({
    initialValues: {
      medicines: [defaultMedicine()] as MedicineRow[],
      hiv: false,
    },
    validate: {
      medicines: {
        medication: m => (!m || !m.text?.trim() ? t('common.required') : null),
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
  const [prescriptionDate, setPrescriptionDate] = useState<Date | null>(new Date());

  // Practices state for order tab
  const [practices, setPractices] = useState<Practice[]>([]);
  const [practiceCodes, setPracticeCodes] = useState<PracticeCodeRecord[]>([]);
  const [selectedPractices, setSelectedPractices] = useState<ResolvedPractice[]>([]);
  const [practicesLoaded, setPracticesLoaded] = useState(false);

  const { data: selectedInsurer } = useGet('prepagas', patientForm.values.medicareId, {
    enabled: !!patientForm.values.medicareId,
  });
  const insurerShortName = (selectedInsurer as any)?.shortName || '';

  const fillPatientForm = useCallback((p: any) => {
    const pd = p.personalData || {};
    const cd = p.contactData || {};
    const email = cd.email || '';
    const phone = (String(cd.phoneNumber) || '').replace(/^tel:/i, '');
    const values = {
      documentValue: pd.documentValue || '',
      documentType: pd.documentType || 'DNI',
      firstName: pd.firstName || '',
      lastName: pd.lastName || '',
      gender: ({ male: 'm', female: 'f', other: 'o' } as any)[pd.gender] || pd.gender || '',
      birthDate: parseDate(pd.birthDate),
      email,
      phone,
      medicareId: p.medicareId || '',
      healthInsuranceName: '',
      insuranceNumber: p.medicareNumber || '',
    };
    patientForm.setValues(values);
    const missing = new Set<string>();
    for (const key of ['documentValue', 'gender', 'birthDate', 'email', 'phone'] as const) {
      if (!values[key]) missing.add(key);
    }
    setMissingPatientFields(missing);
    setShareEmail(email);
    setSharePhone(phone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill from props synchronously (if available)
  useEffect(() => {
    if (opened) {
      trackAction('Opened prescribe modal');
      // Fetch Recetario insurance list (if not already loaded)
      if (recetarioInsurances.length === 0) {
        feathersClient
          .service('recetario' as any)
          .create({ action: 'sync-insurances' })
          .then((res: any) => {
            if (res?.insurances) setRecetarioInsurances(res.insurances);
          })
          .catch(() => {
            // non-fatal — matching will be unavailable
          });
      }
      if (initialPrescriptionResult) {
        setPrescriptionResult(initialPrescriptionResult);
        setStep(2);
      }
      if (patient) {
        fillPatientForm(patient);
        setSelectedPatientId(patient.id);
        patientFetcher.submit(
          { intent: 'get-patient-data', data: JSON.stringify({ patientId: patient.id }) },
          { method: 'post' }
        );
      }
      if (repeatData) {
        if (repeatData.type === 'order') {
          setOrderDiagnosis(repeatData.diagnosis);
          setEditingRepeatOrderDiagnosis(false);
          orderForm.setFieldValue('content', repeatData.orderContent || '');
          setActiveTab('order');
        } else {
          setRxDiagnosis(repeatData.diagnosis);
          setEditingRepeatDiagnosis(false);
          rxForm.setValues({ medicines: repeatData.medicines || [defaultMedicine()], hiv: false });
          setActiveTab('prescription');
        }
      }
    }
  }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run insurance matching when a prepaga is selected
  const handlePrepagaSelected = useCallback(
    (prepaga: { id: string; shortName: string; recetarioHealthInsuranceName?: string | null }) => {
      // Already mapped → use it directly
      if (prepaga.recetarioHealthInsuranceName) {
        patientForm.setFieldValue('healthInsuranceName', prepaga.recetarioHealthInsuranceName);
        setInsuranceMatchStatus('resolved');
        setInsuranceMatchName(prepaga.recetarioHealthInsuranceName);
        return;
      }

      // Insurance list not loaded yet — defer matching
      if (recetarioInsurances.length === 0) {
        patientForm.setFieldValue('healthInsuranceName', prepaga.shortName);
        setInsuranceMatchStatus('loading');
        return;
      }

      const result = matchInsurance(prepaga.shortName, recetarioInsurances);
      if (result.matchType === 'exact' && result.matchedName) {
        patientForm.setFieldValue('healthInsuranceName', result.matchedName);
        setInsuranceMatchStatus('exact');
        setInsuranceMatchName(result.matchedName);
        // Persist the mapping
        feathersClient
          .service('prepagas' as any)
          .patch(prepaga.id, { recetarioHealthInsuranceName: result.matchedName })
          .catch(() => {});
      } else if (result.matchType === 'partial' && result.matchedName) {
        setInsuranceMatchStatus('partial');
        setInsuranceMatchName(result.matchedName);
        patientForm.setFieldValue('healthInsuranceName', result.matchedName);
      } else {
        setInsuranceMatchStatus('none');
        setInsuranceMatchName('');
        patientForm.setFieldValue('healthInsuranceName', '');
      }
    },
    [recetarioInsurances, feathersClient, patientForm]
  );

  // Handle patient selected from PatientSearch
  const handlePatientSelected = useCallback(
    async (patientId: string) => {
      setSelectedPatientId(patientId);
      try {
        const p = await feathersClient.service('patients').get(patientId);
        fillPatientForm(p);
        // Trigger insurance matching if patient has a prepaga
        if (p.medicareId && p.insurer) {
          handlePrepagaSelected({
            id: p.insurer.id,
            shortName: p.insurer.shortName || p.insurer.denomination || '',
            recetarioHealthInsuranceName: p.insurer.recetarioHealthInsuranceName ?? null,
          });
        }
      } catch {
        // fallback: fetch via action for gap-fill
      }
      patientFetcher.submit({ intent: 'get-patient-data', data: JSON.stringify({ patientId }) }, { method: 'post' });
    },
    [feathersClient, fillPatientForm, patientFetcher, handlePrepagaSelected]
  );

  // Re-run matching when insurance list loads while status is 'loading'
  useEffect(() => {
    if (insuranceMatchStatus !== 'loading' || recetarioInsurances.length === 0) return;
    const medicareId = patientForm.values.medicareId;
    if (!medicareId || !selectedInsurer) return;

    const prepaga = selectedInsurer as {
      id: string;
      shortName: string;
      recetarioHealthInsuranceName?: string | null;
    };
    handlePrepagaSelected(prepaga);
  }, [recetarioInsurances, insuranceMatchStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger insurance matching when the patient's prepaga loads
  useEffect(() => {
    if (!opened || !selectedInsurer || insuranceMatchStatus !== 'idle') return;
    handlePrepagaSelected(
      selectedInsurer as {
        id: string;
        shortName: string;
        recetarioHealthInsuranceName?: string | null;
      }
    );
  }, [opened, selectedInsurer, insuranceMatchStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // For repeat: auto-advance to step 1 once insurance is resolved (or not needed)
  useEffect(() => {
    if (!opened || !repeatData || !patient || step !== 0) return;
    if (!patient.medicareId) {
      setStep(1);
      return;
    }
    if (insuranceMatchStatus === 'exact' || insuranceMatchStatus === 'resolved') {
      setStep(1);
    }
  }, [opened, repeatData, patient, step, insuranceMatchStatus]);

  // Update display value as user types in the insurance autocomplete
  const handleInsuranceInputChange = useCallback((name: string) => {
    setInsuranceMatchName(name);
  }, []);

  // Confirm insurance selection from the autocomplete dropdown
  const handleInsuranceConfirm = useCallback(
    (name: string) => {
      patientForm.setFieldValue('healthInsuranceName', name);
      setInsuranceMatchName(name);

      // Persist to the prepaga record
      const prepagaId = patientForm.values.medicareId;
      if (prepagaId && name) {
        feathersClient
          .service('prepagas' as any)
          .patch(prepagaId, { recetarioHealthInsuranceName: name })
          .catch(() => {});
        setInsuranceMatchStatus('resolved');
      }
    },
    [feathersClient, patientForm]
  );

  // Gap-fill from fetcher (mhsPatientData / recetarioData)
  useEffect(() => {
    if (patientFetcher.state !== 'idle' || !patientFetcher.data) return;
    const { recetarioData, matchedPrepagaId, mhsPatientData } = patientFetcher.data;
    const filledByGapFill: string[] = [];
    if (mhsPatientData) {
      patientForm.setValues((prev: any) => {
        const next = {
          ...prev,
          documentValue: prev.documentValue || mhsPatientData.documentValue || '',
          documentType: prev.documentType || mhsPatientData.documentType || 'DNI',
          firstName: prev.firstName || mhsPatientData.firstName || '',
          lastName: prev.lastName || mhsPatientData.lastName || '',
          gender:
            prev.gender ||
            ({ male: 'm', female: 'f', other: 'o' } as any)[mhsPatientData.gender] ||
            mhsPatientData.gender ||
            '',
          birthDate: prev.birthDate || parseDate(mhsPatientData.birthDate),
          email: prev.email || mhsPatientData.email || '',
          phone: prev.phone || mhsPatientData.phone || '',
          medicareId: prev.medicareId || mhsPatientData.medicareId || '',
          insuranceNumber: prev.insuranceNumber || mhsPatientData.insuranceNumber || '',
        };
        for (const key of ['documentValue', 'gender', 'birthDate', 'email', 'phone']) {
          if (!prev[key] && next[key]) filledByGapFill.push(key);
        }
        return next;
      });
      setShareEmail(prev => prev || mhsPatientData.email || '');
      setSharePhone(prev => prev || mhsPatientData.phone || '');
    }
    if (recetarioData) {
      patientForm.setValues((prev: any) => {
        const next = {
          ...prev,
          gender: prev.gender || recetarioData.gender,
          birthDate: prev.birthDate || parseDate(recetarioData.birthDate),
          email: prev.email || recetarioData.email,
          phone: prev.phone || recetarioData.phone,
          insuranceNumber: prev.insuranceNumber || recetarioData.insuranceNumber,
          medicareId: prev.medicareId || matchedPrepagaId || '',
          healthInsuranceName:
            prev.medicareId || matchedPrepagaId ? prev.healthInsuranceName : recetarioData.healthInsuranceName,
        };
        for (const key of ['documentValue', 'gender', 'birthDate', 'email', 'phone']) {
          if (!prev[key] && next[key]) filledByGapFill.push(key);
        }
        return next;
      });
      setShareEmail(prev => prev || recetarioData.email || '');
      setSharePhone(prev => prev || recetarioData.phone || '');
    }
    if (filledByGapFill.length > 0) {
      setMissingPatientFields(prev => {
        const next = new Set(prev);
        for (const key of filledByGapFill) next.delete(key);
        return next;
      });
    }
  }, [patientFetcher.state, patientFetcher.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch practices and accounting settings when entering step 1
  useEffect(() => {
    if (step !== 1 || practicesLoaded) return;
    let cancelled = false;

    const fetchPractices = async () => {
      try {
        const codesQuery: Record<string, any> = { $limit: 500 };
        if (medicId) codesQuery.userId = medicId;
        const [practicesRes, codesRes] = await Promise.all([
          feathersClient.service('practices' as any).find({ query: { $limit: 200 } }),
          feathersClient.service('practice-codes' as any).find({ query: codesQuery }),
        ]);
        if (cancelled) return;

        const practicesList = Array.isArray(practicesRes) ? practicesRes : (practicesRes as any)?.data || [];
        const codesList = Array.isArray(codesRes) ? codesRes : (codesRes as any)?.data || [];

        setPractices(practicesList);
        setPracticeCodes(codesList);
        setPracticesLoaded(true);
      } catch (err) {
        console.error('[PrescribeModal] Failed to fetch practices:', err);
      }
    };

    fetchPractices();
    return () => {
      cancelled = true;
    };
  }, [step, practicesLoaded, feathersClient, medicId]);

  const handleAddPractice = useCallback(
    (practiceId: string) => {
      const rp = resolvePractice(practiceId, practices, practiceCodes, patientForm.values.medicareId || undefined);
      if (!rp) return;
      const prev = selectedPractices;
      const next = [...prev, rp];
      setSelectedPractices(next);
      orderForm.setFieldValue('content', applyPracticesToContent(orderForm.values.content, prev, next));
    },
    [practices, practiceCodes, patientForm.values.medicareId, selectedPractices, orderForm]
  );

  const handleRemovePractice = useCallback(
    (practiceId: string) => {
      const prev = selectedPractices;
      const next = prev.filter(rp => rp.practice.id !== practiceId);
      setSelectedPractices(next);
      orderForm.setFieldValue('content', applyPracticesToContent(orderForm.values.content, prev, next));
    },
    [selectedPractices, orderForm]
  );

  // When user edits textarea, detect if any practice lines were modified and clear them
  const handleContentChange = useCallback(
    (value: string) => {
      const cleaned = clearEditedPracticeLines(value, selectedPractices);
      const detected = detectSelectedFromContent(
        cleaned,
        practices,
        practiceCodes,
        patientForm.values.medicareId || undefined
      );
      setSelectedPractices(detected);
      orderForm.setFieldValue('content', cleaned);
    },
    [practices, practiceCodes, patientForm.values.medicareId, orderForm, selectedPractices]
  );

  const highlightedLines = useMemo(() => new Set(selectedPractices.map(rp => practiceLine(rp))), [selectedPractices]);

  // Reset all state when modal closes
  useEffect(() => {
    if (!opened) {
      setStep(0);
      setSelectedPatientId(null);
      setPrescriptionResult(null);
      setMissingPatientFields(new Set());
      setPrescriptionDate(new Date());
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
      setEditingRepeatDiagnosis(false);
      setEditingRepeatOrderDiagnosis(false);
      setSelectedPractices([]);
      setPracticesLoaded(false);
      setInsuranceMatchStatus('idle');
      setInsuranceMatchName('');
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

  const handleNextStep = useCallback(() => {
    if (patientForm.validate().hasErrors) return;

    // Auto-confirm partial insurance match on Next
    if (insuranceMatchStatus === 'partial' && insuranceMatchName) {
      handleInsuranceConfirm(insuranceMatchName);
    }

    // Patch patient with form data (only fields the form manages)
    const pv = patientForm.values;
    const patientId = selectedPatientId || patient?.id;
    if (patientId) {
      const genderMap: Record<string, string> = { m: 'male', f: 'female', o: 'other' };
      updatePatientFetcher.submit(
        {
          intent: 'update-patient-data',
          data: JSON.stringify({
            patientId,
            personalData: {
              gender: genderMap[pv.gender] || pv.gender || undefined,
              birthDate: pv.birthDate ? formatDate(pv.birthDate) : undefined,
              documentValue: pv.documentValue || undefined,
            },
            contactData: {
              email: pv.email || undefined,
              phoneNumber: pv.phone ? `tel:${pv.phone}` : undefined,
            },
            medicareId: pv.medicareId || undefined,
            medicareNumber: pv.insuranceNumber || undefined,
          }),
        },
        { method: 'post' }
      );
    }

    setStep(1);
  }, [
    patientForm,
    selectedPatientId,
    patient,
    updatePatientFetcher,
    insuranceMatchStatus,
    insuranceMatchName,
    handleInsuranceConfirm,
  ]);

  const handlePrescriptionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rxErrors = rxForm.validate();
    if (!rxDiagnosis.trim()) {
      setRxDiagnosisError(t('common.required'));
      return;
    }
    setRxDiagnosisError('');
    if (rxErrors.hasErrors) return;

    const hasExternal = rxForm.values.medicines.some(m => m.medication?.externalId);
    const hasFreeText = rxForm.values.medicines.some(m => !m.medication?.externalId);
    if (hasExternal && hasFreeText) {
      showNotification({
        color: 'red',
        message: t('recetario.mixed_medicines_error'),
      });
      return;
    }

    const medications = rxForm.values.medicines.map(m => {
      const baseText = m.medication?.text || '';
      const qty = m.quantity;
      const spanishNum =
        ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][qty] || String(qty);
      const qtyLabel = qty === 1 ? `(${qty} = ${spanishNum} caja)` : `(${qty} = ${spanishNum} cajas)`;
      const text = `${baseText} ${qtyLabel}`.trim();
      return {
        externalId: m.medication?.externalId || undefined,
        text,
        requiresDuplicate: m.medication?.requiresDuplicate || false,
        quantity: m.quantity,
        posology: m.posology,
        longTermTreatment: m.longTerm,
        genericOnly: m.genericOnly,
      };
    });

    const healthInsuranceName = patientForm.values.medicareId ? patientForm.values.healthInsuranceName : 'PARTICULAR';

    fetcher.submit(
      {
        intent: 'create-prescription',
        data: JSON.stringify({
          diagnosis: rxDiagnosis,
          medications,
          hiv: rxForm.values.hiv,
          date: prescriptionDate ? dayjs(prescriptionDate).format('YYYY-MM-DD') : undefined,
          patientData: {
            ...patientForm.values,
            healthInsuranceName,
            birthDate: formatDate(patientForm.values.birthDate) || undefined,
          },
          ...((selectedPatientId || patient?.id) && { patientId: selectedPatientId || patient?.id }),
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
          date: prescriptionDate ? dayjs(prescriptionDate).format('YYYY-MM-DD') : undefined,
          patientData: {
            ...patientForm.values,
            healthInsuranceName,
            birthDate: formatDate(patientForm.values.birthDate) || undefined,
          },
          ...((selectedPatientId || patient?.id) && { patientId: selectedPatientId || patient?.id }),
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
      {step === 0 &&
        (() => {
          const pv = patientForm.values;
          const hasPatient = !!selectedPatientId || !!patient;
          const showDocumentValue = missingPatientFields.has('documentValue');
          const showGender = missingPatientFields.has('gender');
          const showBirthDate = missingPatientFields.has('birthDate');
          const showEmail = missingPatientFields.has('email');
          const showPhone = missingPatientFields.has('phone');
          const hasMissingFields = showDocumentValue || showGender || showBirthDate || showEmail || showPhone;

          return (
            <Stack gap="sm">
              {!patient && (
                <PatientSearch
                  label={t('recetario.patient')}
                  onChange={handlePatientSelected}
                  autoFocus
                  variant="default"
                />
              )}

              {hasPatient && (
                <>
                  {pv.firstName && (
                    <Text fw={500} size="sm">
                      {pv.firstName} {pv.lastName}
                      {pv.documentValue ? ` — ${pv.documentValue}` : ''}
                    </Text>
                  )}

                  {hasMissingFields && (
                    <SimpleGrid cols={2} spacing="sm">
                      {showDocumentValue && (
                        <TextInput
                          label={t('recetario.document_value')}
                          required
                          {...patientForm.getInputProps('documentValue')}
                        />
                      )}
                      {showGender && (
                        <Select
                          label={t('recetario.gender')}
                          required
                          data={[
                            { value: 'm', label: t('recetario.gender_male') },
                            { value: 'f', label: t('recetario.gender_female') },
                            { value: 'o', label: t('recetario.gender_other') },
                          ]}
                          {...patientForm.getInputProps('gender')}
                        />
                      )}
                      {showBirthDate && (
                        <DateInput
                          label={t('recetario.birth_date')}
                          required
                          valueFormat="YYYY-MM-DD"
                          clearable
                          {...patientForm.getInputProps('birthDate')}
                        />
                      )}
                      {showEmail && <TextInput label={t('recetario.email')} {...patientForm.getInputProps('email')} />}
                      {showPhone && <TextInput label={t('recetario.phone')} {...patientForm.getInputProps('phone')} />}
                    </SimpleGrid>
                  )}

                  <SimpleGrid cols={2} spacing="sm">
                    <PrepagaSelector
                      label={t('recetario.health_insurance_name')}
                      value={pv.medicareId}
                      variant="default"
                      onChange={id => {
                        patientForm.setFieldValue('medicareId', id);
                        if (!id) {
                          patientForm.setFieldValue('healthInsuranceName', '');
                          patientForm.setFieldValue('insuranceNumber', '');
                          setInsuranceMatchStatus('idle');
                          setInsuranceMatchName('');
                        }
                      }}
                      onSelectPrepaga={p => {
                        handlePrepagaSelected(
                          p as {
                            id: string;
                            shortName: string;
                            recetarioHealthInsuranceName?: string | null;
                          }
                        );
                      }}
                    />
                    {!!pv.medicareId && (
                      <TextInput
                        label={t('recetario.insurance_number')}
                        required={pv.healthInsuranceName !== 'PARTICULAR'}
                        {...patientForm.getInputProps('insuranceNumber')}
                      />
                    )}
                  </SimpleGrid>

                  {insuranceMatchStatus === 'partial' && (
                    <Alert
                      color="yellow"
                      icon={<WarningIcon size={16} />}
                      title={t('recetario.partial_insurance_match_title')}
                    >
                      {t('recetario.partial_insurance_match', { matchedName: insuranceMatchName })}
                      <RecetarioInsuranceSelector
                        insurances={recetarioInsurances}
                        value={insuranceMatchName}
                        onChange={handleInsuranceInputChange}
                        onSelect={handleInsuranceConfirm}
                      />
                    </Alert>
                  )}

                  {insuranceMatchStatus === 'none' && (
                    <Alert
                      color="orange"
                      icon={<WarningIcon size={16} />}
                      title={t('recetario.no_insurance_match_title')}
                    >
                      {t('recetario.no_insurance_match', { shortName: insurerShortName })}
                      <RecetarioInsuranceSelector
                        insurances={recetarioInsurances}
                        value={insuranceMatchName}
                        onChange={handleInsuranceInputChange}
                        onSelect={handleInsuranceConfirm}
                      />
                    </Alert>
                  )}
                </>
              )}

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={onClose}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleNextStep} disabled={!hasPatient || insuranceMatchStatus === 'none'}>
                  {t('common.next')}
                </Button>
              </Group>
            </Stack>
          );
        })()}

      {/* Step 1 — Prescription / Order */}
      {step === 1 && (
        <>
          <Group gap="md" mb="md" align="flex-end">
            {!repeatData && (
              <SegmentedControl
                value={activeTab}
                onChange={setActiveTab}
                w="300px"
                data={[
                  { label: t('recetario.type_prescription'), value: 'prescription' },
                  { label: t('recetario.type_order'), value: 'order' },
                ]}
              />
            )}
            <DateInput
              label={t('common.date')}
              required
              valueFormat="DD/MM/YYYY"
              value={prescriptionDate}
              onChange={v => setPrescriptionDate(v as Date | null)}
              minDate={new Date()}
              w={160}
              ml="auto"
            />
          </Group>

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
                  {repeatData && repeatData.type === 'order' && !editingRepeatOrderDiagnosis ? (
                    <Group gap="xs">
                      <TextInput value={orderDiagnosis} readOnly variant="default" style={{ flex: 1 }} />
                      <ActionIcon variant="subtle" color="gray" onClick={() => setEditingRepeatOrderDiagnosis(true)}>
                        <PencilIcon size={16} />
                      </ActionIcon>
                    </Group>
                  ) : (
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
                      autoFocus={editingRepeatOrderDiagnosis}
                    />
                  )}
                </Box>
                {practices.length > 0 && (
                  <PracticeSelector
                    practices={practices}
                    codes={practiceCodes}
                    insurerId={patientForm.values.medicareId || undefined}
                    insurerName={insurerShortName || undefined}
                    selected={selectedPractices}
                    onAdd={handleAddPractice}
                    onRemove={handleRemovePractice}
                    max={3}
                  />
                )}
                <HighlightedTextarea
                  label={t('recetario.order_content')}
                  required
                  minRows={2}
                  value={orderForm.values.content}
                  onChange={handleContentChange}
                  highlightLines={highlightedLines}
                  error={orderForm.errors.content}
                />
                <Group justify="flex-end" mt="sm">
                  <Button
                    variant="default"
                    onClick={repeatData && patient ? onClose : () => setStep(0)}
                    disabled={submitting}
                  >
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
