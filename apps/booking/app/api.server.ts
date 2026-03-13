import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3030';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

interface RequestOtpResponse {
  action: string;
  status: 'otp_sent' | 'not_found' | 'no_phone' | 'rate_limited';
}

interface VerifyOtpResponse {
  action: string;
  verified: boolean;
  accessToken: string;
  patient: { id: string };
}

export async function requestOtp(documentNumber: string): Promise<RequestOtpResponse> {
  const { data } = await api.post('/patient-otp', {
    action: 'request-otp',
    documentNumber,
  });
  return data;
}

export async function verifyOtp(documentNumber: string, code: string): Promise<VerifyOtpResponse> {
  const { data } = await api.post('/patient-otp', {
    action: 'verify-otp',
    documentNumber,
    code,
  });
  return data;
}
