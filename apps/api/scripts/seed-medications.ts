import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import app from '../src/app';

export async function seedMedications() {
  console.log('Seeding medications and laboratories...');
  
  const csvPath = path.join(__dirname, './seeds/medicamentos_anmat_completo.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Parsed ${records.length} records from CSV.`);
  if (records.length > 0) {
    console.log('First record keys:', Object.keys(records[0] as object));
  }

  const laboratoriesService = app.service('laboratories');
  const medicationsService = app.service('medications');

  // 1. Extract and seed unique laboratories
  const uniqueLabNames = Array.from(new Set(records.map((r: any) => r.Laboratorio?.trim()))).filter(Boolean);
  console.log(`Found ${uniqueLabNames.length} unique laboratories.`);

  const labMap = new Map<string, string>();
  
  for (const labName of uniqueLabNames as string[]) {
    try {
      const lab = await laboratoriesService.create({ name: labName });
      labMap.set(labName, lab.id);
    } catch (error: any) {
      // If already exists, find it
      const existing = await laboratoriesService.find({
        query: { name: labName, $limit: 1 },
        paginate: false
      }) as any[];
      if (existing.length > 0) {
        labMap.set(labName, existing[0].id);
      }
    }
  }

  // 2. Seed medications
  const medicationsData = records
    .filter((r: any) => r.Nombre_Comercial_Presentacion && r.Monodroga_Generico)
    .map((r: any) => ({
      commercialNamePresentation: r.Nombre_Comercial_Presentacion,
      genericDrug: r.Monodroga_Generico,
      laboratoryId: labMap.get(r.Laboratorio?.trim()),
      pharmaceuticalForm: r.Forma_Farmaceutica,
      certificateNumber: r.Numero_Certificado,
      gtin: r.GTIN,
      availability: r.Disponibilidad
    }));

  console.log(`Filtered to ${medicationsData.length} valid medications.`);

  const chunkSize = 500;
  for (let i = 0; i < medicationsData.length; i += chunkSize) {
    const chunk = medicationsData.slice(i, i + chunkSize);
    await medicationsService.create(chunk);
    if (i % 5000 === 0) {
      console.log(`Seeded ${i} / ${medicationsData.length} medications`);
    }
  }

  console.log('Medications and laboratories seeding completed.');
}

if (require.main === module) {
  seedMedications()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
