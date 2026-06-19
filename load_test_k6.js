import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp up to 50 concurrent virtual users
    { duration: '1m', target: 50 },  // Stay at 50 virtual users
    { duration: '15s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'], // 95% of requests must complete below 800ms
    http_req_failed: ['rate<0.01'],   // Error rate must be less than 1%
  },
};

const BASE_URL = 'http://localhost:5001/api';

// Admin Auth Token (use environment variable or substitute a token)
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'x-auth-token': AUTH_TOKEN
  };

  // 1. Simulate admin browsing candidates (random filters, search, pagination)
  const page = Math.floor(Math.random() * 10) + 1;
  const cities = ['Lahore (nearest areas)', 'Faisalabad', 'Multan', 'Islamabad', 'Sialkot', 'Gujranwala'];
  const randomCity = cities[Math.floor(Math.random() * cities.length)];

  const res = http.get(`${BASE_URL}/candidates?page=${page}&limit=50&city=${randomCity}`, { headers });
  check(res, {
    'candidates page fetch status 200': (r) => r.status === 200,
    'candidates page response has body': (r) => r.body.length > 0,
  });

  sleep(1);

  // 2. Simulate dashboard stats load
  const statsRes = http.get(`${BASE_URL}/dashboard/stats`, { headers });
  check(statsRes, {
    'dashboard stats status 200': (r) => r.status === 200,
  });

  sleep(1);

  // 3. Simulate admin triggering an Excel stream export (10% probability)
  if (Math.random() < 0.1) {
    const exportRes = http.post(
      `${BASE_URL}/candidates/export`,
      JSON.stringify({ city: randomCity }),
      { headers }
    );
    
    const isSuccess = check(exportRes, {
      'export trigger status 202': (r) => r.status === 202,
    });

    if (isSuccess && exportRes.json()) {
      const jobId = exportRes.json().data._id;
      // Simulate polling the job progress
      for (let i = 0; i < 3; i++) {
        sleep(2);
        const pollRes = http.get(`${BASE_URL}/candidates/export/jobs`, { headers });
        check(pollRes, {
          'poll export jobs status 200': (r) => r.status === 200,
        });
      }
    }
  }

  sleep(2);
}
