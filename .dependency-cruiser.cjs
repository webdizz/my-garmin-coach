/**
 * Architecture boundaries for src/. Enforced by `npm run arch`.
 *
 * Layers (a module may only import from layers below it):
 *   app            src/app, src/components, src/proxy.ts, src/instrumentation.ts
 *     -> sync, auth
 *       -> garmin, db
 *
 * Hard rules:
 *   - garmin never imports from app, sync, auth or db.
 *   - db never imports from app, sync, auth or garmin.
 *   - sync and auth never import each other.
 *   - no circular dependencies.
 *   - no orphaned modules (no imports in or out), except known entry points.
 *
 * Tests (src/**\/__tests__) are exempt from layer rules: they may reach any layer.
 */
const TEST = /\/__tests__\//;

// A rule that forbids `from` modules importing `to` modules, excluding tests.
const forbid = (name, from, to, comment) => ({
  name,
  severity: 'error',
  comment,
  from: { path: from, pathNot: TEST.source },
  to: { path: to },
});

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make layering meaningless and break bundling.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment:
        'Every module must be reachable or intentionally an entry point. Delete dead modules or wire them in.',
      from: {
        orphan: true,
        pathNot: [
          // Next.js file-convention entry points, loaded by the framework, not by import.
          '(^|/)(page|layout|route|loading|error|not-found|global-error|template|default|opengraph-image|icon|apple-icon|sitemap|robots|manifest)\\.(ts|tsx|js|jsx)$',
          '^src/proxy\\.ts$',
          '^src/instrumentation\\.ts$',
          '\\.d\\.ts$',
          TEST.source,
          // Public type/index barrels and config files that nothing imports by path.
          '^src/app/globals\\.css$',
        ],
      },
      to: {},
    },
    forbid(
      'garmin-no-upward-imports',
      '^src/garmin/',
      '^src/(app|components|sync|auth)/|^src/(proxy|instrumentation)\\.ts$',
      'garmin is the bottom layer. It must never import from app, sync or auth.'
    ),
    forbid(
      'db-no-upward-imports',
      '^src/db/',
      '^src/(app|components|sync|auth|garmin)/|^src/(proxy|instrumentation)\\.ts$',
      'db is a bottom layer. It must not import from app, sync, auth or garmin.'
    ),
    forbid(
      'sync-no-auth',
      '^src/sync/',
      '^src/auth/',
      'sync and auth are peers. Sync must not depend on the login layer.'
    ),
    forbid(
      'auth-no-sync',
      '^src/auth/',
      '^src/sync/',
      'sync and auth are peers. Auth must not depend on the sync job.'
    ),
    forbid(
      'sync-auth-no-app',
      '^src/(sync|auth)/',
      '^src/(app|components)/|^src/(proxy|instrumentation)\\.ts$',
      'sync and auth are below app. Pages, route handlers and proxy depend on them, not the reverse.'
    ),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(\\.next|graphify-out|coverage|drizzle)/' },
    includeOnly: { path: '^src/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
