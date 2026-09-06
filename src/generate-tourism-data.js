const fs = require('node:fs/promises');
const path = require('node:path');

const startDate = new Date('2026-05-10T00:00:00Z');
const dayCount = 120;
const roomCount = 4;
const nightlyRate = 220000;
const occupancyRate = 0.7;

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function createRecords() {
  const records = [];

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + dayIndex);
    const dayOfWeek = date.getUTCDay();

    for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
      const isOccupied = ((dayIndex * roomCount + roomIndex) % 10) < occupancyRate * 10;

      records.push({
        id: `${formatDate(date)}-room-${roomIndex + 1}`,
        date: formatDate(date),
        roomId: `room-${roomIndex + 1}`,
        roomName: `${roomIndex + 1}호 객실`,
        nightlyRate,
        status: isOccupied ? 'reserved' : 'available',
        isOccupied,
        revenue: isOccupied ? nightlyRate : 0,
        dayOfWeek,
        isSynthetic: true,
        source: '분석용 가상 숙박 데이터'
      });
    }
  }

  return records;
}

async function main() {
  const outputPath = path.resolve(process.cwd(), 'data', 'hongseong-room-120-days.json');
  const records = createRecords();
  await fs.writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  console.log(`가상 객실 데이터 생성 완료: ${records.length}건`);
  console.log(`기간: ${records[0].date} ~ ${records[records.length - 1].date}`);
  console.log(`객실: ${roomCount}개, 1박 요금: ${nightlyRate.toLocaleString('ko-KR')}원, 예약률: ${occupancyRate * 100}%`);
}

main().catch((error) => {
  console.error('가상 데이터 생성 실패:', error.message);
  process.exitCode = 1;
});