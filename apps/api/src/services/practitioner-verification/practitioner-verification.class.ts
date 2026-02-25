import { Params } from '@feathersjs/feathers';
import { Application } from '../../declarations';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { BadRequest, GeneralError, NotFound } from '@feathersjs/errors';

interface ScrapedLicenseData {
  expirationDate: string;
  matricula?: string;
  jurisdiccion?: string;
  especialidad?: string;
}

interface VerificationResult {
  isVerified: boolean;
  message: string;
  data?: {
    medicalSpecialty?: string;
    stateLicense?: string;
    stateLicenseNumber?: string;
    expirationDate?: string;
  };
}

const SSSALUD_URL = 'https://www.sssalud.gob.ar/index.php?page=busmed&cat=prestadores';

export function scrapeSssaludHtml(html: string): ScrapedLicenseData | null {
  const $ = cheerio.load(html);

  const tableSelector = 'table.table-striped.table-responsive';
  if ($(tableSelector).length === 0) {
    return null;
  }

  const scrapedData: Partial<ScrapedLicenseData> = {};
  const rows = $(`${tableSelector} tbody tr`);

  rows.each((_, row) => {
    const $row = $(row);

    // Handle rows with multiple th/td pairs
    const cells = $row.children();
    for (let i = 0; i < cells.length; i += 2) {
      const keyCell = $(cells[i]);
      const valueCell = $(cells[i + 1]);

      if (keyCell.is('th') && valueCell.is('td')) {
        const key = keyCell.text().trim();
        const value = valueCell.text().trim();

        if (key === 'Válido hasta') scrapedData.expirationDate = value;
        if (key === 'Matrícula') scrapedData.matricula = value;
        if (key === 'Jurisdicción') scrapedData.jurisdiccion = value;
        if (key === 'Especialidad') scrapedData.especialidad = value;
      }
    }
  });

  if (!scrapedData.expirationDate) {
    return null;
  }

  return scrapedData as ScrapedLicenseData;
}

export function parseExpirationDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('/');
  return new Date(`${year}-${month}-${day}`);
}

export class PractitionerVerification {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  private async fetchAndScrape(dni: string): Promise<ScrapedLicenseData> {
    const formData = new URLSearchParams();
    formData.append('txtnrodoc', dni);

    const response = await axios.post(SSSALUD_URL, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
    });

    const scraped = scrapeSssaludHtml(response.data);
    if (!scraped) {
      throw new NotFound('Practitioner not found in SSSalud registry');
    }
    return scraped;
  }

  private async getDniForUser(userId: string): Promise<string> {
    const userPersonalData = await this.app.service('user-personal-data').find({
      query: { ownerId: userId, $limit: 1 },
      paginate: false,
    }) as any[];

    if (!userPersonalData.length) {
      throw new BadRequest('User has no personal data linked');
    }

    const personalData = await this.app.service('personal-data').get(userPersonalData[0].personalDataId);

    if (!personalData.documentValue) {
      throw new BadRequest('User has no document number (DNI)');
    }

    return personalData.documentValue;
  }

  async verifyByUserId(userId: string): Promise<VerificationResult> {
    const dni = await this.getDniForUser(userId);
    const scrapedData = await this.fetchAndScrape(dni);

    const expirationDate = parseExpirationDate(scrapedData.expirationDate);
    const now = new Date();

    if (expirationDate < now) {
      throw new BadRequest(`License expired on ${scrapedData.expirationDate}`);
    }

    // YYYY-MM-DD format for DATEONLY column
    const licenseExpirationDate = `${scrapedData.expirationDate.split('/').reverse().join('-')}`;

    const mdSettings = await this.app.service('md-settings').find({
      query: { userId, $limit: 1 },
      paginate: false,
    }) as any[];

    const patchData: Record<string, unknown> = {
      isVerified: true,
      licenseExpirationDate,
      verificationRetries: 0,
      nextVerificationRetry: null,
    };

    if (scrapedData.matricula) patchData.stateLicenseNumber = scrapedData.matricula;
    if (scrapedData.jurisdiccion) patchData.stateLicense = scrapedData.jurisdiccion;
    if (scrapedData.especialidad && scrapedData.especialidad !== '--') {
      patchData.medicalSpecialty = scrapedData.especialidad;
    }

    if (mdSettings.length > 0) {
      await this.app.service('md-settings').patch(mdSettings[0].id, patchData);
    } else {
      await this.app.service('md-settings').create({
        userId,
        encounterDuration: 20,
        ...patchData,
      });
    }

    return {
      isVerified: true,
      message: 'Practitioner verified successfully',
      data: {
        expirationDate: scrapedData.expirationDate,
        stateLicenseNumber: scrapedData.matricula,
        stateLicense: scrapedData.jurisdiccion,
        medicalSpecialty: scrapedData.especialidad,
      },
    };
  }

  async create(data: any, params?: Params): Promise<VerificationResult> {
    const userId = params?.user?.id;
    if (!userId) {
      throw new BadRequest('User not authenticated');
    }

    try {
      return await this.verifyByUserId(String(userId));
    } catch (error: any) {
      if (error.code) {
        throw error;
      }
      console.error('Practitioner verification failed:', error);
      throw new GeneralError(`Verification failed: ${error.message}`);
    }
  }
}
