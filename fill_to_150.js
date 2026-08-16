const https = require('https');

/* ================================================================
   QuizFlow — Fast API Lobby Filler (Brings Lobby to 150 Players)
   Sends light API join requests for Student_113 through Student_150
   ================================================================ */

const TARGET_HOST = 'quizflow-peach.vercel.app';
const ROOM_PIN    = process.env.PIN || '348283';
const START_NUM   = parseInt(process.env.START_NUM || '113', 10);
const END_NUM     = parseInt(process.env.END_NUM || '150', 10);

function joinStudent(studentIdx) {
  return new Promise((resolve) => {
    const studentName = `Student_${studentIdx}`;
    const playerId = `player_api_${studentIdx}_${Date.now()}`;

    const payload = JSON.stringify({
      action: 'join',
      player: {
        id: playerId,
        nickname: studentName,
        avatarSeed: 'Totoro',
        avatarStyle: 'custom',
        joinedAt: Date.now(),
        connected: true,
        score: 0
      }
    });

    const options = {
      hostname: TARGET_HOST,
      path: `/api/room/${ROOM_PIN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      console.log(`✅ Student ${studentIdx} (${studentName}) joined! Status: ${res.statusCode}`);
      resolve();
    });

    req.on('error', (e) => {
      console.error(`❌ Student ${studentIdx} error:`, e.message);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`\n🚀 Filling Room PIN ${ROOM_PIN} from Student_${START_NUM} to Student_${END_NUM}...\n`);
  for (let i = START_NUM; i <= END_NUM; i++) {
    await joinStudent(i);
    await new Promise(r => setTimeout(r, 150)); // 150ms gap
  }
  console.log(`\n🎯 Done! Check your Host Screen — total should now be 150 PLAYERS JOINED!`);
}

main();
