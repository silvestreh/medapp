// True for a Postgres unique-constraint violation in any of the shapes it
// reaches application code: raw Sequelize, its `errors[]` detail, or the
// BadRequest('Validation error') feathers-sequelize wraps it into.
export const isUniqueViolation = (error: any): boolean =>
  error?.name === 'SequelizeUniqueConstraintError' ||
  error?.errors?.some?.((e: any) => e?.type === 'unique violation') ||
  (error?.code === 400 && error?.message === 'Validation error');
