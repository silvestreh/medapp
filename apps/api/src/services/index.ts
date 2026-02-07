import { Application } from '../declarations';
import users from './users/users.service';
import appointments from './appointments/appointments.service';
import patients from './patients/patients.service';
import personalData from './personal-data/personal-data.service';
import contactData from './contact-data/contact-data.service';
import mdSettings from './md-settings/md-settings.service';
import encounters from './encounters/encounters.service';
import userPersonalData from './user-personal-data/user-personal-data.service';
import userContactData from './user-contact-data/user-contact-data.service';
import patientPersonalData from './patient-personal-data/patient-personal-data.service';
import patientContactData from './patient-contact-data/patient-contact-data.service';
import roles from './roles/roles.service';
import studies from './studies/studies.service';
import studyResults from './study-results/study-results.service';
import icd10 from './icd-10/icd-10.service';
// Don't remove this comment. It's needed to format import lines nicely.

export default function (app: Application): void {
  app.configure(users);
  app.configure(appointments);
  app.configure(patients);
  app.configure(personalData);
  app.configure(contactData);
  app.configure(mdSettings);
  app.configure(encounters);
  app.configure(userPersonalData);
  app.configure(userContactData);
  app.configure(patientPersonalData);
  app.configure(patientContactData);
  app.configure(roles);
  app.configure(studies);
  app.configure(studyResults);
  app.configure(icd10);
}
