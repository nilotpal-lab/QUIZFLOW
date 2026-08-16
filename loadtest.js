import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp-up 20 virtual students
    { duration: '1m', target: 150 },   // Mass Join Storm: 150 concurrent students
    { duration: '2m', target: 150 },   // Sustained 150 student live quiz
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Error rate must be under 1%
    http_req_duration: ['p(95)<800'],  // 95% of requests must complete under 800ms
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://task-flow-web.vercel.app';
const ROOM_PIN = __ENV.PIN || 'TEST01';

export default function () {
  const playerId = `player_k6_${__VU}_${Math.floor(Math.random() * 10000)}`;
  const nickname = `Student_${__VU}`;

  // 1. Join Room
  const joinPayload = JSON.stringify({
    action: 'join',
    player: {
      id: playerId,
      nickname: nickname,
      avatarSeed: 'Totoro',
      avatarStyle: 'custom',
    },
  });

  const joinRes = http.post(`${BASE_URL}/api/room/${ROOM_PIN}`, joinPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(joinRes, {
    'join status is 200': (r) => r.status === 200,
  });

  sleep(1.5);

  // 2. Poll Room State
  const stateRes = http.get(`${BASE_URL}/api/room/${ROOM_PIN}`);
  check(stateRes, {
    'state status is 200': (r) => r.status === 200,
    'has room state': (r) => r.json().state !== undefined,
  });

  sleep(1);

  // 3. Submit Answer
  const answerPayload = JSON.stringify({
    action: 'submit_answer',
    playerId: playerId,
    selectedIndex: Math.floor(Math.random() * 4),
    timeRemainingMs: 12000,
  });

  const answerRes = http.post(`${BASE_URL}/api/room/${ROOM_PIN}`, answerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(answerRes, {
    'answer status is 200': (r) => r.status === 200,
  });

  sleep(2);
}
