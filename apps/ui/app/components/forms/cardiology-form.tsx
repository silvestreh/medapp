import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { Tabs, Stack, Button, ActionIcon, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Plus, Trash } from 'lucide-react';
import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledTextInput,
  StyledSelect,
  StyledTitle,
  FormHeader,
  ItemHeader,
} from './styles';

interface Murmur {
  characteristic: string;
  location: string;
  intensity: string;
}

interface CardiologyFormProps {
  initialData?: {
    type: string;
    values: Record<string, any>;
  };
  onChange: (data: { type: string; values: Record<string, any> }) => void;
  readOnly?: boolean;
}

export function CardiologyForm({ initialData, onChange, readOnly }: CardiologyFormProps) {
  const { t } = useTranslation();

  const pulseOptions = [
    { value: '0/4', label: '0/4' },
    { value: '1/4', label: '1/4' },
    { value: '2/4', label: '2/4' },
    { value: '3/4', label: '3/4' },
    { value: '4/4', label: '4/4' },
  ];

  const characteristicOptions = [
    { value: 'normal', label: t('forms.cardiology_normal') },
    { value: 'augmented', label: t('forms.cardiology_augmented') },
    { value: 'diminished', label: t('forms.cardiology_diminished') },
    { value: 'unfolded', label: t('forms.cardiology_unfolded') },
  ];

  const presenceOptions = [
    { value: 'present', label: t('forms.cardiology_present') },
    { value: 'abscent', label: t('forms.cardiology_absent') },
  ];

  const parseInitialValues = (data?: CardiologyFormProps['initialData']) => {
    const values = data?.values || {};

    const murmurs: Murmur[] = [];
    const count = parseInt(values.soplo_count || '0', 10);
    for (let i = 0; i < count; i++) {
      murmurs.push({
        characteristic: values[`caracteristica_soplo_${i}`] || '',
        location: values[`localizacion_soplo_${i}`] || '',
        intensity: values[`intensidad_soplo_${i}`] || '',
      });
    }

    if (murmurs.length === 0 && !readOnly) {
      murmurs.push({ characteristic: '', location: '', intensity: '' });
    }

    return {
      tension_arterial_sistolica: values.tension_arterial_sistolica || '',
      tension_arterial_diastolica: values.tension_arterial_diastolica || '',
      pulso_radial_derecho: values.pulso_radial_derecho || '',
      pulso_radial_izquierdo: values.pulso_radial_izquierdo || '',
      pulso_femoral_derecho: values.pulso_femoral_derecho || '',
      pulso_femoral_izquierdo: values.pulso_femoral_izquierdo || '',
      pulso_tibial_posterior_derecho: values.pulso_tibial_posterior_derecho || '',
      pulso_tibial_posterior_izquierdo: values.pulso_tibial_posterior_izquierdo || '',
      pulso_pedio_derecho: values.pulso_pedio_derecho || '',
      pulso_pedio_izquierdo: values.pulso_pedio_izquierdo || '',
      pulso_carotideo_derecho: values.pulso_carotideo_derecho || '',
      pulso_carotideo_izquierdo: values.pulso_carotideo_izquierdo || '',
      choque_de_punta: values.choque_de_punta || '',
      fremito: values.fremito || '',
      auscultacion_r1: values.auscultacion_r1 || '',
      auscultacion_r2: values.auscultacion_r2 || '',
      auscultacion_r3: values.auscultacion_r3 || '',
      auscultacion_r4: values.auscultacion_r4 || '',
      caracteristica_auscultacion_cuello_derecho: values.caracteristica_auscultacion_cuello_derecho || '',
      intensidad_auscultacion_cuello_derecho: values.intensidad_auscultacion_cuello_derecho || '',
      caracteristica_auscultacion_cuello_izquierdo: values.caracteristica_auscultacion_cuello_izquierdo || '',
      intensidad_auscultacion_cuello_izquierdo: values.intensidad_auscultacion_cuello_izquierdo || '',
      murmurs,
    };
  };

  const form = useForm({
    initialValues: parseInitialValues(initialData),
  });

  useEffect(() => {
    if (!readOnly) {
      const transformToLegacyFormat = (vals: typeof form.values) => {
        const legacy: Record<string, string> = {
          tension_arterial_sistolica: vals.tension_arterial_sistolica,
          tension_arterial_diastolica: vals.tension_arterial_diastolica,
          pulso_radial_derecho: vals.pulso_radial_derecho,
          pulso_radial_izquierdo: vals.pulso_radial_izquierdo,
          pulso_femoral_derecho: vals.pulso_femoral_derecho,
          pulso_femoral_izquierdo: vals.pulso_femoral_izquierdo,
          pulso_tibial_posterior_derecho: vals.pulso_tibial_posterior_derecho,
          pulso_tibial_posterior_izquierdo: vals.pulso_tibial_posterior_izquierdo,
          pulso_pedio_derecho: vals.pulso_pedio_derecho,
          pulso_pedio_izquierdo: vals.pulso_pedio_izquierdo,
          pulso_carotideo_derecho: vals.pulso_carotideo_derecho,
          pulso_carotideo_izquierdo: vals.pulso_carotideo_izquierdo,
          choque_de_punta: vals.choque_de_punta,
          fremito: vals.fremito,
          auscultacion_r1: vals.auscultacion_r1,
          auscultacion_r2: vals.auscultacion_r2,
          auscultacion_r3: vals.auscultacion_r3,
          auscultacion_r4: vals.auscultacion_r4,
          caracteristica_auscultacion_cuello_derecho: vals.caracteristica_auscultacion_cuello_derecho,
          intensidad_auscultacion_cuello_derecho: vals.intensidad_auscultacion_cuello_derecho,
          caracteristica_auscultacion_cuello_izquierdo: vals.caracteristica_auscultacion_cuello_izquierdo,
          intensidad_auscultacion_cuello_izquierdo: vals.intensidad_auscultacion_cuello_izquierdo,
          soplo_count: vals.murmurs.length.toString(),
        };

        vals.murmurs.forEach((m, i) => {
          legacy[`caracteristica_soplo_${i}`] = m.characteristic;
          legacy[`localizacion_soplo_${i}`] = m.location;
          legacy[`intensidad_soplo_${i}`] = m.intensity;
        });

        return legacy;
      };

      const resultValues = transformToLegacyFormat(form.values);
      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);

      const hasData = Object.entries(form.values).some(([key, val]) => {
        if (key === 'murmurs') {
          return (val as Murmur[]).some(m => m.characteristic || m.location || m.intensity);
        }
        return typeof val === 'string' && val.trim() !== '';
      });

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'cardiologia/general',
          values: resultValues,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, onChange, readOnly, initialData]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle order={1}>{t('forms.cardiology_title')}</StyledTitle>
      </FormHeader>

      <Tabs defaultValue="tension" variant="pills">
        <Tabs.List grow mb="md" bd="1px solid var(--mantine-color-gray-2)" bdrs={4}>
          <Tabs.Tab value="tension">{t('forms.cardiology_tab_tension')}</Tabs.Tab>
          <Tabs.Tab value="pulsos">{t('forms.cardiology_tab_pulsos')}</Tabs.Tab>
          <Tabs.Tab value="palpacion">{t('forms.cardiology_tab_palpacion')}</Tabs.Tab>
          <Tabs.Tab value="auscultacion">{t('forms.cardiology_tab_auscultacion')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="tension">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.cardiology_systolic')}:</Label>
              <StyledTextInput
                type="number"
                {...form.getInputProps('tension_arterial_sistolica')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_diastolic')}:</Label>
              <StyledTextInput
                type="number"
                {...form.getInputProps('tension_arterial_diastolica')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="pulsos">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.cardiology_radial_right')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_radial_derecho')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_radial_left')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_radial_izquierdo')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_femoral_right')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_femoral_derecho')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_femoral_left')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_femoral_izquierdo')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_tibial_right')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_tibial_posterior_derecho')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_tibial_left')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_tibial_posterior_izquierdo')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_pedio_right')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_pedio_derecho')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_pedio_left')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_pedio_izquierdo')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_carotid_right')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_carotideo_derecho')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_carotid_left')}:</Label>
              <StyledSelect
                data={pulseOptions}
                placeholder={t('common.select')}
                {...form.getInputProps('pulso_carotideo_izquierdo')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="palpacion">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.cardiology_apex_beat')}:</Label>
              <StyledSelect
                data={[
                  { value: 'present', label: t('forms.cardiology_apex_present') },
                  { value: 'abscent', label: t('forms.cardiology_apex_absent') },
                  { value: 'broad', label: t('forms.cardiology_apex_broad') },
                  { value: 'sustained', label: t('forms.cardiology_apex_sustained') },
                ]}
                placeholder={t('common.select')}
                {...form.getInputProps('choque_de_punta')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.cardiology_fremitus')}:</Label>
              <StyledSelect
                data={[
                  { value: 'present', label: t('forms.cardiology_fremitus_present') },
                  { value: 'abscent', label: t('forms.cardiology_fremitus_absent') },
                ]}
                placeholder={t('common.select')}
                {...form.getInputProps('fremito')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="auscultacion">
          <Tabs defaultValue="general" variant="default" color="blue">
            <Tabs.List mt="xl" mb="md">
              <Tabs.Tab value="general">{t('forms.cardiology_auscultation_general')}</Tabs.Tab>
              <Tabs.Tab value="cuello">{t('forms.cardiology_auscultation_neck')}</Tabs.Tab>
              <Tabs.Tab value="soplos">{t('forms.cardiology_auscultation_murmurs')}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="general">
              <FormCard>
                <FieldRow>
                  <Label>{t('forms.cardiology_r1_characteristic')}:</Label>
                  <StyledSelect
                    data={characteristicOptions}
                    placeholder={t('common.select')}
                    {...form.getInputProps('auscultacion_r1')}
                    readOnly={readOnly}
                    clearable
                  />
                </FieldRow>
                <FieldRow>
                  <Label>{t('forms.cardiology_r2_characteristic')}:</Label>
                  <StyledSelect
                    data={characteristicOptions}
                    placeholder={t('common.select')}
                    {...form.getInputProps('auscultacion_r2')}
                    readOnly={readOnly}
                    clearable
                  />
                </FieldRow>
                <FieldRow>
                  <Label>{t('forms.cardiology_r3_characteristic')}:</Label>
                  <StyledSelect
                    data={presenceOptions}
                    placeholder={t('common.select')}
                    {...form.getInputProps('auscultacion_r3')}
                    readOnly={readOnly}
                    clearable
                  />
                </FieldRow>
                <FieldRow>
                  <Label>{t('forms.cardiology_r4_characteristic')}:</Label>
                  <StyledSelect
                    data={presenceOptions}
                    placeholder={t('common.select')}
                    {...form.getInputProps('auscultacion_r4')}
                    readOnly={readOnly}
                    clearable
                  />
                </FieldRow>
              </FormCard>
            </Tabs.Panel>

            <Tabs.Panel value="cuello">
              <Stack gap="md">
                <Text fw={500} size="sm" c="gray.7" px="md">
                  {t('forms.cardiology_neck_right_title')}
                </Text>
                <FormCard>
                  <FieldRow>
                    <Label>{t('forms.cardiology_characteristic')}:</Label>
                    <StyledSelect
                      data={[
                        { value: 'normal', label: t('forms.cardiology_normal') },
                        { value: 'soplo', label: t('forms.cardiology_soplo') },
                      ]}
                      placeholder={t('common.select')}
                      {...form.getInputProps('caracteristica_auscultacion_cuello_derecho')}
                      readOnly={readOnly}
                      clearable
                    />
                  </FieldRow>
                  <FieldRow>
                    <Label>{t('forms.cardiology_intensity')}:</Label>
                    <StyledSelect
                      data={pulseOptions}
                      placeholder={t('common.select')}
                      {...form.getInputProps('intensidad_auscultacion_cuello_derecho')}
                      readOnly={readOnly}
                      clearable
                    />
                  </FieldRow>
                </FormCard>

                <Text fw={500} size="sm" c="gray.7" px="md" mt="md">
                  {t('forms.cardiology_neck_left_title')}
                </Text>
                <FormCard>
                  <FieldRow>
                    <Label>{t('forms.cardiology_characteristic')}:</Label>
                    <StyledSelect
                      data={[
                        { value: 'normal', label: t('forms.cardiology_normal') },
                        { value: 'soplo', label: t('forms.cardiology_soplo') },
                      ]}
                      placeholder={t('common.select')}
                      {...form.getInputProps('caracteristica_auscultacion_cuello_izquierdo')}
                      readOnly={readOnly}
                      clearable
                    />
                  </FieldRow>
                  <FieldRow>
                    <Label>{t('forms.cardiology_intensity')}:</Label>
                    <StyledSelect
                      data={pulseOptions}
                      placeholder={t('common.select')}
                      {...form.getInputProps('intensidad_auscultacion_cuello_izquierdo')}
                      readOnly={readOnly}
                      clearable
                    />
                  </FieldRow>
                </FormCard>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="soplos">
              <Stack gap="md">
                {form.values.murmurs.map((_, index) => (
                  <>
                    <ItemHeader>
                      <Text fw={500} c="gray.6" pt="xs">
                        {t('forms.cardiology_murmur_title', { index: index + 1 })}
                      </Text>
                      {!readOnly && (
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => form.removeListItem('murmurs', index)}
                          disabled={form.values.murmurs.length === 1}
                          mr="xs"
                          mt="xs"
                        >
                          <Trash size={16} />
                        </ActionIcon>
                      )}
                    </ItemHeader>
                    <FormCard key={index}>
                      <FieldRow>
                        <Label>{t('forms.cardiology_characteristic')}:</Label>
                        <StyledSelect
                          data={[
                            { value: 'sistolico', label: t('forms.cardiology_murmur_systolic') },
                            { value: 'diastolico', label: t('forms.cardiology_murmur_diastolic') },
                            { value: 'continuo', label: t('forms.cardiology_murmur_continuous') },
                          ]}
                          placeholder={t('common.select')}
                          {...form.getInputProps(`murmurs.${index}.characteristic`)}
                          readOnly={readOnly}
                          clearable
                        />
                      </FieldRow>
                      <FieldRow>
                        <Label>{t('forms.cardiology_murmur_location')}:</Label>
                        <StyledSelect
                          data={[
                            { value: 'mitral', label: t('forms.cardiology_murmur_mitral') },
                            { value: 'aortico', label: t('forms.cardiology_murmur_aortic') },
                            { value: 'pulmonar', label: t('forms.cardiology_murmur_pulmonary') },
                            { value: 'tricuspideo', label: t('forms.cardiology_murmur_tricuspid') },
                          ]}
                          placeholder={t('common.select')}
                          {...form.getInputProps(`murmurs.${index}.location`)}
                          readOnly={readOnly}
                          clearable
                        />
                      </FieldRow>
                      <FieldRow>
                        <Label>{t('forms.cardiology_intensity')}:</Label>
                        <StyledSelect
                          data={pulseOptions}
                          placeholder={t('common.select')}
                          {...form.getInputProps(`murmurs.${index}.intensity`)}
                          readOnly={readOnly}
                          clearable
                        />
                      </FieldRow>
                    </FormCard>
                  </>
                ))}
                <FormHeader>
                  {!readOnly && (
                    <Button
                      variant="light"
                      leftSection={<Plus size={16} />}
                      ml="auto"
                      onClick={() =>
                        form.insertListItem('murmurs', { characteristic: '', location: '', intensity: '' })
                      }
                      radius="xl"
                      size="xs"
                    >
                      {t('forms.cardiology_murmur_add')}
                    </Button>
                  )}
                </FormHeader>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Tabs.Panel>
      </Tabs>
    </FormContainer>
  );
}
