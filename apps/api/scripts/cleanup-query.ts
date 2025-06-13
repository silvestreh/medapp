export const cleanUpQuery = /* sql */ `
WITH orphaned_patients AS (
    SELECT DISTINCT p.id
    FROM patients p
    LEFT JOIN encounters e ON p.id = e."patientId"
    LEFT JOIN appointments a ON p.id = a."patientId"
    LEFT JOIN studies s ON p.id = s."patientId"
    WHERE e."patientId" IS NULL
      AND a."patientId" IS NULL
      AND s."patientId" IS NULL
)
, deleted_patient_contact AS (
    DELETE FROM patient_contact_data
    WHERE "ownerId" IN (SELECT id FROM orphaned_patients)
    RETURNING "contactDataId"
)
, deleted_patient_personal AS (
    DELETE FROM patient_personal_data
    WHERE "ownerId" IN (SELECT id FROM orphaned_patients)
    RETURNING "personalDataId"
)
, deleted_personal_data AS (
    DELETE FROM personal_data
    WHERE id IN (
        SELECT "personalDataId"
        FROM deleted_patient_personal
        WHERE "personalDataId" NOT IN (
            SELECT "personalDataId" FROM user_personal_data
        )
    )
)
, deleted_contact_data AS (
    DELETE FROM contact_data
    WHERE id IN (
        SELECT "contactDataId"
        FROM deleted_patient_contact
        WHERE "contactDataId" NOT IN (
            SELECT "contactDataId" FROM user_contact_data
        )
    )
)
DELETE FROM patients
WHERE id IN (SELECT id FROM orphaned_patients);
`;

export const restorePatientsQuery = /* sql */ `
UPDATE patients
SET deleted = false
WHERE deleted = true
  AND id IN (
    SELECT DISTINCT "patientId"
    FROM (
      SELECT "patientId" FROM encounters
      UNION
      SELECT "patientId" FROM appointments
      UNION
      SELECT "patientId" FROM studies
    ) AS patient_references
  );
`;
