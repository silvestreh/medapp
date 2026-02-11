import { Checkbox, Stack, Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FieldRow,
  FormCard,
  FormContainer,
  Label,
  FormHeader,
  StyledTextInput,
  StyledTextarea,
  StyledTitle,
  StyledSelect,
  StyledDateInput,
  IndentedSection,
} from './styles';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

interface HabitsFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function HabitsForm({ initialData, onChange, readOnly }: HabitsFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = (data?: HabitsFormProps['initialData']) => {
    const values = data?.values || {};
    return {
      alimentacion_cantidad: values.alimentacion_cantidad || '',
      alimentacion_calidad: values.alimentacion_calidad || '',
      dieta_toggle: values.dieta_toggle === 'on',
      dieta_cumple: values.dieta_cumple || '',
      dieta_baja_sodio: values.dieta_baja_sodio === 'on',
      dieta_baja_calorias: values.dieta_baja_calorias === 'on',
      dieta_baja_hidratos: values.dieta_baja_hidratos === 'on',
      dieta_baja_grasas: values.dieta_baja_grasas === 'on',
      alcohol: values.alcohol || '',
      alcohol_cerveza: values.alcohol_cerveza === 'on',
      alcohol_vino: values.alcohol_vino === 'on',
      alcohol_whisky: values.alcohol_whisky === 'on',
      alcohol_otras: values.alcohol_otras === 'on',
      fuma_toggle: values.fuma_toggle === 'on',
      fuma_desde: values.fuma_desde ? dayjs(values.fuma_desde, ['YYYY', 'DD/MM/YYYY']).toDate() : null,
      fuma_hasta: values.fuma_hasta ? dayjs(values.fuma_hasta, ['YYYY', 'DD/MM/YYYY']).toDate() : null,
      fuma_cantidad: values.fuma_cantidad || '',
      infusiones: values.infusiones || '',
      infusiones_te: values.infusiones_te === 'on',
      infusiones_cafe: values.infusiones_cafe === 'on',
      infusiones_mate: values.infusiones_mate === 'on',
      infusiones_hierbas: values.infusiones_hierbas === 'on',
      infusiones_otras: values.infusiones_otras === 'on',
      sal: values.sal || '',
      actividad_fisica: values.actividad_fisica || '',
      trabajo_tipo: values.trabajo_tipo || '',
      trabajo_continuidad: values.trabajo_continuidad || '',
      trabajo_educacion: values.trabajo_educacion || '',
      trabajo_actividad_social: values.trabajo_actividad_social || '',
      actividad_sexual: values.actividad_sexual || '',
      sexo_parejas: values.sexo_parejas || '',
      adicciones_cocaina_inhalatoria: values.adicciones_cocaina_inhalatoria || '',
      adicciones_cocaina_endovenosas: values.adicciones_cocaina_endovenosas || '',
      adicciones_marihuana: values.adicciones_marihuana || '',
      adicciones_notas_adicionales: values.adicciones_notas_adicionales || '',
      exposolar_laboral: values.exposolar_laboral === 'on',
      exposolar_recreacional: values.exposolar_recreacional || '',
      exposolar_proteccion_toggle: values.exposolar_proteccion_toggle === 'on',
      exposolar_proteccion_horario: values.exposolar_proteccion_horario === 'on',
      exposolar_proteccion_sombraropa: values.exposolar_proteccion_sombraropa === 'on',
      exposolar_proteccion_cremas: values.exposolar_proteccion_cremas === 'on',
    };
  };

  const form = useForm({
    initialValues: parseInitialValues(initialData),
  });

  const [debouncedValues] = useDebouncedValue(form.values, 500);

  useEffect(() => {
    if (!readOnly) {
      const transformToLegacyFormat = (vals: typeof form.values) => {
        const legacy: Record<string, string> = {};
        Object.entries(vals).forEach(([key, value]) => {
          if (typeof value === 'boolean') {
            if (value) legacy[key] = 'on';
          } else if (value instanceof Date) {
            legacy[key] = dayjs(value).format(key === 'fuma_desde' ? 'YYYY' : 'DD/MM/YYYY');
          } else if (value !== undefined && value !== null && value !== '') {
            legacy[key] = value.toString();
          }
        });
        return legacy;
      };

      const resultValues = transformToLegacyFormat(debouncedValues);
      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);

      if (hasChanged) {
        onChange({
          type: 'antecedentes/habitos',
          values: resultValues,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValues, onChange, readOnly, initialData]);

  const selectData = {
    quantity: [
      { value: 'poca', label: t('forms.habits_quantity_low') },
      { value: 'normal', label: t('forms.habits_quantity_normal') },
      { value: 'mucha', label: t('forms.habits_quantity_high') },
    ],
    quality: [
      { value: 'mala', label: t('forms.habits_quality_bad') },
      { value: 'regular', label: t('forms.habits_quality_regular') },
      { value: 'buena', label: t('forms.habits_quality_good') },
    ],
    compliance: [
      { value: 'mal', label: t('forms.habits_compliance_bad') },
      { value: 'regular', label: t('forms.habits_compliance_regular') },
      { value: 'bien', label: t('forms.habits_compliance_good') },
    ],
    frequency: [
      { value: 'no', label: t('forms.habits_frequency_no') },
      { value: 'ocasional', label: t('forms.habits_frequency_occasional') },
      { value: 'habitual', label: t('forms.habits_frequency_habitual') },
    ],
    infusionsFrequency: [
      { value: 'no', label: t('forms.habits_frequency_no') },
      { value: 'ocasional', label: t('forms.habits_frequency_occasional') },
      { value: 'habitual', label: t('forms.habits_frequency_habitual') },
      { value: 'frecuente', label: t('forms.habits_frequency_frequent') },
    ],
    smokeQuantity: [
      { value: 'menos10', label: t('forms.habits_smoke_less_10') },
      { value: 'mas10', label: t('forms.habits_smoke_more_10') },
      { value: 'mas20', label: t('forms.habits_smoke_more_20') },
    ],
    sal: [
      { value: 'no', label: t('forms.habits_sal_no') },
      { value: 'ocasional', label: t('forms.habits_sal_well') },
      { value: 'habitual', label: t('forms.habits_sal_much') },
    ],
    activity: [
      { value: 'no', label: t('forms.habits_activity_no') },
      { value: 'ocasional', label: t('forms.habits_activity_soft') },
      { value: 'habitual', label: t('forms.habits_activity_intense') },
    ],
    workType: [
      { value: 'intenso', label: t('forms.habits_work_type_intense_intellectual') },
      { value: 'intelectual', label: t('forms.habits_work_type_intellectual') },
      { value: 'fisico', label: t('forms.habits_work_type_physical') },
      { value: 'fisico_intenso', label: t('forms.habits_work_type_intense_physical') },
    ],
    workContinuity: [
      { value: 'estable', label: t('forms.habits_work_continuity_stable') },
      { value: 'temporal', label: t('forms.habits_work_continuity_temporary') },
    ],
    education: [
      { value: 'ninguna', label: t('forms.habits_education_none') },
      { value: 'primario', label: t('forms.habits_education_primary') },
      { value: 'secundario', label: t('forms.habits_education_secondary') },
      { value: 'superior', label: t('forms.habits_education_superior') },
    ],
    socialActivity: [
      { value: 'ninguna', label: t('forms.habits_social_activity_none') },
      { value: 'normal', label: t('forms.habits_social_activity_normal') },
    ],
    sexualityActivity: [
      { value: 'sin_pres', label: t('forms.habits_sexuality_no_condom') },
      { value: 'siempre_pres', label: t('forms.habits_sexuality_always_condom') },
    ],
    addictionsFrequency: [
      { value: 'nunca', label: t('forms.habits_frequency_no') },
      { value: 'ocasional', label: t('forms.habits_frequency_occasional') },
      { value: 'frecuente', label: t('forms.habits_frequency_frequent') },
    ],
    solarRecreational: [
      { value: 'nunca', label: t('forms.habits_solar_recreational_never') },
      { value: 'finde', label: t('forms.habits_solar_recreational_weekend') },
      { value: 'todosdias', label: t('forms.habits_solar_recreational_daily') },
    ],
  };

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle order={1}>{t('forms.habits_title')}</StyledTitle>
      </FormHeader>
      <Tabs defaultValue="food" variant="pills" color="blue">
        <Tabs.List grow mb="md" bd="1px solid var(--mantine-color-gray-2)" bdrs={4}>
          <Tabs.Tab value="food">{t('forms.habits_tab_food')}</Tabs.Tab>
          <Tabs.Tab value="work">{t('forms.habits_tab_work')}</Tabs.Tab>
          <Tabs.Tab value="sexuality">{t('forms.habits_tab_sexuality')}</Tabs.Tab>
          <Tabs.Tab value="addictions">{t('forms.habits_tab_addictions')}</Tabs.Tab>
          <Tabs.Tab value="solar">{t('forms.habits_tab_solar_exposure')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="food">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.habits_food_quantity')}:</Label>
              <StyledSelect
                data={selectData.quantity}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('alimentacion_cantidad')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_food_quality')}:</Label>
              <StyledSelect
                data={selectData.quality}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('alimentacion_calidad')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_food_diet')}:</Label>
              <Checkbox {...form.getInputProps('dieta_toggle', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            {form.values.dieta_toggle && (
              <IndentedSection>
                <FieldRow stacked>
                  <Label stacked>{t('forms.habits_food_diet_compliance')}:</Label>
                  <StyledSelect
                    data={selectData.compliance}
                    placeholder={t('forms.habits_select_placeholder')}
                    {...form.getInputProps('dieta_cumple')}
                    readOnly={readOnly}
                    variant="unstyled"
                    flex={1}
                  />
                </FieldRow>
                <FieldRow stacked>
                  <Label stacked>{''}</Label>
                  <Stack gap="xs">
                    <Checkbox
                      label={t('forms.habits_food_diet_low_sodium')}
                      {...form.getInputProps('dieta_baja_sodio', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_diet_low_calories')}
                      {...form.getInputProps('dieta_baja_calorias', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_diet_low_carbs')}
                      {...form.getInputProps('dieta_baja_hidratos', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_diet_low_fat')}
                      {...form.getInputProps('dieta_baja_grasas', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                  </Stack>
                </FieldRow>
              </IndentedSection>
            )}
            <FieldRow>
              <Label>{t('forms.habits_food_alcohol')}:</Label>
              <Stack gap="xs" flex={1}>
                <StyledSelect
                  data={selectData.frequency}
                  placeholder={t('forms.habits_select_placeholder')}
                  {...form.getInputProps('alcohol')}
                  readOnly={readOnly}
                  variant="unstyled"
                />
                {form.values.alcohol && form.values.alcohol !== 'no' && (
                  <Stack gap="xs" pl="md">
                    <Checkbox
                      label={t('forms.habits_food_alcohol_beer')}
                      {...form.getInputProps('alcohol_cerveza', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_alcohol_wine')}
                      {...form.getInputProps('alcohol_vino', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_alcohol_whisky')}
                      {...form.getInputProps('alcohol_whisky', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_alcohol_others')}
                      {...form.getInputProps('alcohol_otras', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                  </Stack>
                )}
              </Stack>
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_food_smoke')}:</Label>
              <Checkbox {...form.getInputProps('fuma_toggle', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            {form.values.fuma_toggle && (
              <IndentedSection>
                <FieldRow stacked>
                  <Label stacked>{t('forms.habits_food_smoke_from')}:</Label>
                  <StyledDateInput
                    placeholder="YYYY"
                    {...form.getInputProps('fuma_desde')}
                    readOnly={readOnly}
                    valueFormat="YYYY"
                    clearable={!readOnly}
                  />
                </FieldRow>
                <FieldRow stacked>
                  <Label stacked>{t('forms.habits_food_smoke_until')}:</Label>
                  <StyledDateInput
                    placeholder="DD/MM/YYYY"
                    {...form.getInputProps('fuma_hasta')}
                    readOnly={readOnly}
                    valueFormat="DD/MM/YYYY"
                    clearable={!readOnly}
                  />
                </FieldRow>
                <FieldRow stacked>
                  <Label stacked>{t('forms.habits_food_smoke_quantity')}:</Label>
                  <StyledSelect
                    data={selectData.smokeQuantity}
                    placeholder={t('forms.habits_select_placeholder')}
                    {...form.getInputProps('fuma_cantidad')}
                    readOnly={readOnly}
                    variant="unstyled"
                    flex={1}
                  />
                </FieldRow>
              </IndentedSection>
            )}
            <FieldRow>
              <Label>{t('forms.habits_food_infusions')}:</Label>
              <Stack gap="xs" flex={1}>
                <StyledSelect
                  data={selectData.infusionsFrequency}
                  placeholder={t('forms.habits_select_placeholder')}
                  {...form.getInputProps('infusiones')}
                  readOnly={readOnly}
                  variant="unstyled"
                />
                {form.values.infusiones && form.values.infusiones !== 'no' && (
                  <Stack gap="xs" pl="md">
                    <Checkbox
                      label={t('forms.habits_food_infusions_tea')}
                      {...form.getInputProps('infusiones_te', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_infusions_coffee')}
                      {...form.getInputProps('infusiones_cafe', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_infusions_mate')}
                      {...form.getInputProps('infusiones_mate', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_infusions_herbs')}
                      {...form.getInputProps('infusiones_hierbas', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_food_infusions_others')}
                      {...form.getInputProps('infusiones_otras', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                  </Stack>
                )}
              </Stack>
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_food_sal')}:</Label>
              <StyledSelect
                data={selectData.sal}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('sal')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_food_physical_activity')}:</Label>
              <StyledSelect
                data={selectData.activity}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('actividad_fisica')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="work">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.habits_work_type')}:</Label>
              <StyledSelect
                data={selectData.workType}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('trabajo_tipo')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_work_continuity')}:</Label>
              <StyledSelect
                data={selectData.workContinuity}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('trabajo_continuidad')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_work_education')}:</Label>
              <StyledSelect
                data={selectData.education}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('trabajo_educacion')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_work_social_activity')}:</Label>
              <StyledSelect
                data={selectData.socialActivity}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('trabajo_actividad_social')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="sexuality">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.habits_sexuality_activity')}:</Label>
              <StyledSelect
                data={selectData.sexualityActivity}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('actividad_sexual')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_sexuality_partners')}:</Label>
              <StyledTextInput
                type="number"
                placeholder="0"
                {...form.getInputProps('sexo_parejas')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="addictions">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.habits_addictions_cocaine_inhaled')}:</Label>
              <StyledSelect
                data={selectData.addictionsFrequency}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('adicciones_cocaina_inhalatoria')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_addictions_cocaine_iv')}:</Label>
              <StyledSelect
                data={selectData.addictionsFrequency}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('adicciones_cocaina_endovenosas')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_addictions_marijuana')}:</Label>
              <StyledSelect
                data={selectData.addictionsFrequency}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('adicciones_marihuana')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_addictions_notes')}:</Label>
              <StyledTextarea
                placeholder={t('forms.habits_addictions_notes')}
                {...form.getInputProps('adicciones_notas_adicionales')}
                readOnly={readOnly}
                autosize
                minRows={1}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="solar">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.habits_solar_laboral')}:</Label>
              <Checkbox {...form.getInputProps('exposolar_laboral', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_solar_recreational')}:</Label>
              <StyledSelect
                data={selectData.solarRecreational}
                placeholder={t('forms.habits_select_placeholder')}
                {...form.getInputProps('exposolar_recreacional')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.habits_solar_protection')}:</Label>
              <Checkbox
                {...form.getInputProps('exposolar_proteccion_toggle', { type: 'checkbox' })}
                disabled={readOnly}
              />
            </FieldRow>
            {form.values.exposolar_proteccion_toggle && (
              <IndentedSection>
                <FieldRow stacked>
                  <Label stacked>{''}</Label>
                  <Stack gap="xs">
                    <Checkbox
                      label={t('forms.habits_solar_protection_low_uv')}
                      {...form.getInputProps('exposolar_proteccion_horario', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_solar_protection_shade')}
                      {...form.getInputProps('exposolar_proteccion_sombraropa', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                    <Checkbox
                      label={t('forms.habits_solar_protection_creams')}
                      {...form.getInputProps('exposolar_proteccion_cremas', { type: 'checkbox' })}
                      disabled={readOnly}
                    />
                  </Stack>
                </FieldRow>
              </IndentedSection>
            )}
          </FormCard>
        </Tabs.Panel>
      </Tabs>
    </FormContainer>
  );
}
