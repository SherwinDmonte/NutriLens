import { getDatabaseName, getDatabaseStatus } from '../config/db.js';

export function getHealthStatus() {
  return {
    status: 'ok',
    service: 'nutrilens-api',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      name: getDatabaseName(),
      status: getDatabaseStatus(),
    },
  };
}
