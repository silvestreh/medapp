import { Hook, HookContext } from '@feathersjs/feathers';
import { intersection, omit } from 'lodash';
import { Sequelize, QueryTypes } from 'sequelize';

import type { PersonalData, PatientPersonalData } from '../../../declarations';
import { encryptValue } from '../../../hooks/encryption';

export const findByPersonalData = (): Hook => {
  return async (context: HookContext) => {
    const { app, params } = context;
    const searchableFields = ['firstName', 'lastName', 'documentValue', 'birthDate', 'q'];

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
      birthDate,
      q
    } = params.query || {};

    const sequelize: Sequelize = app.get('sequelizeClient');
    let personalDataIds: string[] = [];

    if (firstName || lastName || q) {
      // Use custom SQL for ranked search
      const searchTerms: string[] = [];
      if (firstName) searchTerms.push(...firstName.toLowerCase().split(' '));
      if (lastName) searchTerms.push(...lastName.toLowerCase().split(' '));
      if (q) searchTerms.push(...q.toLowerCase().split(' '));
      
      const uniqueTerms = [...new Set(searchTerms.filter(t => t.length > 0))];
      
      if (uniqueTerms.length > 0) {
        const fullNameSearch = (q || `${firstName || ''} ${lastName || ''}`).trim().toLowerCase();
        const unaccentedFullName = sequelize.escape(fullNameSearch);
        
        let rankSql = '0';
        const whereConditions: string[] = [];

        // 100 points for exact full name match
        rankSql += ` + (CASE WHEN immutable_unaccent(lower(concat_ws(' ', "firstName", "lastName"))) = immutable_unaccent(${unaccentedFullName}) THEN 100 ELSE 0 END)`;
        
        // 150 points for document value match (documentValue is encrypted in DB)
        if (q || documentValue) {
          const encryptedDoc = encryptValue(q || documentValue);
          if (encryptedDoc) {
            const escapedEncryptedDoc = sequelize.escape(encryptedDoc);
            rankSql += ` + (CASE WHEN "documentValue" = ${escapedEncryptedDoc} THEN 150 ELSE 0 END)`;
            whereConditions.push(`"documentValue" = ${escapedEncryptedDoc}`);
          }
        }

        uniqueTerms.forEach((term) => {
          const escapedTerm = sequelize.escape(term);
          const unaccentedTerm = `immutable_unaccent(${escapedTerm})`;
          const pattern = `('%' || ${unaccentedTerm} || '%')`;
          const startsWithPattern = `(${unaccentedTerm} || '%')`;
          
          rankSql += ` + (CASE 
            WHEN "searchFirstName" = ${unaccentedTerm} OR "searchLastName" = ${unaccentedTerm} THEN 50
            WHEN "searchFirstName" LIKE ${startsWithPattern} OR "searchLastName" LIKE ${startsWithPattern} THEN 20
            WHEN "searchFirstName" LIKE ${pattern} OR "searchLastName" LIKE ${pattern} THEN 10
            ELSE 0 
          END)`;

          whereConditions.push(`("searchFirstName" LIKE ${pattern} OR "searchLastName" LIKE ${pattern})`);
        });

        const query = `
          SELECT id, (${rankSql}) as rank
          FROM "personal_data"
          WHERE ${whereConditions.join(' OR ')}
          ORDER BY rank DESC, "lastName" ASC, "firstName" ASC
        `;

        const results = await sequelize.query<{ id: string; rank: number }>(query, {
          type: QueryTypes.SELECT
        });

        personalDataIds = results.map(r => r.id);
      }
    } else {
      // Fallback to standard search for documentValue and birthDate
      const orConditions: Record<string, unknown>[] = [];
      if (documentValue) orConditions.push({ documentValue });
      if (birthDate) orConditions.push({ birthDate });

      if (orConditions.length > 0) {
        const personalDataResults = await app.service('personal-data').find({
          query: { $or: orConditions },
          paginate: false
        }) as PersonalData[];
        personalDataIds = personalDataResults.map(pd => pd.id.toString());
      }
    }

    if (personalDataIds.length === 0) {
      context.params.query = {
        ...omit(params.query, 'firstName', 'lastName', 'documentValue', 'birthDate', 'q'),
        id: 'none'
      };
      return context;
    }

    // For each personal data record, find associated patients
    const patientPersonalDataResults = await app.service('patient-personal-data').find({
      query: {
        personalDataId: {
          $in: personalDataIds
        }
      },
      paginate: false
    }) as PatientPersonalData[];

    // Extract unique patient IDs, preserving order from personalDataIds
    const patientIdsMap = new Map<string, string>();
    patientPersonalDataResults.forEach(ppd => {
      const ownerId = ppd.ownerId.toString();
      const personalDataId = ppd.personalDataId.toString();
      if (!patientIdsMap.has(ownerId)) {
        patientIdsMap.set(ownerId, personalDataId);
      }
    });

    // Sort patientIds based on the order of personalDataIds (ranked order)
    const sortedPatientIds = [...patientIdsMap.keys()].sort((a, b) => {
      const indexA = personalDataIds.indexOf(patientIdsMap.get(a)!);
      const indexB = personalDataIds.indexOf(patientIdsMap.get(b)!);
      return indexA - indexB;
    });

    // Store the sorted order so the after hook can re-sort results
    context.params._sortedPatientIds = sortedPatientIds;

    // Update the query to filter by found patient IDs
    context.params.query = {
      ...omit(params.query, 'firstName', 'lastName', 'documentValue', 'birthDate', 'q'),
      id: {
        $in: sortedPatientIds
      }
    };

    return context;
  };
};

export const sortByPersonalDataRank = (): Hook => {
  return async (context: HookContext) => {
    const sortedPatientIds: string[] | undefined = context.params._sortedPatientIds;

    if (!sortedPatientIds || sortedPatientIds.length === 0) {
      return context;
    }

    const orderMap = new Map(sortedPatientIds.map((id, index) => [id, index]));

    if (context.result.data) {
      // Paginated result
      context.result.data.sort((a: any, b: any) => {
        const indexA = orderMap.get(a.id?.toString()) ?? Infinity;
        const indexB = orderMap.get(b.id?.toString()) ?? Infinity;
        return indexA - indexB;
      });
    } else if (Array.isArray(context.result)) {
      context.result.sort((a: any, b: any) => {
        const indexA = orderMap.get(a.id?.toString()) ?? Infinity;
        const indexB = orderMap.get(b.id?.toString()) ?? Infinity;
        return indexA - indexB;
      });
    }

    return context;
  };
};
