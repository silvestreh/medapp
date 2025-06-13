import { Hook, HookContext } from '@feathersjs/feathers';
import { intersection, omit } from 'lodash';

import type { PersonalData, PatientPersonalData } from '../../../declarations';

export const findByPersonalData = (): Hook => {
  return async (context: HookContext) => {
    const { app, params } = context;
    const searchableFields = ['firstName', 'lastName', 'documentValue', 'birthDate'];

    if (!params.query) {
      return context;
    }

    if (!intersection(Object.keys(params.query), searchableFields).length) {
      return context;
    }

    const {
      firstName,
      lastName,
      documentValue,
      birthDate
    } = params.query || {};

    // Construct $or query for searchable fields
    const orConditions = [];

    // Split firstName and lastName by spaces and create $or conditions for each term
    const addSearchTerms = (field: string, value: string) => {
      const terms = value.split(' ');
      terms.forEach(term => {
        orConditions.push({ [field]: { $iLike: `%${term}%` } });
      });
    };

    if (firstName) addSearchTerms('firstName', firstName);
    if (lastName) addSearchTerms('lastName', lastName);
    if (documentValue) orConditions.push({ documentValue });
    if (birthDate) orConditions.push({ birthDate });

    if (orConditions.length === 0) {
      return context;
    }

    const personalDataQuery = {
      $or: orConditions
    };

    // Find matching personal data records using service
    const personalDataResults = await app.service('personal-data').find({
      query: personalDataQuery,
      paginate: false
    });

    // For each personal data record, find associated patients
    const patientPersonalDataResults = await app.service('patient-personal-data').find({
      query: {
        personalDataId: {
          $in: personalDataResults.map((pd: PersonalData) => pd.id)
        }
      },
      paginate: false
    });

    // Extract unique patient IDs
    const patientIds = [...new Set(patientPersonalDataResults.map((ppd: PatientPersonalData) => ppd.ownerId))];

    // Update the query to filter by found patient IDs
    context.params.query = {
      ...omit(params.query, 'firstName', 'lastName', 'documentValue', 'birthDate'),
      id: {
        $in: patientIds
      }
    };

    return context;
  };
};

