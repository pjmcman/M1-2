const fs = require('node:fs/promises');
const path = require('node:path');
const { getDb } = require('./firebase');

const dataPath = path.resolve(process.cwd(), 'data', 'hongseong-room-120-days.json');
const collectionName = 'room_daily';
const batchLimit = 400;

async function main() {
  const records = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const db = getDb();

  for (let start = 0; start < records.length; start += batchLimit) {
    const batch = db.batch();
    const chunk = records.slice(start, start + batchLimit);

    for (const record of chunk) {
      const { id, ...data } = record;
      batch.set(db.collection(collectionName).doc(id), data, { merge: true });
    }

    await batch.commit();
    console.log(`입력 완료: ${Math.min(start + batchLimit, records.length)}/${records.length}`);
  }

  console.log(`Firestore 객실 데이터 입력 완료: ${collectionName} (${records.length}건)`);
}

main().catch((error) => {
  console.error('관광 데이터 입력 실패:', error.message);
  process.exitCode = 1;
});