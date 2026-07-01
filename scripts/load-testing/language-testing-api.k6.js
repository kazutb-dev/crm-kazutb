import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    applicants_100: {
      executor: 'constant-vus',
      vus: 100,
      duration: '2m',
      tags: { scale: '100' },
    },
    applicants_500: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 0 },
      ],
      tags: { scale: '500' },
      startTime: '2m',
    },
    applicants_1000: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '3m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
      ],
      tags: { scale: '1000' },
      startTime: '8m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:list-tests}': ['avg<200', 'p(95)<500'],
    'http_req_duration{endpoint:health}': ['avg<150'],
    'checks{endpoint:list-tests}': ['rate>0.99'],
  },
};

const baseUrl = __ENV.K6_BASE_URL || 'https://crm.kaztbu.edu.kz';
const apiKey = __ENV.K6_API_KEY || '';

export default function () {
  const commonHeaders = {
    Accept: 'application/json',
  };

  const healthResponse = http.get(`${baseUrl}/api/v1/health`, {
    headers: commonHeaders,
    tags: { endpoint: 'health' },
  });

  check(healthResponse, {
    'health is 200': (response) => response.status === 200,
  }, { endpoint: 'health' });

  const headers = apiKey === ''
    ? commonHeaders
    : { ...commonHeaders, 'X-API-KEY': apiKey };

  const listResponse = http.get(`${baseUrl}/api/v1/tests?per_page=10`, {
    headers,
    tags: { endpoint: 'list-tests' },
  });

  check(listResponse, {
    'list is 200': (response) => response.status === 200,
    'list has data array': (response) => {
      try {
        const payload = JSON.parse(response.body);
        return Array.isArray(payload.data);
      } catch {
        return false;
      }
    },
  }, { endpoint: 'list-tests' });

  sleep(1);
}
