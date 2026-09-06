const { getDb } = require('./firebase');

async function main() {
  const db = getDb();
  const collections = await db.listCollections();

  console.log('Firebase 연결 성공');
  console.log(`프로젝트: ${process.env.FIREBASE_PROJECT_ID || '서비스 계정 기본 프로젝트'}`);
  console.log(`컬렉션 수: ${collections.length}`);
  console.log('객실 데이터 입력은 npm run rooms:seed 명령으로 실행합니다.');
}

main().catch((error) => {
  console.error('Firebase 실행 실패:', error.message);
  process.exitCode = 1;
});
