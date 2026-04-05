import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Application } from '../../declarations';

interface RecetarioConfig {
  apiUrl: string;
  jwt: string;
}

let _config: RecetarioConfig | null = null;

export function initRecetarioClient(app: Application): void {
  const recetario = (app.get as any)('recetario') || {};
  _config = {
    apiUrl: recetario.apiUrl || process.env.RECETARIO_API_URL || 'https://external-api.recetario.com.ar',
    jwt: recetario.jwt || process.env.RECETARIO_JWT || '',
  };
}

export interface QuickLinkPayload {
  professional: {
    title: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    nationalIdType: string;
    email: string;
    nationalLicenseNumber: string;
    stateLicenseNumber?: string;
    stateLicenseName?: string;
    specialty: string;
    province: string;
    signatureImage?: string;
  };
  patient: {
    firstName: string;
    lastName: string;
    nationalId: string;
    nationalIdType: string;
    email?: string;
    gender: string;
    birthDate: string;
    healthInsuranceName?: string;
    healthInsurancePlan?: string;
    healthInsuranceNumber?: string;
  };
  healthCenter?: {
    id: number;
  };
  reference?: string;
}

export interface DoctorPayload {
  email: string;
  name: string;
  surname: string;
  licenseType: string;
  licenseNumber: string;
  documentNumber: string;
  province: string;
  title: string;
  specialty: string;
  healthCenterId?: number;
  signature?: string;
  profile: {
    legend: string;
    phone: string;
    address: string;
    email: string;
  };
}

export interface PatientPayload {
  healthInsurance: string;
  insuranceNumber?: string;
  name: string;
  surname: string;
  documentNumber: string;
  email?: string;
  phone?: string;
  gender: string;
  birthDate: string;
}

export interface PrescriptionPayload {
  userId?: number;
  doctor?: DoctorPayload;
  date: string;
  patient: PatientPayload;
  method: 'vademecum' | 'manual';
  diagnosis: string;
  reference?: string;
  hiv?: boolean;
  recurring?: {
    days: number;
    quantity: number;
  };
  medicines: {
    externalId?: string;
    quantity: number;
    longTerm: boolean;
    posology?: string;
    genericOnly?: boolean;
    brandRecommendation?: boolean;
    requiresDuplicate?: boolean;
    text?: string;
  }[];
}

export interface OrderPayload {
  userId?: number;
  doctor?: DoctorPayload;
  date: string;
  patient: PatientPayload;
  medicine: string;
  diagnosis: string;
  reference?: string;
}

export interface SharePayload {
  documentIds: number[];
  channel: 'whatsapp' | 'email';
  recipient: string;
}

export interface HealthCenterPayload {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

export interface RecetarioUserPayload {
  title: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  nationalIdType: string;
  email: string;
  nationalLicenseNumber: string;
  stateLicenseNumber?: string;
  stateLicenseName?: string;
  specialty: string;
  province: string;
  healthCenterId: number;
}

export interface QuickLinkResponse {
  prescriptionsLink?: string;
  ordersLink?: string;
}

export interface MedicalDocument {
  id: number;
  type: 'prescription' | 'order';
  url: string;
  status: string;
  reference?: string;
  date: string;
  createdDate: string;
  externalId?: string;
  userId?: number;
  method?: 'vademecum' | 'manual';
  diagnosis?: string;
  hiv?: boolean;
  doctor?: {
    email: string;
    name: string;
    surname: string;
    licenseType: string;
    licenseNumber: string;
    documentNumber: string;
    province: string;
    title: string;
    specialty: string;
  };
  patient: {
    healthInsurance?: string;
    insuranceNumber?: string;
    name: string;
    surname: string;
    documentNumber: string;
    email?: string;
    phone?: string;
    gender?: string;
    birthDate?: string;
  };
  medicines?: {
    externalId?: string;
    quantity: number;
    longTerm: boolean;
    posology?: string;
    requiresDuplicate: boolean;
    genericOnly?: boolean;
    brandRecommendation?: boolean;
    text: string;
  }[];
  medicine?: string; // order text content
}

export interface MedicalDocumentsResponse {
  data: MedicalDocument[];
  meta: {
    itemsPerPage: number;
    totalItems: number;
    currentPage: number;
    totalPages: number;
  };
  links: {
    current: string;
    next?: string;
    last?: string;
  };
}

export interface HealthInsurance {
  id: number;
  name: string;
}

export interface Province {
  id: number;
  name: string;
}

export interface RecetarioMedication {
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
    action?: string;
    barcode?: string;
    power?: { value: string; unit: string };
  };
}

function getRecetarioConfig(): RecetarioConfig {
  if (_config) return _config;
  return {
    apiUrl: process.env.RECETARIO_API_URL || 'https://external-api.recetario.com.ar',
    jwt: process.env.RECETARIO_JWT || '',
  };
}

function createClient(): AxiosInstance {
  const { apiUrl, jwt } = getRecetarioConfig();

  const instance = axios.create({
    baseURL: apiUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    instance.interceptors.request.use((config) => {
      console.log(`[Recetario] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      if (config.data) {
        console.log('[Recetario] Payload:', JSON.stringify(config.data, null, 2));
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => {
        console.log(`[Recetario] Response ${response.status}:`, JSON.stringify(response.data, null, 2));
        return response;
      },
      (error) => {
        if (error.response) {
          console.error(`[Recetario] Error ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
        }
        return Promise.reject(error);
      }
    );
  }

  return instance;
}

async function handleRequest<T>(request: Promise<{ data: T }>): Promise<T> {
  try {
    const response = await request;
    return response.data;
  } catch (err) {
    const error = err as AxiosError<{ message?: string; error?: string }>;
    if (error.response) {
      console.error('[Recetario] API error', error.response.status);
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Recetario API error';
    const status = error.response?.status || 500;
    throw Object.assign(new Error(`Recetario: ${message}`), { status });
  }
}

function isMocked(): boolean {
  return process.env.MOCK_RECETARIO === 'true';
}

function mockResponse<T>(method: string, url: string, dataOrParams?: any): T {
  console.log(`\n[Recetario][MOCK] ${method.toUpperCase()} ${url}`);
  if (dataOrParams) {
    console.log('[Recetario][MOCK] Payload:', JSON.stringify(dataOrParams, null, 2));
  }
  return {} as T;
}

// --- Quick Links ---
export async function createQuickLinks(payload: QuickLinkPayload): Promise<QuickLinkResponse> {
  const client = createClient();
  return handleRequest(client.post('/quick-links', payload));
}

// --- Prescriptions ---
export async function createPrescription(payload: PrescriptionPayload): Promise<any> {
  if (isMocked()) return mockResponse('POST', '/prescriptions', payload);
  const client = createClient();
  return handleRequest(client.post('/prescriptions', payload));
}

// --- Orders ---
export async function createOrder(payload: OrderPayload): Promise<any> {
  if (isMocked()) return mockResponse('POST', '/orders', payload);
  const client = createClient();
  return handleRequest(client.post('/orders', payload));
}

// --- Cancel ---
export async function cancelPrescription(id: number): Promise<any> {
  const client = createClient();
  return handleRequest(client.post(`/prescriptions/${id}/cancel`));
}

// --- Medical Documents ---
export async function getMedicalDocuments(filters: Record<string, any>): Promise<MedicalDocumentsResponse> {
  const client = createClient();
  return handleRequest(client.get('/medical-documents', { params: filters }));
}

// --- Share ---
export async function shareMedicalDocuments(payload: SharePayload): Promise<any> {
  const client = createClient();
  return handleRequest(client.post('/medical-documents/share', payload));
}

// --- Health Insurances ---
export async function getHealthInsurances(): Promise<HealthInsurance[]> {
  const client = createClient();
  return handleRequest(client.get('/health-insurances'));
}

// --- Provinces ---
export async function getProvinces(): Promise<Province[]> {
  const client = createClient();
  return handleRequest(client.get('/provinces'));
}

// --- Medications ---
export async function getMedications(search: string): Promise<RecetarioMedication[]> {
  const client = createClient();
  return handleRequest(client.get('/medications', { params: { search } }));
}

// --- Health Centers ---
export async function createHealthCenter(payload: HealthCenterPayload): Promise<any> {
  const client = createClient();
  return handleRequest(client.post('/health-centers', payload));
}

export async function getHealthCenters(): Promise<any[]> {
  const client = createClient();
  return handleRequest(client.get('/health-centers'));
}

// --- Patients ---
export interface RecetarioPatient {
  id?: number;
  name: string;
  surname: string;
  documentNumber: string;
  gender: string;
  birthDate: string;
  healthInsurance?: string;
  insuranceNumber?: string;
  email?: string;
  phone?: string;
  healthCenterId?: number;
}

export async function getPatients(): Promise<RecetarioPatient[]> {
  const client = createClient();
  return handleRequest(client.get('/patients'));
}

export async function upsertPatient(data: RecetarioPatient): Promise<any> {
  const client = createClient();
  return handleRequest(client.put('/patients', data));
}

// --- Users ---
export async function getUsersByDocumentNumber(documentNumber: string, healthCenterId?: number): Promise<any[]> {
  const params: Record<string, any> = { documentNumber };
  if (healthCenterId) params.healthCenterId = healthCenterId;
  const client = createClient();
  return handleRequest(client.get('/users', { params }));
}

export async function createRecetarioUser(payload: RecetarioUserPayload): Promise<any> {
  const client = createClient();
  return handleRequest(client.post('/users', payload));
}

export async function updateUserSignature(userId: number, signatureBase64: string): Promise<any> {
  const client = createClient();
  return handleRequest(client.put(`/users/${userId}/signature`, { signature: signatureBase64 }));
}

export async function updateUserStatus(userId: number, enabled: boolean): Promise<any> {
  const client = createClient();
  return handleRequest(client.put(`/users/${userId}/status`, { enabled }));
}
