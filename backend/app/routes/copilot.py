from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.copilot_service import ask_copilot

router = APIRouter(prefix="/api/copilot", tags=["Copilot"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role: user, assistant, or system")
    content: str = Field(..., description="Message content")


class CopilotChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_items=1)
    context: dict[str, Any] | None = Field(default=None, description="Current client-side UI context")


class CopilotChatResponse(BaseModel):
    reply: str
    suggestions: list[str]
    model: str


@router.get("/status")
def get_copilot_status() -> dict[str, Any]:
    return {
        "status": "online",
        "name": "GreenMind Copilot",
        "model": "gpt-4o-mini",
        "role": "Debrecen Urban & Environmental AI Advisor",
    }


@router.post("/chat", response_model=CopilotChatResponse)
def chat_with_copilot(request: CopilotChatRequest) -> CopilotChatResponse:
    try:
        raw_messages = [{"role": m.role, "content": m.content} for m in request.messages]
        result = ask_copilot(raw_messages, client_context=request.context)
        return CopilotChatResponse(
            reply=result["reply"],
            suggestions=result.get("suggestions", []),
            model=result.get("model", "gpt-4o-mini"),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Copilot error: {str(exc)}",
        ) from exc