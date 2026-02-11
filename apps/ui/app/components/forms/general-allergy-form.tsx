import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { Tabs, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledSelect,
  StyledTextInput,
  StyledTitle,
  FormHeader,
  TriStateCheckbox,
} from './styles';

interface GeneralAllergyFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function GeneralAllergyForm({ initialData, onChange, readOnly }: GeneralAllergyFormProps) {
  const { t } = useTranslation();

  const parseTriState = (val?: string): boolean | 'indeterminate' => {
    if (val === 'si' || val === 'on') return true;
    if (val === 'no' || val === 'off') return false;
    return 'indeterminate';
  };

  const parseInitialValues = (data?: GeneralAllergyFormProps['initialData']) => {
    const v = data?.values || {};
    return {
      // Respiratory
      secrecion_nasal: v.secrecion_nasal || '',
      prurito_nasal: parseTriState(v.prurito_nasal),
      prurito_ocular: parseTriState(v.prurito_ocular),
      prurito_otico: parseTriState(v.prurito_otico),
      prurito_palatino: parseTriState(v.prurito_palatino),
      tos: v.tos || '',
      estornudos: parseTriState(v.estornudos),
      disnea: parseTriState(v.disnea),
      sibilancias: parseTriState(v.sibilancias),
      bloqueo_nasal: parseTriState(v.bloqueo_nasal),
      // Skin
      prurito: parseTriState(v.prurito),
      ronchas: parseTriState(v.ronchas),
      edema: parseTriState(v.edema),
      escamas: parseTriState(v.escamas),
      // Location
      loc_cara: parseTriState(v.loc_cara),
      loc_cuello: parseTriState(v.loc_cuello),
      loc_tronco: parseTriState(v.loc_tronco),
      loc_miembros: parseTriState(v.loc_miembros),
      loc_generalizado: parseTriState(v.loc_generalizado),
      // Triggers - environmental
      des_polvo: parseTriState(v.des_polvo),
      des_humo: parseTriState(v.des_humo),
      des_humedad: parseTriState(v.des_humedad),
      des_cambio_temperatura: parseTriState(v.des_cambio_temperatura),
      des_mascotas: parseTriState(v.des_mascotas),
      // Triggers - seasonal
      primavera: parseTriState(v.primavera),
      verano: parseTriState(v.verano),
      otono: parseTriState(v.otono),
      invierno: parseTriState(v.invierno),
      // Triggers - climate
      inf_frio: parseTriState(v.inf_frio),
      inf_humedad: parseTriState(v.inf_humedad),
      inf_viento: parseTriState(v.inf_viento),
      inf_calor: parseTriState(v.inf_calor),
      inf_tormenta: parseTriState(v.inf_tormenta),
      // Allergies
      al_alimentos: v.al_alimentos || '',
      al_acaros: v.al_acaros || '',
      al_animales: v.al_animales || '',
      al_insectos_venenos: v.al_insectos_venenos || '',
      al_mohos: v.al_mohos || '',
      al_parasitos: v.al_parasitos || '',
      al_polen_arboles: v.al_polen_arboles || '',
      al_polen_gramineas: v.al_polen_gramineas || '',
      al_otros: v.al_otros || '',
    };
  };

  const form = useForm({
    initialValues: parseInitialValues(initialData),
  });

  useEffect(() => {
    if (!readOnly) {
      const legacy: Record<string, string> = {};
      Object.entries(form.values).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          legacy[key] = value ? 'si' : 'no';
        } else if (value === 'indeterminate') {
          legacy[key] = '';
        } else if (typeof value === 'string' && value !== '') {
          legacy[key] = value;
        }
      });

      const hasChanged = JSON.stringify(legacy) !== JSON.stringify(initialData?.values);

      const hasData = Object.values(form.values).some(val => {
        if (typeof val === 'string') return val !== '' && val !== 'indeterminate';
        if (val === true || val === false) return true;
        return false;
      });

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'alergias/general',
          values: legacy,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, onChange, readOnly, initialData]);

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle order={1}>{t('forms.allergy_general_title')}</StyledTitle>
      </FormHeader>

      <Tabs defaultValue="respiratorio" variant="pills">
        <Tabs.List grow mb="md" bd="1px solid var(--mantine-color-gray-2)" bdrs={4}>
          <Tabs.Tab value="respiratorio">{t('forms.allergy_tab_respiratory')}</Tabs.Tab>
          <Tabs.Tab value="cutaneos">{t('forms.allergy_tab_skin')}</Tabs.Tab>
          <Tabs.Tab value="localizacion">{t('forms.allergy_tab_location')}</Tabs.Tab>
          <Tabs.Tab value="desencadenantes">{t('forms.allergy_tab_triggers')}</Tabs.Tab>
          <Tabs.Tab value="alergias">{t('forms.allergy_tab_allergies')}</Tabs.Tab>
        </Tabs.List>

        {/* Respiratory symptoms */}
        <Tabs.Panel value="respiratorio">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.allergy_nasal_discharge')}:</Label>
              <StyledSelect
                data={[
                  { value: 'acuosa', label: t('forms.allergy_nasal_watery') },
                  { value: 'mucosa', label: t('forms.allergy_nasal_mucous') },
                  { value: 'purulenta', label: t('forms.allergy_nasal_purulent') },
                  { value: 'mixta', label: t('forms.allergy_nasal_mixed') },
                ]}
                placeholder={t('common.select')}
                {...form.getInputProps('secrecion_nasal')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_nasal_pruritus')}
                {...form.getInputProps('prurito_nasal')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_ocular_pruritus')}
                {...form.getInputProps('prurito_ocular')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_otic_pruritus')}
                {...form.getInputProps('prurito_otico')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_palatal_pruritus')}
                {...form.getInputProps('prurito_palatino')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_cough')}:</Label>
              <StyledSelect
                data={[
                  { value: 'seca', label: t('forms.allergy_cough_dry') },
                  { value: 'productiva', label: t('forms.allergy_cough_productive') },
                  { value: 'espasmodica', label: t('forms.allergy_cough_spasmodic') },
                  { value: 'emetizante', label: t('forms.allergy_cough_emetic') },
                ]}
                placeholder={t('common.select')}
                {...form.getInputProps('tos')}
                readOnly={readOnly}
                clearable
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_sneezing')}
                {...form.getInputProps('estornudos')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_dyspnea')}
                {...form.getInputProps('disnea')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_wheezing')}
                {...form.getInputProps('sibilancias')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_nasal_blockage')}
                {...form.getInputProps('bloqueo_nasal')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        {/* Skin symptoms */}
        <Tabs.Panel value="cutaneos">
          <FormCard>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_skin_pruritus')}
                {...form.getInputProps('prurito')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_hives')}
                {...form.getInputProps('ronchas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox label={t('forms.allergy_edema')} {...form.getInputProps('edema')} readOnly={readOnly} />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_scales')}
                {...form.getInputProps('escamas')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        {/* Location */}
        <Tabs.Panel value="localizacion">
          <FormCard>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_loc_face')}
                {...form.getInputProps('loc_cara')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_loc_neck')}
                {...form.getInputProps('loc_cuello')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_loc_trunk')}
                {...form.getInputProps('loc_tronco')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_loc_limbs')}
                {...form.getInputProps('loc_miembros')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.allergy_loc_generalized')}
                {...form.getInputProps('loc_generalizado')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        {/* Triggers */}
        <Tabs.Panel value="desencadenantes">
          <Stack gap="md">
            <Text fw={500} size="sm" c="gray.7" px="md">
              {t('forms.allergy_triggers_environmental')}
            </Text>
            <FormCard>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_trigger_dust')}
                  {...form.getInputProps('des_polvo')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_trigger_smoke')}
                  {...form.getInputProps('des_humo')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_trigger_humidity')}
                  {...form.getInputProps('des_humedad')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_trigger_temp_change')}
                  {...form.getInputProps('des_cambio_temperatura')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_trigger_pets')}
                  {...form.getInputProps('des_mascotas')}
                  readOnly={readOnly}
                />
              </FieldRow>
            </FormCard>

            <Text fw={500} size="sm" c="gray.7" px="md" mt="md">
              {t('forms.allergy_triggers_seasonal')}
            </Text>
            <FormCard>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_season_spring')}
                  {...form.getInputProps('primavera')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_season_summer')}
                  {...form.getInputProps('verano')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_season_autumn')}
                  {...form.getInputProps('otono')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_season_winter')}
                  {...form.getInputProps('invierno')}
                  readOnly={readOnly}
                />
              </FieldRow>
            </FormCard>

            <Text fw={500} size="sm" c="gray.7" px="md" mt="md">
              {t('forms.allergy_triggers_climate')}
            </Text>
            <FormCard>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_climate_cold')}
                  {...form.getInputProps('inf_frio')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_climate_humidity')}
                  {...form.getInputProps('inf_humedad')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_climate_wind')}
                  {...form.getInputProps('inf_viento')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_climate_heat')}
                  {...form.getInputProps('inf_calor')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.allergy_climate_storm')}
                  {...form.getInputProps('inf_tormenta')}
                  readOnly={readOnly}
                />
              </FieldRow>
            </FormCard>
          </Stack>
        </Tabs.Panel>

        {/* Allergies */}
        <Tabs.Panel value="alergias">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.allergy_food')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_alimentos')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_mites')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_acaros')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_animals')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_animales')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_insects_venoms')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_insectos_venenos')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_molds')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_mohos')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_parasites')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_parasitos')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_tree_pollen')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_polen_arboles')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_grass_pollen')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_polen_gramineas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.allergy_other')}:</Label>
              <StyledTextInput
                placeholder={t('forms.allergy_text_placeholder')}
                {...form.getInputProps('al_otros')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>
      </Tabs>
    </FormContainer>
  );
}
