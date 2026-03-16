import { Sequelize, DataTypes, Model, ModelStatic } from 'sequelize';
import { makeDefine } from './sequelize';

interface DecryptableModel extends ModelStatic<Model> {
  decryptedAttributes?: unknown[];
}

export interface Models {
  patients: ModelStatic<Model>;
  personal_data: ModelStatic<Model>;
  contact_data: ModelStatic<Model>;
  patient_personal_data: ModelStatic<Model>;
  patient_contact_data: ModelStatic<Model>;
  users: ModelStatic<Model>;
  user_personal_data: ModelStatic<Model>;
  user_contact_data: ModelStatic<Model>;
  md_settings: ModelStatic<Model>;
  organizations: ModelStatic<Model>;
  organization_users: ModelStatic<Model>;
  organization_patients: ModelStatic<Model>;
  encounters: DecryptableModel;
  prescriptions: ModelStatic<Model>;
  icd_10: ModelStatic<Model>;
  medications: ModelStatic<Model>;
  access_logs: ModelStatic<Model>;
}

export function defineModels(sequelize: Sequelize): Models {
  const define = makeDefine(sequelize);

  const patients = sequelize.define('patients', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    mugshot: { type: DataTypes.TEXT, allowNull: true },
    medicare: { type: DataTypes.STRING, allowNull: true },
    medicareId: { type: DataTypes.STRING, allowNull: true },
    medicareNumber: { type: DataTypes.TEXT, allowNull: true },
    medicarePlan: { type: DataTypes.STRING, allowNull: true },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  });

  const personal_data = sequelize.define('personal_data', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    firstName: { type: DataTypes.STRING, allowNull: true },
    lastName: { type: DataTypes.STRING, allowNull: true },
    nationality: { type: DataTypes.STRING, allowNull: true },
    documentType: { type: DataTypes.STRING, allowNull: true },
    documentValue: { type: DataTypes.TEXT, allowNull: false },
    maritalStatus: { type: DataTypes.STRING, allowNull: true },
    birthDate: { type: DataTypes.TEXT, allowNull: true },
    gender: { type: DataTypes.STRING, allowNull: true },
  });

  const contact_data = sequelize.define('contact_data', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    streetAddress: { type: DataTypes.TEXT, allowNull: true },
    country: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.TEXT, allowNull: true },
    province: { type: DataTypes.TEXT, allowNull: true },
    phoneNumber: { type: DataTypes.TEXT, allowNull: true },
    email: { type: DataTypes.TEXT, allowNull: true },
  });

  const patient_personal_data = sequelize.define('patient_personal_data', {
    ownerId: { type: DataTypes.STRING, allowNull: false },
    personalDataId: { type: DataTypes.STRING, allowNull: false },
  });

  const patient_contact_data = sequelize.define('patient_contact_data', {
    ownerId: { type: DataTypes.STRING, allowNull: false },
    contactDataId: { type: DataTypes.STRING, allowNull: false },
  });

  const users = sequelize.define('users', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    username: { type: DataTypes.STRING, allowNull: false },
    isSuperAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  });

  const user_personal_data = sequelize.define('user_personal_data', {
    ownerId: { type: DataTypes.STRING, allowNull: false },
    personalDataId: { type: DataTypes.STRING, allowNull: false },
  });

  const user_contact_data = sequelize.define('user_contact_data', {
    ownerId: { type: DataTypes.STRING, allowNull: false },
    contactDataId: { type: DataTypes.STRING, allowNull: false },
  });

  const md_settings = sequelize.define('md_settings', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    organizationId: { type: DataTypes.STRING, allowNull: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    medicalSpecialty: { type: DataTypes.STRING, allowNull: true },
    nationalLicenseNumber: { type: DataTypes.STRING, allowNull: true },
    stateLicense: { type: DataTypes.STRING, allowNull: true },
    stateLicenseNumber: { type: DataTypes.STRING, allowNull: true },
    isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    title: { type: DataTypes.STRING, allowNull: true },
  });

  const organizations = sequelize.define('organizations', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  });

  const organization_users = sequelize.define('organization_users', {
    organizationId: { type: DataTypes.STRING, allowNull: false },
    userId: { type: DataTypes.STRING, allowNull: false },
  });

  const organization_patients = sequelize.define('organization_patients', {
    organizationId: { type: DataTypes.STRING, allowNull: false },
    patientId: { type: DataTypes.STRING, allowNull: false },
  });

  const encounters = define('encounters', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    date: { type: DataTypes.DATE, allowNull: false },
    medicId: { type: DataTypes.STRING, allowNull: false },
    patientId: { type: DataTypes.STRING, allowNull: false },
    organizationId: { type: DataTypes.STRING, allowNull: false },
    insurerId: { type: DataTypes.STRING, allowNull: true },
    data: { type: DataTypes.BLOB, allowNull: true },
    hash: { type: DataTypes.STRING(64), allowNull: true },
    previousEncounterId: { type: DataTypes.STRING, allowNull: true },
  }, {
    encryptedFields: ['data'],
  });

  const prescriptions = sequelize.define('prescriptions', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    medicId: { type: DataTypes.STRING, allowNull: false },
    patientId: { type: DataTypes.STRING, allowNull: false },
    organizationId: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    content: { type: DataTypes.JSONB, allowNull: true },
  });

  const icd_10 = sequelize.define('icd_10', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    parent: { type: DataTypes.STRING, allowNull: true },
    children: { type: DataTypes.JSONB, allowNull: true },
  });

  const medications = sequelize.define('medications', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    commercialNamePresentation: { type: DataTypes.TEXT, allowNull: true },
    genericDrug: { type: DataTypes.TEXT, allowNull: true },
    pharmaceuticalForm: { type: DataTypes.STRING, allowNull: true },
    certificateNumber: { type: DataTypes.STRING, allowNull: true },
    gtin: { type: DataTypes.STRING, allowNull: true },
  });

  const access_logs = sequelize.define('access_logs', {
    id: { type: DataTypes.STRING, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.STRING, allowNull: false },
    organizationId: { type: DataTypes.STRING, allowNull: true },
    resource: { type: DataTypes.STRING, allowNull: false },
    patientId: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    purpose: { type: DataTypes.STRING, allowNull: false, defaultValue: 'treatment' },
    refesId: { type: DataTypes.STRING, allowNull: true },
    hash: { type: DataTypes.STRING(64), allowNull: true },
    previousLogId: { type: DataTypes.STRING, allowNull: true },
    ip: { type: DataTypes.STRING, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: true },
  }, {
    updatedAt: false,
  });

  // Associations (read-only, no constraints)
  patients.belongsToMany(personal_data, {
    through: { model: patient_personal_data, unique: true },
    foreignKey: 'ownerId',
    otherKey: 'personalDataId',
  });
  patients.belongsToMany(contact_data, {
    through: { model: patient_contact_data, unique: true },
    foreignKey: 'ownerId',
    otherKey: 'contactDataId',
  });
  patients.hasMany(encounters, { foreignKey: 'patientId', constraints: false });
  patients.hasMany(prescriptions, { foreignKey: 'patientId', constraints: false });

  users.belongsToMany(personal_data, {
    through: { model: user_personal_data, unique: true },
    foreignKey: 'ownerId',
    otherKey: 'personalDataId',
  });
  users.belongsToMany(contact_data, {
    through: { model: user_contact_data, unique: true },
    foreignKey: 'ownerId',
    otherKey: 'contactDataId',
  });
  users.hasOne(md_settings, { foreignKey: 'userId', constraints: false });

  organizations.belongsToMany(users, {
    through: { model: organization_users, unique: true },
    foreignKey: 'organizationId',
    otherKey: 'userId',
    as: 'members',
  });
  organizations.belongsToMany(patients, {
    through: { model: organization_patients, unique: true },
    foreignKey: 'organizationId',
    otherKey: 'patientId',
    as: 'orgPatients',
  });

  encounters.belongsTo(patients, { foreignKey: 'patientId', constraints: false });
  encounters.belongsTo(users, { foreignKey: 'medicId', constraints: false, as: 'medic' });
  encounters.belongsTo(organizations, { foreignKey: 'organizationId', constraints: false });

  md_settings.belongsTo(users, { foreignKey: 'userId' });
  md_settings.belongsTo(organizations, { foreignKey: 'organizationId' });

  return {
    patients,
    personal_data,
    contact_data,
    patient_personal_data,
    patient_contact_data,
    users,
    user_personal_data,
    user_contact_data,
    md_settings,
    organizations,
    organization_users,
    organization_patients,
    encounters,
    prescriptions,
    icd_10,
    medications,
    access_logs,
  };
}
