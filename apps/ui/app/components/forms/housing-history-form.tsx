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
  StyledTitle,
  StyledSelect,
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
    return {
      cohabita_con: values.cohabita_con || '',
      ambientes: values.ambientes || '',
      tipo_piso: values.tipo_piso || '',
      tipo_pared: values.tipo_pared || '',
      tipo_techo: values.tipo_techo || '',
      aberturas_puertas: values.aberturas_puertas === 'on',
      aberturas_ventanas: values.aberturas_ventanas === 'on',
      humedad: values.humedad || '',
      ventilacion: values.ventilacion || '',
      tipo_agua: values.tipo_agua || '',
      canerias: values.canerias || '',
      tipo_cloacas: values.tipo_cloacas || '',
      sanitarios: values.sanitarios === 'on',
      tipo_gas: values.tipo_gas || '',
      estufas: values.estufas || '',
      electricidad: values.electricidad === 'on',
      electricidad_segura: values.electricidad_segura === 'on',
      electricidad_legal: values.electricidad_legal === 'on',
      equip_cocina: values.equip_cocina === 'on',
      equip_tel_linea: values.equip_tel_linea === 'on',
      equip_tel_celular: values.equip_tel_celular === 'on',
      equip_heladera: values.equip_heladera || '',
      equip_lavarropas: values.equip_lavarropas === 'on',
      equip_televisor: values.equip_televisor || '',
      equip_antena_satelital: values.equip_antena_satelital === 'on',
      equip_internet: values.equip_internet === 'on',
      equip_automovil: values.equip_automovil === 'on',
      equip_moto: values.equip_moto === 'on',
      alfombras: values.alfombras === 'on',
      colchonlanamas4: values.colchonlanamas4 === 'on',
      almohadamas2: values.almohadamas2 === 'on',
      cortinadosgruesos: values.cortinadosgruesos === 'on',
      empapelado: values.empapelado === 'on',
      biblioteca: values.biblioteca === 'on',
      peluche: values.peluche === 'on',
      rellenos: values.rellenos === 'on',
      frazadas: values.frazadas === 'on',
      mascotas: values.mascotas === 'on',
      cucarachas: values.cucarachas === 'on',
      zona_chagas: values.zona_chagas === 'on',
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
          type: 'antecedentes/habitacionales',
          values: resultValues,
        });
      }
    }
  }, [debouncedValues, onChange, readOnly, initialData]);

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
            <FieldRow>
              <Label>{t('forms.housing_cohabits')}:</Label>
              <StyledTextInput
                placeholder={t('forms.housing_cohabits_placeholder')}
                {...form.getInputProps('cohabita_con')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_environments')}:</Label>
              <StyledTextInput
                placeholder={t('forms.housing_environments_placeholder')}
                {...form.getInputProps('ambientes')}
                readOnly={readOnly}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_floor_type')}:</Label>
              <StyledSelect
                data={selectData.floor}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('tipo_piso')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_wall_type')}:</Label>
              <StyledSelect
                data={selectData.wall}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('tipo_pared')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_roof_type')}:</Label>
              <StyledSelect
                data={selectData.roof}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('tipo_techo')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_door_openings')}:</Label>
              <Checkbox {...form.getInputProps('aberturas_puertas', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_window_openings')}:</Label>
              <Checkbox {...form.getInputProps('aberturas_ventanas', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_humidity')}:</Label>
              <StyledSelect
                data={selectData.humidity}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('humedad')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_ventilation')}:</Label>
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
              <FieldRow>
                <Label>{t('forms.housing_water_type')}:</Label>
                <StyledSelect
                  data={selectData.waterType}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('tipo_agua')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
              <FieldRow>
                <Label>{t('forms.housing_pipes')}:</Label>
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
              <FieldRow>
                <Label>{t('forms.housing_waste_type')}:</Label>
                <StyledSelect
                  data={selectData.waste}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('tipo_cloacas')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
              <FieldRow>
                <Label>{t('forms.housing_sanitaries')}:</Label>
                <Checkbox {...form.getInputProps('sanitarios', { type: 'checkbox' })} disabled={readOnly} />
              </FieldRow>
            </FormCard>

            <FormHeader>
              <StyledTitle order={2} size="h3">
                {t('forms.housing_gas_legend')}
              </StyledTitle>
            </FormHeader>
            <FormCard>
              <FieldRow>
                <Label>{t('forms.housing_gas_type')}:</Label>
                <StyledSelect
                  data={selectData.gas}
                  placeholder={t('forms.common_select_placeholder')}
                  {...form.getInputProps('tipo_gas')}
                  readOnly={readOnly}
                  variant="unstyled"
                  flex={1}
                />
              </FieldRow>
              <FieldRow>
                <Label>{t('forms.housing_heaters')}:</Label>
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
              <FieldRow>
                <Label>{t('forms.housing_electric')}:</Label>
                <Checkbox {...form.getInputProps('electricidad', { type: 'checkbox' })} disabled={readOnly} />
              </FieldRow>
              <FieldRow>
                <Label>{t('forms.housing_electric_safe')}:</Label>
                <Checkbox {...form.getInputProps('electricidad_segura', { type: 'checkbox' })} disabled={readOnly} />
              </FieldRow>
              <FieldRow>
                <Label>{t('forms.housing_electric_legal')}:</Label>
                <Checkbox {...form.getInputProps('electricidad_legal', { type: 'checkbox' })} disabled={readOnly} />
              </FieldRow>
            </FormCard>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="equipment">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.housing_equip_kitchen')}:</Label>
              <Checkbox {...form.getInputProps('equip_cocina', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_phone')}:</Label>
              <Checkbox {...form.getInputProps('equip_tel_linea', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_cellphone')}:</Label>
              <Checkbox {...form.getInputProps('equip_tel_celular', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_fridge')}:</Label>
              <StyledSelect
                data={selectData.fridge}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('equip_heladera')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_washer')}:</Label>
              <Checkbox {...form.getInputProps('equip_lavarropas', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_tv')}:</Label>
              <StyledSelect
                data={selectData.tv}
                placeholder={t('forms.common_select_placeholder')}
                {...form.getInputProps('equip_televisor')}
                readOnly={readOnly}
                variant="unstyled"
                flex={1}
              />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_satellite')}:</Label>
              <Checkbox {...form.getInputProps('equip_antena_satelital', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_internet')}:</Label>
              <Checkbox {...form.getInputProps('equip_internet', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_car')}:</Label>
              <Checkbox {...form.getInputProps('equip_automovil', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_equip_moto')}:</Label>
              <Checkbox {...form.getInputProps('equip_moto', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>

        <Tabs.Panel value="medical">
          <FormCard>
            <FieldRow>
              <Label>{t('forms.housing_med_carpets')}:</Label>
              <Checkbox {...form.getInputProps('alfombras', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_mattress')}:</Label>
              <Checkbox {...form.getInputProps('colchonlanamas4', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_pillow')}:</Label>
              <Checkbox {...form.getInputProps('almohadamas2', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_curtains')}:</Label>
              <Checkbox {...form.getInputProps('cortinadosgruesos', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_wallpaper')}:</Label>
              <Checkbox {...form.getInputProps('empapelado', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_library')}:</Label>
              <Checkbox {...form.getInputProps('biblioteca', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_stuffed_animal')}:</Label>
              <Checkbox {...form.getInputProps('peluche', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_fillings')}:</Label>
              <Checkbox {...form.getInputProps('rellenos', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_blankets')}:</Label>
              <Checkbox {...form.getInputProps('frazadas', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_pets')}:</Label>
              <Checkbox {...form.getInputProps('mascotas', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_cockroaches')}:</Label>
              <Checkbox {...form.getInputProps('cucarachas', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
            <FieldRow>
              <Label>{t('forms.housing_med_chagas')}:</Label>
              <Checkbox {...form.getInputProps('zona_chagas', { type: 'checkbox' })} disabled={readOnly} />
            </FieldRow>
          </FormCard>
        </Tabs.Panel>
      </Tabs>
    </FormContainer>
  );
}
