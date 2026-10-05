/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'cross-module-internals',
      comment: 'Otro módulo solo puede entrar por public-api.ts',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/',
        pathNot: ['^src/modules/$1/', 'public-api\\.ts$'],
      },
    },
    {
      name: 'listeners-are-not-imported',
      comment: 'Gamificación, analítica y notificaciones solo reaccionan a eventos',
      severity: 'error',
      from: { path: '^src/modules/(?!gamification|analytics|notifications)' },
      to: { path: '^src/modules/(gamification|analytics|notifications)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
