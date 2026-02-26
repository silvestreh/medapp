import fs from 'fs';
import path from 'path';

const OSPROVINCIA_CHUBUT_ID = 'ee944a04-1c20-46f3-acde-4a630c45f63b';
const AVALIAN_ID = '9bc84c32-a64b-4fc7-b9c0-2b44aa92b44e';
const SWISS_MEDICAL_ID = 'e3d132e2-d239-46d2-98cc-c3d6f09aa625';
const TV_SALUD_ID = 'bcff1432-f3b4-4373-8c60-d4012fcbd945';
const LUZ_Y_FUERZA_ID = 'a48ba0cf-504c-4564-bf84-7a55f5c41f1d';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeKey = (value: string): string => value.trim().replace(/\s+/g, ' ').toUpperCase();

export const MEDICARE_ALIASES: Record<string, string | null> = {
  'INST. NACIONAL DE SERVICIOS SOCIALES PARA JUBILADOS Y PENSIONADOS': 'PAMI',
  'O.S.PROVINCIA CHUBUT': OSPROVINCIA_CHUBUT_ID,
  'ACA SALUD COOPERATIVA DE SERVICIOS': AVALIAN_ID,
  'SMG': SWISS_MEDICAL_ID,
  'TV SALUD': TV_SALUD_ID,
  'O.S.FED. ARG. TRAB. DE LUZ Y FUERZA': LUZ_Y_FUERZA_ID,

  'OSDE BINARIO': 'OSDE',
  'OSDE BINARIO BIOPSIA': 'OSDE',
  'OSDE BINARIO DERIV ESTOM BIOPSIA': 'OSDE',
  'OSDE BINARIOÇ': 'OSDE',
  'OSDE 210': 'OSDE',
  'OSDE APARATO': 'OSDE',
  'OSDE (BIOPSIA)': 'OSDE',

  'SWISS MEDICAL MEDICINA PRIVADA': 'SWISS MEDICAL',
  'SWISS MEDICAL MEDICINA PRIVADA BTX': 'SWISS MEDICAL',
  'SWISS MEDICAL MEDICINA PRIVADA BX 4': 'SWISS MEDICAL',
  'SWISS MEDICAL MEDICINA PRIVADA (OBLIG)': 'SWISS MEDICAL',
  'SWISS MEDICAL MEDICINA PRIVADA 17 : 30': 'SWISS MEDICAL',
  'DOCTHOS SA': SWISS_MEDICAL_ID,

  'SEROS CHUBUT': 'SEROS',
  'SEROS CHUBUT.': 'SEROS',
  'SEROS.': 'SEROS',
  'SEROS.CHUBUT': 'SEROS',
  'SEROS CHUBUT- PAMI': 'PAMI',

  'PAMI SANTA CRUZ': 'PAMI',
  'PAMI.': 'PAMI',
  'PAMI S. CRUZ': 'PAMI',
  'PAMI SC': 'PAMI',
  'PAMI SANTA CRUZ.': 'PAMI',
  'PAMI STA. CRUZ.': 'PAMI',
  'PAMI STA CRUZ.': 'PAMI',
  'PAMI STA. CRUZ': 'PAMI',
  'PAMI. PARTICULAR.': 'PAMI',
  'PAMI- PART': 'PAMI',
  'PAMI/PARTICULAR': 'PAMI',
  'PÁMI': 'PAMI',

  'GALENO LIFE SA': 'GALENO',
  'GALENO AZUL': 'GALENO',
  'GALENOS - CONSULTORIOS MEDICOS': 'GALENO',
  'GALENO PLATA': 'GALENO',

  'MEDIFE MEDICINA PREPAGA': 'MEDIFE',
  MEDIFE: 'MEDIFE',
  'MEDIFÉ': 'MEDIFE',
  'MEDIFE PLATA': 'MEDIFE',
  'MEDIFÉ BRONCE.': 'MEDIFE',
  'MEDIFE MEDICINA': 'MEDIFE',

  'O.S.PERS. DE DIR. DE LA INDUSTRIA PRIVADA DEL PETROLEO': 'OSDIPP',
  OSDIPP: 'OSDIPP',
  'OSDIPP.': 'OSDIPP',
  'OSDIPP/VISITAR': 'OSDIPP',

  'O.S.PETROLEROS': 'OSPE',
  'OSPE SANTA CRUZ': 'OSPE',
  'OSPE S. CRUZ': 'OSPE',
  'OSPE A 704': 'OSPE',
  'OSPE A 425': 'OSPE',
  'OSPE/YPF': 'OSPE',
  'OSPE.': 'OSPE',
  'SEROS/OSPE': 'OSPE',

  'O.S.PETROLEO Y GAS PRIVADO': 'OSPEGAP',
  OSPEGAP: 'OSPEGAP',
  'OSPEGAP.': 'OSPEGAP',
  'OSPEGAP SANTA CRUZ': 'OSPEGAP',
  'OSPEGAP SALUD': 'OSPEGAP',
  'OSPEGAP SALUD.': 'OSPEGAP',

  DASU: 'DASU',
  'DASU.': 'DASU',
  'DASU-SEROS': 'DASU',
  'DASU Y SEROS': 'DASU',

  IOSE: 'IOSFA',
  IOSFA: 'IOSFA',
  DIBA: 'IOSFA',
  DICAS: 'IOSFA',
  IOSNA: 'IOSFA',
  'INST. DE O.S.DEL EJERCITO': 'IOSFA',

  ADOS: 'ADOS',
  'ADOS COMODORO RIVADAVIA': 'ADOS',
  'ADOS COMODORO': 'ADOS',
  'ADOS C.R.': 'ADOS',
  'ADOS C. RIVADAVIA': 'ADOS',
  'ADOS.': 'ADOS',
  'ASOC.OBRAS SOCIALES DE COMODORO RIVADAVIA': 'ADOS',

  'O.S.PERS. DE LA UNIV. NAC. DE LA PATAGONIA SAN JUAN BOSCO': 'DASU',
  'O.S.PATRONES DE CABOTAJE DE RIOS Y PUERTOS': 'OSPATRONES',
  'GENERAR SALUD': 'GENERAR SALUD',
  'GENERAR SALUD.': 'GENERAR SALUD',
  'ENERAR SALUD': 'GENERAR SALUD',
  'PODER JUDICIAL': 'OSPJN',
  'O.S.DOCENTES PARTICULARES': 'OSDOP',
  'O.S.DE DIRECCION OSDO': 'OSDO',
  'ACCORD SALUD': 'ACCORD SALUD',
  'ACORD SALUD': 'ACCORD SALUD',
  ANDAR: 'OSVVRA',
  OSALARA: 'OSALARA',
  'O.S.EMPLEADOS DE COMERCIO Y ACTIVIDADES CIVILES': 'OSECAC',
  'O.S.PERS. ASOCIADO A ASOCIACION MUTUAL SANCOR': 'SANCOR SALUD',
  'OMINT MEDICINA PRIVADA': 'OMINT',
  'MEDICUS SA': 'MEDICUS',

  'PREVENIR SRL': null,
  'ACCION MEDICA SA': null,
  'UNO AZUL': null,
  'UNO AZUL.': null,
  PARTICULAR: null,
  'PARTICULAR.': null,
  'PARTICULAR DOMIC.': null,
  PART: null,
  PARTIC: null,
  'APARATO $600': null,
  'APARATO (6)': null,
  'APARATO (4)': null,
  'APARATO (7)': null,
  'Htal. ZONAL CALETA OLIVIA': null,
  HZCO: null,
  HZC: null,
  BIOPSIA: null,
  CRIOCIRUGIA: null,
  'ALEJANDRA_PUGH@YAHOO.COM.AR': null,
  'S/C': null,
  'SIN CARGO': null,
  'CONTROL S/C': null,
  'CSS PARTICULAR': null,
  'CSS PARTICULAR.': null,
  'CSS/PARTICULAR': null,
  'CSS/PARTIC': null,
  'CSS PARTIC.': null,
  SCIS: null,
  OSEG: null,
  OSSEG: null,
  'JERARQ. SALUD': null,
  OSAPAM: null,
  DIPBFA: null,
  OSTRAC: null,
  OSFA: null,
};

const NULL_PATTERNS = [
  /^PART(ICULAR|IC)?\.?$/i,
  /^UNO AZUL\.?$/i,
  /^APARATO(\s|\(|$)/i,
  /^S\/C$/i,
  /^SIN CARGO$/i,
  /^CONTROL S\/C$/i,
];

const resolveByPattern = (normalized: string): string | null | undefined => {
  if (normalized.includes('OSDE BINARIO')) return 'OSDE';
  if (normalized.startsWith('OSDE ')) return 'OSDE';
  if (normalized.includes('SWISS MEDICAL')) return 'SWISS MEDICAL';
  if (normalized.includes('PAMI')) return 'PAMI';
  if (normalized.includes('SEROS CHUBUT') || normalized === 'SEROS.') return 'SEROS';
  if (normalized.includes('GALENO')) return 'GALENO';
  if (normalized.includes('MEDIFE') || normalized.includes('MEDIFÉ')) return 'MEDIFE';
  if (normalized.includes('OSDIPP')) return 'OSDIPP';
  if (normalized.includes('DASU')) return 'DASU';
  if (normalized.includes('OSPEGAP')) return 'OSPEGAP';
  if (normalized.includes('ACCORD') || normalized.includes('ACORD')) return 'ACCORD SALUD';
  if (normalized.includes('OMINT')) return 'OMINT';
  if (normalized.includes('GENERAR SALUD') || normalized.includes('ENERAR SALUD')) return 'GENERAR SALUD';
  if (normalized.startsWith('OSPE')) return 'OSPE';
  if (normalized.includes('IOSE') || normalized.includes('IOSFA') || normalized.includes('DIBA')) return 'IOSFA';
  if (normalized.includes('ADOS')) return 'ADOS';

  if (NULL_PATTERNS.some(pattern => pattern.test(normalized))) return null;
  return undefined;
};

export function loadPrepagaMap(): Map<string, string> {
  const prepagasPath = path.join(__dirname, '../seeds/prepagas.json');
  const prepagas = JSON.parse(fs.readFileSync(prepagasPath, 'utf-8')) as Array<{
    id: string;
    denomination: string;
    shortName: string;
  }>;

  const prepagaMap = new Map<string, string>();
  for (const prepaga of prepagas) {
    prepagaMap.set(normalizeKey(prepaga.shortName), prepaga.id);
    prepagaMap.set(normalizeKey(prepaga.denomination), prepaga.id);
  }
  return prepagaMap;
}

export function resolveMedicareId(
  rawMedicare: string | undefined | null,
  prepagaMap: Map<string, string>,
): string | null {
  if (!rawMedicare || !rawMedicare.trim()) {
    return null;
  }

  const normalized = normalizeKey(rawMedicare);
  const direct = prepagaMap.get(normalized);
  if (direct) {
    return direct;
  }

  const alias = MEDICARE_ALIASES[normalized];
  if (alias === null) {
    return null;
  }
  if (typeof alias === 'string') {
    if (UUID_RE.test(alias)) {
      return alias;
    }

    const mappedAlias = prepagaMap.get(normalizeKey(alias));
    if (mappedAlias) {
      return mappedAlias;
    }
  }

  const patternAlias = resolveByPattern(normalized);
  if (patternAlias === null) {
    return null;
  }
  if (typeof patternAlias === 'string') {
    const mappedPatternAlias = prepagaMap.get(normalizeKey(patternAlias));
    if (mappedPatternAlias) {
      return mappedPatternAlias;
    }
  }

  return null;
}
