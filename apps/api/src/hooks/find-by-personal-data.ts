import { Hook, HookContext } from '@feathersjs/feathers';
import { intersection, omit } from 'lodash';
import { Sequelize, QueryTypes } from 'sequelize';

import type { PersonalData } from '../declarations';
import { encryptValue } from './encryption';

interface FindByPersonalDataOptions {
  junctionService: string;  // e.g. 'patient-personal-data' or 'user-personal-data'
  foreignKey: string;       // e.g. 'id' for patients/users, 'patientId' for studies
}

const searchableFields = ['firstName', 'lastName', 'documentValue', 'birthDate', 'q'];

export const findByPersonalData = (options: FindByPersonalDataOptions): Hook => {
  const { junctionService, foreignKey } = options;

  return async (context: HookContext) => {
    const { app, params } = context;

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
        const fullSearchPattern = `('%' || immutable_unaccent(${unaccentedFullName}) || '%')`;

        let rankSql = '0';
        const whereConditions: string[] = [];

        // 200 points for exact full name match (firstName + lastName = search), 150 for high similarity
        rankSql += ` + (CASE
          WHEN immutable_unaccent(lower(concat_ws(' ', "firstName", "lastName"))) = immutable_unaccent(${unaccentedFullName}) THEN 200
          WHEN similarity(immutable_unaccent(lower(concat_ws(' ', "firstName", "lastName"))), immutable_unaccent(${unaccentedFullName})) > 0.7 THEN 150
          ELSE 0
        END)`;

        // Multi-word contiguous match: rewards full query matching as a phrase within firstName or lastName
        if (uniqueTerms.length > 1) {
          const unaccentedFullNameExpr = `immutable_unaccent(${unaccentedFullName})`;
          rankSql += ` + (CASE
            WHEN "searchFirstName" = ${unaccentedFullNameExpr} OR "searchLastName" = ${unaccentedFullNameExpr} THEN 120
            WHEN "searchFirstName" LIKE ${fullSearchPattern} OR "searchLastName" LIKE ${fullSearchPattern} THEN 80
            WHEN similarity("searchFirstName", ${unaccentedFullNameExpr}) > 0.7 OR similarity("searchLastName", ${unaccentedFullNameExpr}) > 0.7 THEN 70
            WHEN similarity("searchFirstName", ${unaccentedFullNameExpr}) > 0.4 OR similarity("searchLastName", ${unaccentedFullNameExpr}) > 0.4 THEN 40
            ELSE 0
          END)`;
        }

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

          // Per-term scoring: each term can contribute points independently.
          // A record matching ALL terms will accumulate more points than one matching just one.
          // Includes fuzzy matching via pg_trgm word_similarity for typo tolerance.
          rankSql += ` + (CASE
            WHEN "searchFirstName" = ${unaccentedTerm} OR "searchLastName" = ${unaccentedTerm} THEN 50
            WHEN "searchFirstName" LIKE ${startsWithPattern} OR "searchLastName" LIKE ${startsWithPattern} THEN 20
            WHEN "searchFirstName" LIKE ${pattern} OR "searchLastName" LIKE ${pattern} THEN 10
            WHEN word_similarity(${unaccentedTerm}, "searchFirstName") > 0.6 OR word_similarity(${unaccentedTerm}, "searchLastName") > 0.6 THEN 35
            WHEN word_similarity(${unaccentedTerm}, "searchFirstName") > 0.3 OR word_similarity(${unaccentedTerm}, "searchLastName") > 0.3 THEN 5
            ELSE 0
          END)`;

          // WHERE: match by exact substring OR fuzzy similarity (uses GIN trigram index)
          whereConditions.push(`("searchFirstName" LIKE ${pattern} OR "searchLastName" LIKE ${pattern} OR ${unaccentedTerm} <% "searchFirstName" OR ${unaccentedTerm} <% "searchLastName")`);
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
        ...omit(params.query, ...searchableFields),
        [foreignKey]: 'none'
      };
      return context;
    }

    // Resolve personal data IDs to owner IDs via the junction table
    const junctionResults = await app.service(junctionService).find({
      query: {
        personalDataId: {
          $in: personalDataIds
        }
      },
      paginate: false
    }) as any[];

    // Extract unique owner IDs, preserving order from personalDataIds
    const ownerIdsMap = new Map<string, string>();
    junctionResults.forEach((jr: any) => {
      const ownerId = jr.ownerId.toString();
      const personalDataId = jr.personalDataId.toString();
      if (!ownerIdsMap.has(ownerId)) {
        ownerIdsMap.set(ownerId, personalDataId);
      }
    });

    // Sort owner IDs based on the order of personalDataIds (ranked order)
    const sortedOwnerIds = [...ownerIdsMap.keys()].sort((a, b) => {
      const indexA = personalDataIds.indexOf(ownerIdsMap.get(a)!);
      const indexB = personalDataIds.indexOf(ownerIdsMap.get(b)!);
      return indexA - indexB;
    });

    if (sortedOwnerIds.length === 0) {
      context.params.query = {
        ...omit(params.query, ...searchableFields),
        [foreignKey]: 'none'
      };
      return context;
    }

    // Store original pagination params so the after hook can paginate
    // on the actual results (studies) instead of on owner IDs (patients).
    // This is critical for 1:many relationships (e.g. one patient → many studies).
    const $limit = parseInt(params.query.$limit) || 10;
    const $skip = parseInt(params.query.$skip) || 0;

    context.params._sortedOwnerIds = sortedOwnerIds;
    context.params._originalLimit = $limit;
    context.params._originalSkip = $skip;
    context.params._ownerForeignKey = foreignKey;

    // Disable Feathers pagination so all matching records are returned
    // as a plain array; the after hook will re-paginate correctly.
    context.params.paginate = false;

    // Filter by ALL matching owner IDs — pagination happens in the after hook
    const cleanQuery = omit(params.query, ...searchableFields, '$skip', '$limit');
    context.params.query = {
      ...cleanQuery,
      [foreignKey]: {
        $in: sortedOwnerIds
      },
    };

    return context;
  };
};

export const sortByPersonalDataRank = (options?: { foreignKey?: string }): Hook => {
  return async (context: HookContext) => {
    const sortedOwnerIds: string[] | undefined = context.params._sortedOwnerIds;
    const originalLimit: number | undefined = context.params._originalLimit;
    const originalSkip: number | undefined = context.params._originalSkip;
    const fk = options?.foreignKey || context.params._ownerForeignKey || 'id';

    if (!sortedOwnerIds || sortedOwnerIds.length === 0) {
      return context;
    }

    const orderMap = new Map(sortedOwnerIds.map((id, index) => [id, index]));

    const sortFn = (a: any, b: any) => {
      const indexA = orderMap.get(a[fk]?.toString()) ?? Infinity;
      const indexB = orderMap.get(b[fk]?.toString()) ?? Infinity;
      return indexA - indexB;
    };

    // Collect items from either paginated or plain-array result
    let items: any[];
    if (Array.isArray(context.result)) {
      items = context.result;
    } else if (context.result.data) {
      items = context.result.data;
    } else {
      return context;
    }

    items.sort(sortFn);

    // Re-paginate on the actual items (not on owner IDs) so that every
    // page contains exactly $limit results regardless of how many items
    // each owner has.
    if (originalLimit !== undefined) {
      const skip = originalSkip || 0;
      const total = items.length;
      const paginatedItems = items.slice(skip, skip + originalLimit);

      context.result = {
        data: paginatedItems,
        total,
        limit: originalLimit,
        skip,
      };
    } else if (context.result.data) {
      context.result.data = items;
    } else {
      context.result = items;
    }

    return context;
  };
};
