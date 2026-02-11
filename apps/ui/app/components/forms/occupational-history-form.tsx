import { useEffect } from 'react';
import { useForm } from '@mantine/form';
import { Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  FormContainer,
  FormCard,
  FieldRow,
  Label,
  StyledTextarea,
  StyledTitle,
  FormHeader,
  StyledDateInput,
  TriStateCheckbox,
  IndentedSection,
} from './styles';

interface OccupationalHistoryFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function OccupationalHistoryForm({ initialData, onChange, readOnly }: OccupationalHistoryFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = (data?: OccupationalHistoryFormProps['initialData']) => {
    const values = data?.values || {};
    const parseTriState = (val?: string): boolean | 'indeterminate' => {
      if (val === 'si' || val === 'on') return true;
      if (val === 'no' || val === 'off') return false;
      return 'indeterminate';
    };

    const parseDate = (val?: string) => (val ? new Date(val) : null);

    return {
      toggle_inha_polvos: parseTriState(values.toggle_inha_polvos),
      toggle_minas: parseTriState(values.toggle_minas),
      minas_desde: parseDate(values.minas_desde),
      minas_hasta: parseDate(values.minas_hasta),
      minas_comments: values.minas_comments || '',

      toggle_piedra: parseTriState(values.toggle_piedra),
      piedra_desde: parseDate(values.piedra_desde),
      piedra_hasta: parseDate(values.piedra_hasta),
      piedra_comments: values.piedra_comments || '',

      toggle_abrasivos: parseTriState(values.toggle_abrasivos),
      abrasivos_desde: parseDate(values.abrasivos_desde),
      abrasivos_hasta: parseDate(values.abrasivos_hasta),
      abrasivos_comments: values.abrasivos_comments || '',

      toggle_fundicion: parseTriState(values.toggle_fundicion),
      fundicion_desde: parseDate(values.fundicion_desde),
      fundicion_hasta: parseDate(values.fundicion_hasta),
      fundicion_comments: values.fundicion_comments || '',

      toggle_ceramica: parseTriState(values.toggle_ceramica),
      ceramica_desde: parseDate(values.ceramica_desde),
      ceramica_hasta: parseDate(values.ceramica_hasta),
      ceramica_comments: values.ceramica_comments || '',

      toggle_cementos: parseTriState(values.toggle_cementos),
      cementos_desde: parseDate(values.cementos_desde),
      cementos_hasta: parseDate(values.cementos_hasta),
      cementos_comments: values.cementos_comments || '',

      toggle_polvo: parseTriState(values.toggle_polvo),
      polvo_desde: parseDate(values.polvo_desde),
      polvo_hasta: parseDate(values.polvo_hasta),
      polvo_comments: values.polvo_comments || '',

      toggle_pigmentos: parseTriState(values.toggle_pigmentos),
      pigmentos_desde: parseDate(values.pigmentos_desde),
      pigmentos_hasta: parseDate(values.pigmentos_hasta),
      pigmentos_comments: values.pigmentos_comments || '',

      toggle_vidrio: parseTriState(values.toggle_vidrio),
      vidrio_desde: parseDate(values.vidrio_desde),
      vidrio_hasta: parseDate(values.vidrio_hasta),
      vidrio_comments: values.vidrio_comments || '',

      toggle_asbesto: parseTriState(values.toggle_asbesto),
      toggle_mantos: parseTriState(values.toggle_mantos),
      mantos_desde: parseDate(values.mantos_desde),
      mantos_hasta: parseDate(values.mantos_hasta),
      mantos_comments: values.mantos_comments || '',

      toggle_const: parseTriState(values.toggle_const),
      const_desde: parseDate(values.const_desde),
      const_hasta: parseDate(values.const_hasta),
      const_comments: values.const_comments || '',

      toggle_refue: parseTriState(values.toggle_refue),
      refue_desde: parseDate(values.refue_desde),
      refue_hasta: parseDate(values.refue_hasta),
      refue_comments: values.refue_comments || '',

      toggle_fuego: parseTriState(values.toggle_fuego),
      fuego_desde: parseDate(values.fuego_desde),
      fuego_hasta: parseDate(values.fuego_hasta),
      fuego_comments: values.fuego_comments || '',

      toggle_textil: parseTriState(values.toggle_textil),
      textil_desde: parseDate(values.textil_desde),
      textil_hasta: parseDate(values.textil_hasta),
      textil_comments: values.textil_comments || '',

      toggle_naval: parseTriState(values.toggle_naval),
      naval_desde: parseDate(values.naval_desde),
      naval_hasta: parseDate(values.naval_hasta),
      naval_comments: values.naval_comments || '',

      toggle_acusticos: parseTriState(values.toggle_acusticos),
      acusticos_desde: parseDate(values.acusticos_desde),
      acusticos_hasta: parseDate(values.acusticos_hasta),
      acusticos_comments: values.acusticos_comments || '',

      toggle_forros: parseTriState(values.toggle_forros),
      forros_desde: parseDate(values.forros_desde),
      forros_hasta: parseDate(values.forros_hasta),
      forros_comments: values.forros_comments || '',

      toggle_embrague: parseTriState(values.toggle_embrague),
      embrague_desde: parseDate(values.embrague_desde),
      embrague_hasta: parseDate(values.embrague_hasta),
      embrague_comments: values.embrague_comments || '',

      toggle_empaque: parseTriState(values.toggle_empaque),
      empaque_desde: parseDate(values.empaque_desde),
      empaque_hasta: parseDate(values.empaque_hasta),
      empaque_comments: values.empaque_comments || '',

      toggle_gases: parseTriState(values.toggle_gases),
      gases_desde: parseDate(values.gases_desde),
      gases_hasta: parseDate(values.gases_hasta),
      gases_comments: values.gases_comments || '',

      toggle_polvos: parseTriState(values.toggle_polvos),
      polvos_desde: parseDate(values.polvos_desde),
      polvos_hasta: parseDate(values.polvos_hasta),
      polvos_comments: values.polvos_comments || '',

      toggle_rurales: parseTriState(values.toggle_rurales),
      rurales_desde: parseDate(values.rurales_desde),
      rurales_hasta: parseDate(values.rurales_hasta),
      rurales_comments: values.rurales_comments || '',

      toggle_asma: parseTriState(values.toggle_asma),
      asma_desde: parseDate(values.asma_desde),
      asma_hasta: parseDate(values.asma_hasta),
      asma_comments: values.asma_comments || '',

      toggle_otras: parseTriState(values.toggle_otras),
      otras_desde: parseDate(values.otras_desde),
      otras_hasta: parseDate(values.otras_hasta),
      otras_comments: values.otras_comments || '',
    };
  };

  const form = useForm({
    initialValues: parseInitialValues(initialData),
  });

  useEffect(() => {
    if (!readOnly) {
      const transformToLegacyFormat = (vals: typeof form.values) => {
        const legacy: Record<string, string> = {};
        Object.entries(vals).forEach(([key, value]) => {
          if (typeof value === 'boolean') {
            legacy[key] = value ? 'si' : 'no';
          } else if (value === 'indeterminate') {
            legacy[key] = '';
          } else if (value instanceof Date) {
            legacy[key] = value.toISOString();
          } else if (value !== undefined && value !== null && value !== '') {
            legacy[key] = value.toString();
          }
        });
        return legacy;
      };

      const resultValues = transformToLegacyFormat(form.values);
      const hasChanged = JSON.stringify(resultValues) !== JSON.stringify(initialData?.values);

      const hasData = Object.values(form.values).some(val => {
        if (typeof val === 'string') return val !== '' && val !== 'indeterminate';
        if (val instanceof Date) return true;
        if (val === true || val === false) return true;
        return false;
      });

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'antecedentes/ocupacionales',
          values: resultValues,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, onChange, readOnly, initialData]);

  const renderSection = (
    id: string,
    label: string,
    toggleName: string,
    desdeName: string,
    hastaName: string,
    commentsName: string
  ) => {
    const isToggled = form.values[toggleName as keyof typeof form.values] === true;

    return (
      <Stack gap={0} key={id}>
        <FieldRow checkbox nested>
          <TriStateCheckbox label={label} {...form.getInputProps(toggleName)} readOnly={readOnly} />
        </FieldRow>
        {isToggled && (
          <IndentedSection>
            <FieldRow stacked>
              <Label stacked>{t('common.from')}:</Label>
              <StyledDateInput
                {...form.getInputProps(desdeName)}
                readOnly={readOnly}
                placeholder={t('common.date_placeholder')}
                clearable
              />
            </FieldRow>
            <FieldRow stacked>
              <Label stacked>{t('common.to')}:</Label>
              <StyledDateInput
                {...form.getInputProps(hastaName)}
                readOnly={readOnly}
                placeholder={t('common.date_placeholder')}
                clearable
              />
            </FieldRow>
            <FieldRow stacked>
              <Label stacked>{t('common.comments')}:</Label>
              <StyledTextarea
                {...form.getInputProps(commentsName)}
                readOnly={readOnly}
                placeholder={t('common.comments_placeholder')}
                autosize
                minRows={1}
              />
            </FieldRow>
          </IndentedSection>
        )}
      </Stack>
    );
  };

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle order={1}>{t('forms.occupational_history_title')}</StyledTitle>
      </FormHeader>

      <FormCard>
        {/* Inhalation of inorganic dusts */}
        <FieldRow checkbox noOffset>
          <TriStateCheckbox
            label={t('forms.occ_inhalation_inorganic_dusts')}
            {...form.getInputProps('toggle_inha_polvos')}
            readOnly={readOnly}
          />
        </FieldRow>
        {form.values.toggle_inha_polvos === true && (
          <IndentedSection>
            {renderSection(
              'minas',
              t('forms.occ_mines'),
              'toggle_minas',
              'minas_desde',
              'minas_hasta',
              'minas_comments'
            )}
            {renderSection(
              'piedra',
              t('forms.occ_stone'),
              'toggle_piedra',
              'piedra_desde',
              'piedra_hasta',
              'piedra_comments'
            )}
            {renderSection(
              'abrasivos',
              t('forms.occ_abrasives'),
              'toggle_abrasivos',
              'abrasivos_desde',
              'abrasivos_hasta',
              'abrasivos_comments'
            )}
            {renderSection(
              'fundicion',
              t('forms.occ_foundry'),
              'toggle_fundicion',
              'fundicion_desde',
              'fundicion_hasta',
              'fundicion_comments'
            )}
            {renderSection(
              'ceramica',
              t('forms.occ_ceramics'),
              'toggle_ceramica',
              'ceramica_desde',
              'ceramica_hasta',
              'ceramica_comments'
            )}
            {renderSection(
              'cementos',
              t('forms.occ_cements'),
              'toggle_cementos',
              'cementos_desde',
              'cementos_hasta',
              'cementos_comments'
            )}
            {renderSection(
              'polvo',
              t('forms.occ_cleaning_dust'),
              'toggle_polvo',
              'polvo_desde',
              'polvo_hasta',
              'polvo_comments'
            )}
            {renderSection(
              'pigmentos',
              t('forms.occ_pigments'),
              'toggle_pigmentos',
              'pigmentos_desde',
              'pigmentos_hasta',
              'pigmentos_comments'
            )}
            {renderSection(
              'vidrio',
              t('forms.occ_glass_industry'),
              'toggle_vidrio',
              'vidrio_desde',
              'vidrio_hasta',
              'vidrio_comments'
            )}
          </IndentedSection>
        )}

        {/* Asbestos */}
        <FieldRow checkbox noOffset>
          <TriStateCheckbox
            label={t('forms.occ_asbestos')}
            {...form.getInputProps('toggle_asbesto')}
            readOnly={readOnly}
          />
        </FieldRow>
        {form.values.toggle_asbesto === true && (
          <IndentedSection>
            {renderSection(
              'mantos',
              t('forms.occ_insulating_strips'),
              'toggle_mantos',
              'mantos_desde',
              'mantos_hasta',
              'mantos_comments'
            )}
            {renderSection(
              'const',
              t('forms.occ_construction'),
              'toggle_const',
              'const_desde',
              'const_hasta',
              'const_comments'
            )}
            {renderSection(
              'refue',
              t('forms.occ_vinyl_flooring'),
              'toggle_refue',
              'refue_desde',
              'refue_hasta',
              'refue_comments'
            )}
            {renderSection(
              'fuego',
              t('forms.occ_fireproof_insulation'),
              'toggle_fuego',
              'fuego_desde',
              'fuego_hasta',
              'fuego_comments'
            )}
            {renderSection(
              'textil',
              t('forms.occ_textile_industry'),
              'toggle_textil',
              'textil_desde',
              'textil_hasta',
              'textil_comments'
            )}
            {renderSection(
              'naval',
              t('forms.occ_shipbuilding'),
              'toggle_naval',
              'naval_desde',
              'naval_hasta',
              'naval_comments'
            )}
            {renderSection(
              'acusticos',
              t('forms.occ_acoustic_insulation'),
              'toggle_acusticos',
              'acusticos_desde',
              'acusticos_hasta',
              'acusticos_comments'
            )}
            {renderSection(
              'forros',
              t('forms.occ_brake_linings'),
              'toggle_forros',
              'forros_desde',
              'forros_hasta',
              'forros_comments'
            )}
            {renderSection(
              'embrague',
              t('forms.occ_clutch_linings'),
              'toggle_embrague',
              'embrague_desde',
              'embrague_hasta',
              'embrague_comments'
            )}
            {renderSection(
              'empaque',
              t('forms.occ_car_gaskets'),
              'toggle_empaque',
              'empaque_desde',
              'empaque_hasta',
              'empaque_comments'
            )}
          </IndentedSection>
        )}

        {/* Other inhalations and categories */}
        {renderSection(
          'gases',
          t('forms.occ_irritating_gases'),
          'toggle_gases',
          'gases_desde',
          'gases_hasta',
          'gases_comments'
        ).props.children.map((child: any, i: number) =>
          i === 0 ? (
            <FieldRow checkbox noOffset key="gases-row">
              <TriStateCheckbox
                label={t('forms.occ_irritating_gases')}
                {...form.getInputProps('toggle_gases')}
                readOnly={readOnly}
              />
            </FieldRow>
          ) : (
            child
          )
        )}
        {renderSection(
          'polvos',
          t('forms.occ_organic_dusts'),
          'toggle_polvos',
          'polvos_desde',
          'polvos_hasta',
          'polvos_comments'
        ).props.children.map((child: any, i: number) =>
          i === 0 ? (
            <FieldRow checkbox noOffset key="polvos-row">
              <TriStateCheckbox
                label={t('forms.occ_organic_dusts')}
                {...form.getInputProps('toggle_polvos')}
                readOnly={readOnly}
              />
            </FieldRow>
          ) : (
            child
          )
        )}
        {renderSection(
          'rurales',
          t('forms.occ_rural_tasks'),
          'toggle_rurales',
          'rurales_desde',
          'rurales_hasta',
          'rurales_comments'
        ).props.children.map((child: any, i: number) =>
          i === 0 ? (
            <FieldRow checkbox noOffset key="rurales-row">
              <TriStateCheckbox
                label={t('forms.occ_rural_tasks')}
                {...form.getInputProps('toggle_rurales')}
                readOnly={readOnly}
              />
            </FieldRow>
          ) : (
            child
          )
        )}
        {renderSection(
          'asma',
          t('forms.occ_occupational_asthma'),
          'toggle_asma',
          'asma_desde',
          'asma_hasta',
          'asma_comments'
        ).props.children.map((child: any, i: number) =>
          i === 0 ? (
            <FieldRow checkbox noOffset key="asma-row">
              <TriStateCheckbox
                label={t('forms.occ_occupational_asthma')}
                {...form.getInputProps('toggle_asma')}
                readOnly={readOnly}
              />
            </FieldRow>
          ) : (
            child
          )
        )}
        {renderSection(
          'otras',
          t('forms.occ_other_diseases'),
          'toggle_otras',
          'otras_desde',
          'otras_hasta',
          'otras_comments'
        ).props.children.map((child: any, i: number) =>
          i === 0 ? (
            <FieldRow checkbox noOffset key="otras-row">
              <TriStateCheckbox
                label={t('forms.occ_other_diseases')}
                {...form.getInputProps('toggle_otras')}
                readOnly={readOnly}
              />
            </FieldRow>
          ) : (
            child
          )
        )}
      </FormCard>
    </FormContainer>
  );
}
