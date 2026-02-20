import { Stack, Tabs } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FieldRow,
  FormCard,
  FormContainer,
  FormHeader,
  StyledTextInput,
  StyledTitle,
  StyledSelect,
  TriStateCheckbox,
} from './styles';

interface HousingHistoryFormProps {
  initialData?: {
    type: string;
    values: Record<string, string>;
  };
  onChange: (data: { type: string; values: Record<string, string> }) => void;
  readOnly?: boolean;
}

export function HousingHistoryForm({ initialData, onChange, readOnly }: HousingHistoryFormProps) {
  const { t } = useTranslation();

  const parseInitialValues = (data?: HousingHistoryFormProps['initialData']) => {
    const values = data?.values || {};
    const parseTriState = (val?: string): boolean | 'indeterminate' => {
      if (val === 'si' || val === 'on') return true;
      if (val === 'no' || val === 'off') return false;
      return 'indeterminate';
    };

    return {
      cohabita_con: values.cohabita_con || '',
      ambientes: values.ambientes || '',
      tipo_piso: values.tipo_piso || '',
      tipo_pared: values.tipo_pared || '',
      tipo_techo: values.tipo_techo || '',
      aberturas_puertas: parseTriState(values.aberturas_puertas),
      aberturas_ventanas: parseTriState(values.aberturas_ventanas),
      humedad: values.humedad || '',
      ventilacion: values.ventilacion || '',
      tipo_agua: values.tipo_agua || '',
      canerias: values.canerias || '',
      tipo_cloacas: values.tipo_cloacas || '',
      sanitarios: parseTriState(values.sanitarios),
      tipo_gas: values.tipo_gas || '',
      estufas: values.estufas || '',
      electricidad: parseTriState(values.electricidad),
      electricidad_segura: parseTriState(values.electricidad_segura),
      electricidad_legal: parseTriState(values.electricidad_legal),
      equip_cocina: parseTriState(values.equip_cocina),
      equip_tel_linea: parseTriState(values.equip_tel_linea),
      equip_tel_celular: parseTriState(values.equip_tel_celular),
      equip_heladera: values.equip_heladera || '',
      equip_lavarropas: parseTriState(values.equip_lavarropas),
      equip_televisor: values.equip_televisor || '',
      equip_antena_satelital: parseTriState(values.equip_antena_satelital),
      equip_internet: parseTriState(values.equip_internet),
      equip_automovil: parseTriState(values.equip_automovil),
      equip_moto: parseTriState(values.equip_moto),
      alfombras: parseTriState(values.alfombras),
      colchonlanamas4: parseTriState(values.colchonlanamas4),
      almohadamas2: parseTriState(values.almohadamas2),
      cortinadosgruesos: parseTriState(values.cortinadosgruesos),
      empapelado: parseTriState(values.empapelado),
      biblioteca: parseTriState(values.biblioteca),
      peluche: parseTriState(values.peluche),
      rellenos: parseTriState(values.rellenos),
      frazadas: parseTriState(values.frazadas),
      mascotas: parseTriState(values.mascotas),
      cucarachas: parseTriState(values.cucarachas),
      zona_chagas: parseTriState(values.zona_chagas),
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
        if (val === true || val === false) return true;
        return false;
      });

      if (hasChanged && (initialData || hasData)) {
        onChange({
          type: 'antecedentes/habitacionales',
          values: resultValues,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, onChange, readOnly, initialData]);

  const selectData = {
    floor: [
      { value: 'madera', label: t('forms.housing_floor_wood') },
      { value: 'cemento', label: t('forms.housing_floor_cement') },
      { value: 'mosaico', label: t('forms.housing_floor_mosaic') },
      { value: 'tierra', label: t('forms.housing_floor_earth') },
    ],
    wall: [
      { value: 'madera', label: t('forms.housing_wall_wood') },
      { value: 'ladrillo', label: t('forms.housing_wall_brick') },
      { value: 'chapa', label: t('forms.housing_wall_metal') },
    ],
    roof: [
      { value: 'cemento', label: t('forms.housing_roof_cement') },
      { value: 'ladrillo', label: t('forms.housing_roof_brick') },
      { value: 'chapa', label: t('forms.housing_roof_metal') },
    ],
    humidity: [
      { value: 'no', label: t('forms.housing_humidity_no') },
      { value: 'poca', label: t('forms.housing_humidity_little') },
      { value: 'mucha', label: t('forms.housing_humidity_much') },
    ],
    ventilation: [
      { value: 'no', label: t('forms.housing_ventilation_no') },
      { value: 'poca', label: t('forms.housing_ventilation_little') },
      { value: 'mucha', label: t('forms.housing_ventilation_much') },
    ],
    waterType: [
      { value: 'surface', label: t('forms.housing_water_surface') },
      { value: 'net', label: t('forms.housing_water_net') },
      { value: 'well', label: t('forms.housing_water_well') },
    ],
    pipes: [
      { value: 'inside', label: t('forms.housing_pipes_inside') },
      { value: 'outside', label: t('forms.housing_pipes_outside') },
    ],
    waste: [
      { value: 'red_publica', label: t('forms.housing_waste_public') },
      { value: 'pozo_ciego', label: t('forms.housing_waste_well') },
      { value: 'fosa_septica', label: t('forms.housing_waste_septic') },
    ],
    gas: [
      { value: 'natural', label: t('forms.housing_gas_natural') },
      { value: 'garrafa', label: t('forms.housing_gas_bottle') },
    ],
    heaters: [
      { value: 'tiro_balanceado', label: t('forms.housing_heaters_balanced') },
      { value: 'kerosene', label: t('forms.housing_heaters_kerosene') },
      { value: 'lena', label: t('forms.housing_heaters_wood') },
    ],
    fridge: [
      { value: 'no', label: t('forms.housing_fridge_no') },
      { value: 'freezer', label: t('forms.housing_fridge_freezer') },
      { value: 'nofreezer', label: t('forms.housing_fridge_no_freezer') },
    ],
    tv: [
      { value: 'no', label: t('forms.housing_tv_no') },
      { value: 'blanco_y_negro', label: t('forms.housing_tv_bw') },
      { value: 'tubo', label: t('forms.housing_tv_tube') },
      { value: 'lcd', label: t('forms.housing_tv_lcd') },
      { value: 'led', label: t('forms.housing_tv_led') },
      { value: 'plasma', label: t('forms.housing_tv_plasma') },
    ],
  };

  return (
    <FormContainer>
      <FormHeader>
        <StyledTitle order={1}>{t('forms.housing_history_title')}</StyledTitle>
      </FormHeader>
      <Tabs defaultValue="social" variant="pills" color="blue">
        <Tabs.List grow mb="md" bd="1px solid var(--mantine-color-gray-2)" bdrs={4}>
          <Tabs.Tab value="social">{t('forms.housing_tab_social')}</Tabs.Tab>
          <Tabs.Tab value="basicServices">{t('forms.housing_tab_services')}</Tabs.Tab>
          <Tabs.Tab value="equipment">{t('forms.housing_tab_equipment')}</Tabs.Tab>
          <Tabs.Tab value="medical">{t('forms.housing_tab_medical')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="social">
          <FormCard>
            <FieldRow label={`${t('forms.housing_cohabits')}:`}>
              <StyledTextInput
                placeholder={t('forms.housing_cohabits_placeholder')}
                {...form.getInputProps('cohabita_con')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_environments')}:`}>
              <StyledTextInput
                placeholder={t('forms.housing_environments_placeholder')}
                {...form.getInputProps('ambientes')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_floor_type')}:`}>
              <StyledSelect
                data={selectData.floor}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('tipo_piso')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_wall_type')}:`}>
              <StyledSelect
                data={selectData.wall}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('tipo_pared')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_roof_type')}:`}>
              <StyledSelect
                data={selectData.roof}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('tipo_techo')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_door_openings')}
                {...form.getInputProps('aberturas_puertas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_window_openings')}
                {...form.getInputProps('aberturas_ventanas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_humidity')}:`}>
              <StyledSelect
                data={selectData.humidity}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('humedad')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_ventilation')}:`}>
              <StyledSelect
                data={selectData.ventilation}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('ventilacion')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="basicServices">
          <Stack gap="md">
            <FormHeader>
              <StyledTitle order={2} size="h3">
                {t('forms.housing_water_legend')}
              </StyledTitle>
            </FormHeader>
            <FormCard>
              <FieldRow label={`${t('forms.housing_water_type')}:`}>
                <StyledSelect
                  data={selectData.waterType}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('tipo_agua')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
              <FieldRow label={`${t('forms.housing_pipes')}:`}>
                <StyledSelect
                  data={selectData.pipes}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('canerias')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
            </FormCard>

            <FormHeader>
              <StyledTitle order={2} size="h3">
                {t('forms.housing_waste_legend')}
              </StyledTitle>
            </FormHeader>
            <FormCard>
              <FieldRow label={`${t('forms.housing_waste_type')}:`}>
                <StyledSelect
                  data={selectData.waste}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('tipo_cloacas')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.housing_sanitaries')}
                  {...form.getInputProps('sanitarios')}
                  readOnly={readOnly}
                />
              </FieldRow>
            </FormCard>

            <FormHeader>
              <StyledTitle order={2} size="h3">
                {t('forms.housing_gas_legend')}
              </StyledTitle>
            </FormHeader>
            <FormCard>
              <FieldRow label={`${t('forms.housing_gas_type')}:`}>
                <StyledSelect
                  data={selectData.gas}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('tipo_gas')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
              <FieldRow label={`${t('forms.housing_heaters')}:`}>
                <StyledSelect
                  data={selectData.heaters}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('estufas')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
            </FormCard>

            <FormHeader>
              <StyledTitle order={2} size="h3">
                {t('forms.housing_electric_legend')}
              </StyledTitle>
            </FormHeader>
            <FormCard>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.housing_electric')}
                  {...form.getInputProps('electricidad')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.housing_electric_safe')}
                  {...form.getInputProps('electricidad_segura')}
                  readOnly={readOnly}
                />
              </FieldRow>
              <FieldRow checkbox>
                <TriStateCheckbox
                  label={t('forms.housing_electric_legal')}
                  {...form.getInputProps('electricidad_legal')}
                  readOnly={readOnly}
                />
              </FieldRow>
            </FormCard>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="equipment">
          <FormCard>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_kitchen')}
                {...form.getInputProps('equip_cocina')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_phone')}
                {...form.getInputProps('equip_tel_linea')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_cellphone')}
                {...form.getInputProps('equip_tel_celular')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_equip_fridge')}:`}>
              <StyledSelect
                data={selectData.fridge}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('equip_heladera')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_washer')}
                {...form.getInputProps('equip_lavarropas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow label={`${t('forms.housing_equip_tv')}:`}>
              <StyledSelect
                data={selectData.tv}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('equip_televisor')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_satellite')}
                {...form.getInputProps('equip_antena_satelital')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_internet')}
                {...form.getInputProps('equip_internet')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_car')}
                {...form.getInputProps('equip_automovil')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_equip_moto')}
                {...form.getInputProps('equip_moto')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="medical">
          <FormCard>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_carpets')}
                {...form.getInputProps('alfombras')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_mattress')}
                {...form.getInputProps('colchonlanamas4')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_pillow')}
                {...form.getInputProps('almohadamas2')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_curtains')}
                {...form.getInputProps('cortinadosgruesos')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_wallpaper')}
                {...form.getInputProps('empapelado')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_library')}
                {...form.getInputProps('biblioteca')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_stuffed_animal')}
                {...form.getInputProps('peluche')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_fillings')}
                {...form.getInputProps('rellenos')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_blankets')}
                {...form.getInputProps('frazadas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_pets')}
                {...form.getInputProps('mascotas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_cockroaches')}
                {...form.getInputProps('cucarachas')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow checkbox>
              <TriStateCheckbox
                label={t('forms.housing_med_chagas')}
                {...form.getInputProps('zona_chagas')}
                readOnly={readOnly}
              />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>
      </Tabs>
    </FormContainer>
  );
}
