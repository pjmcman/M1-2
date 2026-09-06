import json
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

load_dotenv()
ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"
COLLECTION_DATA = "data"
COLLECTION_CONVERSATIONS = "conversations"

app = FastAPI(title="홍성군 숙박 데이터 AI 관리자", version="1.0.0")
origins = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:8000,http://localhost:8000").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

_db = None
_local_data: dict[str, dict[str, Any]] = {}
_local_conversations: dict[str, dict[str, Any]] = {}


def firestore():
    global _db
    if _db is not None:
        return _db
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            service_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
            service_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if service_json:
                cred = credentials.Certificate(json.loads(service_json))
            elif service_path and Path(service_path).exists():
                cred = credentials.Certificate(service_path)
            else:
                return None
            firebase_admin.initialize_app(cred)
        _db = firestore.client()
        return _db
    except Exception:
        return None


def data_store():
    return firestore().collection(COLLECTION_DATA) if firestore() else None


def conversation_store():
    return firestore().collection(COLLECTION_CONVERSATIONS) if firestore() else None


def records() -> list[dict[str, Any]]:
    store = data_store()
    if store:
        stored = [{"id": doc.id, **doc.to_dict()} for doc in store.order_by("date").stream()]
        if stored:
            return stored
        room_store = firestore().collection("room_daily")
        room_items = []
        for doc in room_store.order_by("date").stream():
            item = doc.to_dict()
            room_items.append({"id": doc.id, "date": item.get("date"), "value": item.get("revenue", 0), "memo": f"{item.get('roomName', '')} · {item.get('status', '')}", "roomId": item.get("roomId"), "roomName": item.get("roomName"), "nightlyRate": item.get("nightlyRate", 0), "isSynthetic": True})
        if room_items:
            return room_items
    if not _local_data:
        source = ROOT / "data" / "hongseong-room-120-days.json"
        if source.exists():
            for item in json.loads(source.read_text(encoding="utf-8")):
                _local_data[item["id"]] = {
                    "date": item["date"], "value": item["revenue"],
                    "memo": f"{item['roomName']} · {item['status']}",
                    "roomId": item["roomId"], "roomName": item["roomName"],
                    "visitors": 1 if item["isOccupied"] else 0,
                    "nightlyRate": item["nightlyRate"], "isSynthetic": True,
                }
    return [{"id": key, **value} for key, value in sorted(_local_data.items(), key=lambda pair: pair[1]["date"])]


class DataInput(BaseModel):
    date: date
    value: float = Field(ge=0)
    memo: str = Field(default="", max_length=500)


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None


class ConversationInput(BaseModel):
    title: str = Field(default="새 대화", max_length=200)
    messages: list[dict[str, Any]]


def save_document(collection: str, document_id: str, data: dict[str, Any]):
    store = data_store() if collection == COLLECTION_DATA else conversation_store()
    if store:
        store.document(document_id).set(data, merge=True)
    else:
        (_local_data if collection == COLLECTION_DATA else _local_conversations)[document_id] = data


def delete_document(collection: str, document_id: str):
    store = data_store() if collection == COLLECTION_DATA else conversation_store()
    if store:
        store.document(document_id).delete()
    else:
        (_local_data if collection == COLLECTION_DATA else _local_conversations).pop(document_id, None)


@app.get("/api/data")
def list_data():
    return records()


@app.post("/api/data", status_code=201)
def create_data(payload: DataInput):
    document_id = f"{payload.date.isoformat()}-{datetime.now(timezone.utc).timestamp()}"
    data = {"date": payload.date.isoformat(), "value": payload.value, "memo": payload.memo, "created_at": datetime.now(timezone.utc).isoformat()}
    save_document(COLLECTION_DATA, document_id, data)
    return {"id": document_id, **data}


@app.put("/api/data/{document_id}")
def update_data(document_id: str, payload: DataInput):
    if not any(item["id"] == document_id for item in records()):
        raise HTTPException(404, "데이터를 찾을 수 없습니다.")
    data = {"date": payload.date.isoformat(), "value": payload.value, "memo": payload.memo, "updated_at": datetime.now(timezone.utc).isoformat()}
    save_document(COLLECTION_DATA, document_id, data)
    return {"id": document_id, **data}


@app.delete("/api/data/{document_id}")
def remove_data(document_id: str):
    if not any(item["id"] == document_id for item in records()):
        raise HTTPException(404, "데이터를 찾을 수 없습니다.")
    delete_document(COLLECTION_DATA, document_id)
    return {"deleted": document_id}


@app.get("/api/data/summary")
def summary():
    items = records()
    if not items:
        return {"period": None, "count": 0, "metrics": {"total": 0, "average": 0, "max": 0, "min": 0}, "trend": "데이터 없음"}
    values = [float(item.get("value", 0)) for item in items]
    ordered = sorted(items, key=lambda item: item["date"])
    midpoint = max(1, len(values) // 2)
    first_avg = sum(float(item.get("value", 0)) for item in ordered[:midpoint]) / midpoint
    last_avg = sum(float(item.get("value", 0)) for item in ordered[-midpoint:]) / midpoint
    change = ((last_avg - first_avg) / first_avg * 100) if first_avg else 0
    trend = "상승" if change > 1 else "하락" if change < -1 else "유지"
    return {"period": f"{ordered[0]['date']} ~ {ordered[-1]['date']}", "count": len(items), "metrics": {"total": sum(values), "average": sum(values) / len(values), "max": max(values), "min": min(values)}, "trend": f"{trend} ({change:+.1f}%)"}


@app.post("/api/conversations", status_code=201)
def save_conversation(payload: ConversationInput):
    conversation_id = f"conversation-{datetime.now(timezone.utc).timestamp()}"
    data = {"title": payload.title, "messages": payload.messages, "updated_at": datetime.now(timezone.utc).isoformat()}
    save_document(COLLECTION_CONVERSATIONS, conversation_id, data)
    return {"id": conversation_id, **data}


@app.get("/api/conversations")
def list_conversations():
    store = conversation_store()
    if store:
        return [{"id": doc.id, "title": doc.to_dict().get("title", "새 대화"), "updated_at": doc.to_dict().get("updated_at")} for doc in store.order_by("updated_at", direction="DESCENDING").stream()]
    return [{"id": key, "title": value.get("title", "새 대화"), "updated_at": value.get("updated_at")} for key, value in _local_conversations.items()]


@app.get("/api/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    store = conversation_store()
    data = store.document(conversation_id).get().to_dict() if store else _local_conversations.get(conversation_id)
    if not data:
        raise HTTPException(404, "대화를 찾을 수 없습니다.")
    return {"id": conversation_id, **data}


@app.delete("/api/conversations/{conversation_id}")
def remove_conversation(conversation_id: str):
    delete_document(COLLECTION_CONVERSATIONS, conversation_id)
    return {"deleted": conversation_id}


@app.post("/api/chat")
async def chat(payload: ChatInput):
    context = summary()
    system = f"당신은 홍성군 숙박 데이터 분석 비서입니다. 아래 요약만 근거로 답변하고 가상 데이터임을 필요하면 밝혀주세요. 요약: {json.dumps(context, ensure_ascii=False)}"
    answer = None
    if os.getenv("OPENAI_API_KEY"):
        client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        result = await client.chat.completions.create(model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"), messages=[{"role": "system", "content": system}, {"role": "user", "content": payload.message}], max_tokens=500)
        answer = result.choices[0].message.content
    else:
        answer = f"현재 {context['period']} 동안 {context['count']}건의 데이터가 있습니다. 총액은 {context['metrics']['total']:,.0f}원이며 추세는 {context['trend']}입니다. 실제 GPT 답변을 사용하려면 OPENAI_API_KEY를 설정해 주세요."
    messages = [{"role": "user", "content": payload.message}, {"role": "assistant", "content": answer}]
    conversation_id = payload.conversation_id
    if conversation_id:
        existing = get_conversation(conversation_id)
        messages = existing.get("messages", []) + messages
        save_document(COLLECTION_CONVERSATIONS, conversation_id, {"title": existing.get("title", payload.message[:30]), "messages": messages, "updated_at": datetime.now(timezone.utc).isoformat()})
    else:
        saved = save_conversation(ConversationInput(title=payload.message[:30], messages=messages))
        conversation_id = saved["id"]
    return {"answer": answer, "conversation_id": conversation_id, "summary": context}


@app.get("/health")
def health():
    return {"status": "ok", "firebase": firestore() is not None, "openai": bool(os.getenv("OPENAI_API_KEY"))}


if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")
