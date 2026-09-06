const fs = require('node:fs/promises');
const path = require('node:path');
const { getDb } = require('./firebase');

const reportPath = path.resolve(process.cwd(), 'reports', 'hongseong-room-report.md');

async function main() {
  const snapshot = await getDb().collection('room_daily').orderBy('date').get();
  const byRoom = new Map();
  let occupiedNights = 0;
  let totalRevenue = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    const current = byRoom.get(data.roomName) || { days: 0, occupiedNights: 0, revenue: 0 };
    current.days += 1;
    current.occupiedNights += data.isOccupied ? 1 : 0;
    current.revenue += data.revenue;
    byRoom.set(data.roomName, current);
    occupiedNights += data.isOccupied ? 1 : 0;
    totalRevenue += data.revenue;
  }

  const totalRoomNights = snapshot.size;
  const actualOccupancy = occupiedNights / totalRoomNights;
  const dates = snapshot.docs.map((document) => document.data().date);
  const rows = [...byRoom.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([name, item]) => `| ${name} | ${item.days} | ${item.occupiedNights} | ${item.revenue.toLocaleString('ko-KR')}원 |`)
    .join('\n');

  const report = [
    '# 홍성군 숙박 객실 120일 분석 레포트',
    '',
    '> 주의: 본 레포트는 분석용으로 생성한 가상 데이터이며 실제 예약 통계가 아닙니다.',
    '',
    `- 분석 기간: ${dates[0]} ~ ${dates[dates.length - 1]}`,
    `- 일수: ${new Set(dates).size}일`,
    `- 객실 수: ${byRoom.size}개`,
    '- 1박 요금: 220,000원',
    `- 전체 객실박: ${totalRoomNights}박`,
    `- 예약 객실박: ${occupiedNights}박`,
    `- 실제 예약률: ${(actualOccupancy * 100).toFixed(1)}%`,
    `- 예상 매출: ${totalRevenue.toLocaleString('ko-KR')}원`,
    '',
    '## 객실별 집계',
    '',
    '| 객실 | 기록 일수 | 예약 객실박 | 예상 매출 |',
    '| --- | ---: | ---: | ---: |',
    rows,
    '',
    '## 데이터 구조',
    '',
    '- Firestore 컬렉션: `room_daily`',
    '- 문서 단위: 날짜별 객실별 예약 상태 기록',
    '- 주요 필드: `date`, `roomName`, `nightlyRate`, `status`, `isOccupied`, `revenue`, `isSynthetic`',
    ''
  ].join('\n');

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf8');
  console.log(`객실 분석 레포트 생성 완료: ${reportPath}`);
  console.log(`조회 문서: ${snapshot.size}건, 예약 객실박: ${occupiedNights}박, 매출: ${totalRevenue.toLocaleString('ko-KR')}원`);
}

main().catch((error) => {
  console.error('객실 레포트 생성 실패:', error.message);
  process.exitCode = 1;
});
