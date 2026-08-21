import app from '../src/app';

// Mocha root hook: boot the app before any test runs. Sequelize associations
// are only wired in app.setup(), which used to run solely via app.listen() in
// app.test.ts — so any filtered run (mocha --grep) that skipped that file hit
// "X is not associated to Y!" on the first query with an include.
export const mochaHooks = {
  beforeAll(): void {
    app.setup();
  }
};
