const http = require('node:http');
const { getDb } = require('./firebase');

const port = Number(process.env.PORT || 5173);
const collectionName = 'room_daily';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function validateRecord(input) {
  const date = String(input.date || '');
  const roomId = String(input.roomId || '');
  const roomName = String(input.roomName || '');
  const nightlyRate = Number(input.nightlyRate);
  const status = input.status === 'reserved' ? 'reserved' : 'available';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !roomId || !roomName || !Number.isFinite(nightlyRate) || nightlyRate < 0) {
    throw new Error('날짜, 객실 ID, 객실명, 1박 요금을 올바르게 입력해 주세요.');
  }

  return {
    date,
    roomId,
    roomName,
    nightlyRate,
    status,
    isOccupied: status === 'reserved',
    revenue: status === 'reserved' ? nightlyRate : 0,
    dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay(),
    isSynthetic: true,
    source: '관리자 입력'
  };
}

async function getRecords() {
  const snapshot = await getDb().collection(collectionName).orderBy('date').get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

async function handleApi(request, response, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;
  const collection = getDb().collection(collectionName);

  if (request.method === 'GET' && parts.length === 2) {
    return json(response, 200, { records: await getRecords() });
  }

  if (request.method === 'POST' && parts.length === 2) {
    const data = validateRecord(await readBody(request));
    const documentId = `${data.date}-${data.roomId}`;
    await collection.doc(documentId).set(data, { merge: true });
    return json(response, 201, { id: documentId, ...data });
  }

  if (request.method === 'PUT' && id) {
    const data = validateRecord(await readBody(request));
    await collection.doc(id).set(data, { merge: true });
    return json(response, 200, { id, ...data });
  }

  if (request.method === 'DELETE' && id) {
    await collection.doc(id).delete();
    return json(response, 200, { deleted: id });
  }

  return json(response, 404, { error: 'API 경로를 찾을 수 없습니다.' });
}

function renderPage() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>홍성군 숙박 관리자</title>
  <style>
    :root{--ink:#18231f;--muted:#66736d;--line:#dce5df;--accent:#16745c;--soft:#e3f2eb;--paper:#f5f7f3;--danger:#b23a3a}*{box-sizing:border-box}body{margin:0;font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:var(--ink);background:var(--paper)}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:40px 0 64px}header{display:flex;justify-content:space-between;align-items:end;margin-bottom:24px}h1{margin:0 0 8px;font-size:clamp(28px,5vw,44px);letter-spacing:-1px}p{color:var(--muted);margin:0}.badge{background:var(--soft);color:var(--accent);padding:8px 12px;border-radius:999px;font-weight:700}.panel{background:white;border:1px solid var(--line);border-radius:8px;padding:22px;margin-bottom:18px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric span{display:block;color:var(--muted);font-size:13px;margin-bottom:8px}.metric strong{font-size:22px}.form-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr auto;gap:10px;align-items:end}label{display:grid;gap:6px;font-size:13px;color:var(--muted);font-weight:700}input,select,button{font:inherit;border:1px solid var(--line);border-radius:5px;padding:10px;background:white;color:var(--ink)}button{cursor:pointer;background:var(--accent);border-color:var(--accent);color:white;font-weight:700}button.secondary{background:white;color:var(--accent)}button.danger{background:white;color:var(--danger);border-color:#efcaca}.searchbar{display:flex;gap:10px;margin-bottom:14px}.searchbar input{flex:1}.searchbar select{width:150px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--line)}th{font-size:13px;color:var(--muted)}td.actions{display:flex;gap:6px}.message{min-height:22px;color:var(--accent);font-size:14px;margin-top:10px}.empty{text-align:center;color:var(--muted);padding:24px}@media(max-width:800px){header{display:block}.badge{display:inline-block;margin-top:14px}.metrics{grid-template-columns:repeat(2,1fr)}.form-grid{grid-template-columns:1fr 1fr}.form-grid button{grid-column:span 2}.searchbar{display:grid}.searchbar select{width:auto}.panel.table{overflow-x:auto}table{min-width:760px}}
  </style>
</head>
<body><main>
<header><div><h1>홍성군 숙박 관리자</h1><p>Firebase Firestore · 객실 예약 CRUD</p></div><div class="badge">가상 분석 데이터</div></header>
<section class="panel"><div class="metrics"><div class="metric"><span>전체 기록</span><strong id="total">-</strong></div><div class="metric"><span>객실 수</span><strong id="rooms">-</strong></div><div class="metric"><span>예약률</span><strong id="occupancy">-</strong></div><div class="metric"><span>예상 매출</span><strong id="revenue">-</strong></div></div></section>
<section class="panel"><h2 id="formTitle">예약 기록 추가</h2><form id="recordForm"><div class="form-grid"><label>날짜<input id="date" type="date" required></label><label>객실 ID<input id="roomId" placeholder="room-1" required></label><label>객실명<input id="roomName" placeholder="1호 객실" required></label><label>1박 요금<input id="nightlyRate" type="number" min="0" value="220000" required></label><label>상태<select id="status"><option value="reserved">예약</option><option value="available">비어 있음</option></select></label><button id="submitButton">추가</button></div></form><div id="message" class="message"></div></section>
<section class="panel table"><h2>객실 예약 기록</h2><div class="searchbar"><select id="searchField"><option value="all">전체 항목</option><option value="date">날짜</option><option value="roomId">객실 ID</option><option value="roomName">객실명</option><option value="nightlyRate">요금</option><option value="status">상태</option></select><input id="search" type="search" placeholder="검색어를 입력하세요"><button type="button" class="secondary" id="exampleSearch">예시 입력</button><button type="button" class="secondary" id="clearSearch">초기화</button></div><table><thead><tr><th>날짜</th><th>객실</th><th>상태</th><th>1박 요금</th><th>매출</th><th>관리</th></tr></thead><tbody id="records"></tbody></table></section>
</main><script>
let records=[];let editingId=null;let searchTerm='';let searchField='all';const $=id=>document.getElementById(id);const won=value=>Number(value).toLocaleString('ko-KR')+'원';
async function load(){const response=await fetch('/api/rooms');const data=await response.json();records=data.records;render();}
function render(){const visible=records.filter(record=>{let value='';if(searchField==='date')value=record.date;else if(searchField==='roomId')value=record.roomId;else if(searchField==='roomName')value=record.roomName;else if(searchField==='nightlyRate')value=String(record.nightlyRate);else if(searchField==='status')value=record.isOccupied?'예약':'비어 있음';else value=[record.date,record.roomId,record.roomName,record.nightlyRate,record.isOccupied?'예약':'비어 있음'].join(' ');return value.toLowerCase().includes(searchTerm);});const occupied=visible.filter(record=>record.isOccupied).length;const revenue=visible.reduce((sum,record)=>sum+record.revenue,0);$('total').textContent=visible.length.toLocaleString('ko-KR');$('rooms').textContent=new Set(visible.map(record=>record.roomId)).size+'개';$('occupancy').textContent=visible.length?(occupied/visible.length*100).toFixed(1)+'%':'0%';$('revenue').textContent=won(revenue);$('records').innerHTML=visible.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(record=>'<tr><td>'+record.date+'</td><td>'+record.roomName+'</td><td>'+(record.isOccupied?'예약':'비어 있음')+'</td><td>'+won(record.nightlyRate)+'</td><td>'+won(record.revenue)+'</td><td class="actions"><button class="secondary" onclick="editRecord(&quot;'+record.id+'&quot;)">수정</button><button class="danger" onclick="deleteRecord(&quot;'+record.id+'&quot;)">삭제</button></td></tr>').join('')||'<tr><td colspan="6" class="empty">검색 결과가 없습니다.</td></tr>';}
function editRecord(id){const record=records.find(item=>item.id===id);if(!record)return;editingId=id;$('date').value=record.date;$('roomId').value=record.roomId;$('roomName').value=record.roomName;$('nightlyRate').value=record.nightlyRate;$('status').value=record.status;$('formTitle').textContent='예약 기록 수정';$('submitButton').textContent='저장';window.scrollTo({top:0,behavior:'smooth'});}
async function deleteRecord(id){if(!confirm('이 예약 기록을 삭제할까요?'))return;await fetch('/api/rooms/'+encodeURIComponent(id),{method:'DELETE'});$('message').textContent='삭제했습니다.';await load();}
$('recordForm').addEventListener('submit',async event=>{event.preventDefault();const payload={date:$('date').value,roomId:$('roomId').value,roomName:$('roomName').value,nightlyRate:Number($('nightlyRate').value),status:$('status').value};const url=editingId?'/api/rooms/'+encodeURIComponent(editingId):'/api/rooms';const method=editingId?'PUT':'POST';const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok){$('message').textContent=result.error;return;}editingId=null;$('recordForm').reset();$('nightlyRate').value=220000;$('formTitle').textContent='예약 기록 추가';$('submitButton').textContent='추가';$('message').textContent=method==='POST'?'추가했습니다.':'수정했습니다.';await load();});load().catch(error=>{$('message').textContent='데이터 조회 실패: '+error.message;});
 const searchExamples={all:'1호 객실',date:'2026-05-10',roomId:'room-1',roomName:'1호 객실',nightlyRate:'220000',status:'예약'};function updateSearchInputType(){const search=$('search');search.type=searchField==='date'?'date':'search';search.placeholder=searchField==='date'?'날짜를 선택하세요':'검색어를 입력하세요';}$('search').addEventListener('input',event=>{searchTerm=event.target.value.trim().toLowerCase();render();});$('searchField').addEventListener('change',event=>{searchField=event.target.value;updateSearchInputType();render();});$('exampleSearch').addEventListener('click',()=>{$('search').value=searchExamples[searchField];searchTerm=$('search').value.toLowerCase();render();});$('clearSearch').addEventListener('click',()=>{$('search').value='';$('searchField').value='all';searchTerm='';searchField='all';updateSearchInputType();render();});updateSearchInputType();load().catch(error=>{$('message').textContent='데이터 조회 실패: '+error.message;});
</script></body></html>`;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return response.end(renderPage());
    }
    return json(response, 404, { error: '페이지를 찾을 수 없습니다.' });
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`관리자 CRUD 대시보드: http://127.0.0.1:${port}`);
});
