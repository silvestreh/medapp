import { HookContext } from '@feathersjs/feathers';

/**
 * Excludes deactivated establishments (dropped from the national registry)
 * from find results unless the caller asks for them explicitly with an
 * `isActive` query param. Gets by id are unaffected, so establishments
 * already referenced by an organization keep resolving.
 */
export const filterActive = () => {
  return async (context: HookContext) => {
    const { params } = context;
    params.query = params.query || {};

    if (params.query.isActive === undefined) {
      params.query.isActive = true;
    }

    return context;
  };
};
