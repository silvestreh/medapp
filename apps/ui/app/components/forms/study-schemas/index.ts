import type { StudySchema } from '../study-form-types';

import anemia from './anemia.json';
import anticoagulation from './anticoagulation.json';
import compatibility from './compatibility.json';
import hemostasis from './hemostasis.json';
import myelogram from './myelogram.json';
import thrombophilia from './thrombophilia.json';

export const studySchemas = {
  anemia,
  anticoagulation,
  compatibility,
  hemostasis,
  myelogram,
  thrombophilia,
} as Record<string, StudySchema>;

export { anemia, anticoagulation, compatibility, hemostasis, myelogram, thrombophilia };
