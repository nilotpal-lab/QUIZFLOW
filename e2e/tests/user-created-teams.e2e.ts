import { test, expect } from '@playwright/test';

/* ================================================================
   Fast Concurrent Login Test for User's 25 Created Teams
   ================================================================ */

const USER_TEAMS = [
  { username: 'LOL', password: 'Sanchit' },
  { username: 'LUL', password: 'hi' },
  { username: 'FREEBUFF', password: 'FREEBUFF' },
  { username: 'CODEBUFF', password: 'CODEBUFF' },
  { username: 'NOM', password: 'Narayan' },
  { username: 'Sanchi', password: 'Damn' },
  { username: 'HI', password: 'HI' },
  { username: 'BYE', password: 'BYE' },
  { username: 'SNEHA', password: 'PREMA' },
  { username: 'KRISHNA', password: 'BHAGWAN' },
  { username: 'ARNAV', password: 'MEDHI' },
  { username: 'AKSHAT', password: 'GUPTA' },
  { username: 'SINGHNIA', password: 'SS' },
  { username: 'CHINMAY', password: 'BELENGE' },
  { username: 'NIHAL', password: 'SARVDEEP' },
  { username: 'PHONE', password: 'CALL' },
  { username: 'SD', password: 'SDS' },
  { username: 'SA', password: 'SWQWAS' },
  { username: 'SDFAW', password: 'WDADWD' },
  { username: 'DACX', password: 'WDC' },
  { username: 'DCX', password: 'WDSZC' },
  { username: 'WDSCDX', password: 'WDSA' },
  { username: 'WASZ', password: 'QWSD' },
  { username: 'WS', password: 'ASXZ' },
  { username: 'SZX', password: 'ASCX' }
];

test('Fast concurrent login for all 25 user-created teams', async ({ playwright }) => {
  console.log('\n🚀 Starting fast concurrent login for all 25 created teams...\n');

  // Log in all 25 teams in parallel via isolated request contexts
  const results = await Promise.all(
    USER_TEAMS.map(async ({ username, password }, idx) => {
      const requestContext = await playwright.request.newContext({
        baseURL: 'http://localhost:3001'
      });
      
      const deviceId = `bot_device_team_${idx + 1}`;
      const res = await requestContext.post('/api/student/login', {
        data: { username, password, device_id: deviceId }
      });

      const body = await res.json().catch(() => ({}));
      
      if (res.status() === 200 && body.success) {
        // Also fetch live game state to register quiz_session presence
        await requestContext.get('/api/quiz/game/state').catch(() => {});
        console.log(`  ✓ Team #${idx + 1} [ ${username} ] connected & live in Arena!`);
        return { username, success: true };
      } else {
        console.warn(`  ❌ Team #${idx + 1} [ ${username} ] status ${res.status()}: ${body.error || 'Login failed'}`);
        return { username, success: false, error: body.error };
      }
    })
  );

  const successCount = results.filter(r => r.success).length;
  console.log(`\n🟢 ${successCount} / 25 Teams Logged In & Connected to Arena!\n`);
  expect(successCount).toBe(25);
});
