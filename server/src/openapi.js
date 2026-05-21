import swaggerJsdoc from 'swagger-jsdoc';

// OpenAPI 3.0 spec for AfyaConnect. Currently auto-discovers endpoint summaries
// from JSDoc @openapi blocks in route files. Routes that don't yet have a block
// still appear in the running app but won't be listed in /api/docs — that's the
// gradual-rollout strategy from the plan: document routes one PR at a time.
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'AfyaConnect API',
    version: '1.0.0',
    description:
      'Refugee healthcare platform API: clinic queues, appointments, education, SOS, and admin operations.',
    contact: { name: 'AfyaConnect', url: 'https://afyaconnect.org' },
    license: { name: 'Proprietary' },
  },
  servers: [
    { url: 'http://localhost:4000/api', description: 'Local dev' },
    { url: '/api', description: 'Same-origin' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  tags: [
    { name: 'auth', description: 'Registration, login, password reset' },
    { name: 'clinics', description: 'Partner clinic directory' },
    { name: 'appointments', description: 'Booking, slots, ticket lookup' },
    { name: 'queue', description: 'Live queue state per clinic' },
    { name: 'education', description: 'Multilingual health topics' },
    { name: 'sos', description: 'Emergency alerts' },
    { name: 'notifications', description: 'Campaigns, alerts, SOS history' },
    { name: 'metrics', description: 'Impact dashboard data' },
  ],
};

export const openapiSpec = swaggerJsdoc({
  definition,
  apis: ['./src/routes/*.js'],
});
