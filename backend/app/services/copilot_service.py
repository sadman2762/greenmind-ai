import json
import os
import re
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
import openai

# Load environment variables from backend/.env or system environment
env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=env_path)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

DATA_FILE = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "green-sentinel-points.json"
)

# Friendly redirection for completely off-topic queries
FRIENDLY_OFF_TOPIC_REPLY = (
    "👋 Hello! While I'm always happy to chat, do math, and help with calculations, "
    "I am specially tailored for the **GreenMind AI platform** and **Debrecen's Urban Environmental Intelligence**.\n\n"
    "I can't answer questions about topics like UFOs, pop culture, entertainment, recipes, or unrelated trivia, "
    "but I would love to help you with:\n"
    "* 🍃 **Air Quality in Plain English**: Checking PM2.5, dust, traffic fumes, and local station readings\n"
    "* 💶 **Sensor Costs & Math**: Calculating budgets, 5-year maintenance costs, and quantity breakdowns\n"
    "* 💡 **Sensor Choices**: Explaining Reference Grade (€28k), Mid-Tier (€6.5k), and IoT Mesh (€1.2k) simply\n"
    "* 🗺️ **Interactive Planning**: Simulating new sensor placements around schools, clinics, and industrial zones\n\n"
    "What would you like to explore or calculate?"
)

PROJECT_DEFAULT_SUGGESTIONS = [
    "What is PM2.5 in simple terms?",
    "If we buy 4 Mid-Tier sensors at €6,500, what is the total cost?",
    "Which areas in Debrecen need air sensors most?",
    "How does a €50,000 budget get allocated?",
]

# Patterns for questions that are COMPLETELY out of topic
COMPLETELY_OFF_TOPIC_PATTERNS = [
    # UFOs, aliens, extraterrestrial mythology
    r"\b(ufo|ufos|uap|uaps|alien|aliens|extraterrestrial|flying saucer|martian|martians|area 51|astrology|horoscope|zodiac)\b",
    # Pop culture, celebrities, movies, entertainment, athletes, gaming
    r"\b(hollywood|actor|actress|celebrity|celebrities|movie|movies|netflix|spotify|singer|song|album|messi|ronaldo|le-?bron|kardashian|taylor swift|fortnite|minecraft|gta|playstation|xbox|nintendo)\b",
    # Food, cooking, recipes
    r"\b(recipe|recipes|cook|cooking|bake|pancake|pancakes|pizza|burger|pasta|cocktail|cake|cookie|salad dressing)\b",
    # Creative fiction / bedtime stories / jokes
    r"\b(tell me a joke|tell a bedtime story|write fanfiction|tell me a riddle)\b",
    # Unrelated foreign politics / sports tournaments
    r"\b(who is the president of|who is the prime minister of|capital of [a-z]+|who won the (world cup|super bowl|champions league|oscar|grammy))\b",
]

# Patterns for friendly greetings, welcomes, small talk, and math that MUST ALWAYS BE ALLOWED
GREETING_OR_MATH_PATTERNS = [
    r"^(hi|hello|hey|good\s*(morning|afternoon|evening|day)|howdy|greetings)\b",
    r"\b(how are you|who are you|what can you do|what is your name|nice to meet you|thank you|thanks|help me)\b",
    r"(\d+\s*[\+\-\*\/\^%×÷]\s*\d+)",  # Math equations like 25 * 4, 100 + 50
    r"\b(calculate|math|plus|minus|multiplied|divided|times|percentage|sum of|square root|how much is)\b",
]

def is_greeting_or_math(query: str) -> bool:
    """Check if query is a greeting, basic talk, or mathematical question."""
    clean = query.strip().lower()
    for pattern in GREETING_OR_MATH_PATTERNS:
        if re.search(pattern, clean, re.IGNORECASE):
            return True
    return False

def is_completely_off_topic(query: str) -> bool:
    """Check if query is completely off-topic (and not an allowed greeting/math/project query)."""
    clean = query.strip()
    if not clean:
        return False
    # If it's a greeting, polite talk, or math, let it through
    if is_greeting_or_math(clean):
        return False
    # Check if matches off-topic blacklist
    for pattern in COMPLETELY_OFF_TOPIC_PATTERNS:
        if re.search(pattern, clean, re.IGNORECASE):
            return True
    return False

def get_station_summary() -> str:
    """Read a summary of current stations and live ML predictions for prompt context."""
    summary_parts = []
    if DATA_FILE.exists():
        try:
            with DATA_FILE.open("r", encoding="utf-8") as f:
                stations = json.load(f)
            count = len(stations)
            names = [
                s.get("title", {}).get("en") or s.get("name") or f"Station #{s.get('id')}"
                for s in stations[:6]
            ]
            summary_parts.append(
                f"Debrecen Green Sentinel Network: {count} active monitoring stations ({', '.join(names)})."
            )
        except Exception:
            summary_parts.append("Debrecen Green Sentinel Network: 16 active monitoring stations.")

    # Include live Machine Learning spatial predictions
    try:
        from app.routes.recommendations import get_ai_city_analytics
        analytics = get_ai_city_analytics()
        health = analytics.get("cityHealth", {})
        h_score = health.get("healthScore", 89)
        v_label = health.get("vitalityLabel", "Optimal & Fresh")
        summary_parts.append(
            f"LIVE AI MACHINE LEARNING ANALYSIS: Debrecen City Health Score is {h_score}/100 ({v_label})."
        )
        districts = analytics.get("districtProfiles", [])
        if districts:
            dist_lines = [
                f"- {d['district']}: predicted PM2.5 = {d['pm25']} µg/m³, Day Noise = {d['dayNoise']} dB (Kriging uncertainty: {d['krigingUncertainty']}%)"
                for d in districts[:5]
            ]
            summary_parts.append("Key District AI Predictions:\n" + "\n".join(dist_lines))
    except Exception:
        pass

    return "\n\n".join(summary_parts)

SYSTEM_BASE_PROMPT = """You are GreenMind Copilot, the friendly, helpful AI advisor for the GreenMind AI platform and Debrecen Urban Environmental Intelligence.

================================================================================
YOUR ROLE & AUDIENCE (DESIGNED FOR NON-TECHNICAL USERS):
================================================================================
You assist city planners, municipal officials, community leaders, and citizens.
Many users are NOT technical engineers or data scientists!
- Be warm, welcoming, polite, and encouraging.
- Explain concepts in clear, simple, everyday language without excessive jargon.
- When explaining air quality (PM2.5, NO2, AQI), explain what it means in human terms (e.g., "PM2.5 refers to microscopic dust and soot particles from traffic and heating that can reach our lungs").
- When explaining budget terms, clarify simply:
  * CapEx = Initial upfront equipment cost.
  * O&M = Yearly upkeep, calibration, and power.
  * 5-Year TCO = Total 5-year cost (Upfront cost + 5 years of upkeep).

================================================================================
WHAT YOU HAPPILY DO:
================================================================================
1. GREETINGS & BASIC TALK:
   Always welcome the user warmly! Respond naturally to "Hello", "How are you?", "Who are you?", "Thank you", etc., and offer easy starting points.

2. BASIC MATH & CALCULATIONS:
   Always perform arithmetic, budget math, percentages, multiplications, and cost breakdowns accurately and clearly!
   Example: If asked "What is 4 * 6500?" or "How much is 15% of €50,000?", compute the answer directly and explain the steps simply.

3. GREENMIND AI & DEBRECEN URBAN ENVIRONMENT:
   - Live air quality insights across Debrecen districts (Kassai road, Nagyállomás, Southern Industrial Zone, Great Forest).
   - Sensor Hardware Tiers:
     * Tier 1: Reference Grade (€28,000 upfront | €3,200/yr upkeep | 3.5 km coverage radius). Official legal standard.
     * Tier 2: Mid-Tier Micro (€6,500 upfront | €850/yr upkeep | 1.8 km coverage radius). Great balance of accuracy and price.
     * Tier 3: Low-Cost IoT Mesh (€1,200 upfront | €180/yr upkeep | 0.8 km coverage radius). Hyper-local neighborhood mesh.
   - Budget planning: Simulating how to allocate municipal funds to protect schools, clinics, and residents.

================================================================================
WHAT YOU GENTLY CONSTRAIN (COMPLETELY OUT-OF-TOPIC THINGS):
================================================================================
- Do NOT answer questions about completely unrelated topics:
  * UFOs, aliens, outer space mythology
  * Celebrity gossip, Hollywood movies, pop music stars, athletes, gaming (Fortnite, Minecraft, etc.)
  * Cooking recipes, baking instructions
  * Foreign country politics, unrelated general world trivia
- When asked a completely off-topic question, decline gently and warmly in a friendly tone:
  "Hello! While I'm glad to chat and calculate numbers, I'm specialized in helping you with **GreenMind AI** and **Debrecen's air quality planning**. I cannot assist with [topic], but I would be thrilled to help you explore Debrecen's sensor map, compare hardware, or calculate a sensor budget!"

================================================================================
FEW-SHOT CONVERSATION EXAMPLES:
================================================================================
User: "Hi! How are you doing today?"
Assistant: "Hello! 😊 I'm doing great, thank you! I'm here to help you explore Debrecen's environmental sensor network, understand air quality, or run budget calculations for new sensors. How can I help you today?"

User: "What is 3 * 28000 + 4 * 6500?"
Assistant: "Let's calculate that step by step:
* 3 × €28,000 (Reference stations) = **€84,000**
* 4 × €6,500 (Mid-tier micro stations) = **€26,000**
* Total = €84,000 + €26,000 = **€110,000**

In terms of GreenMind planning, €110,000 would deploy 3 high-precision Reference anchors and 4 Mid-Tier stations to cover key Debrecen corridors!"

User: "What is UFO?"
Assistant: "👋 Hello! While I'm always happy to chat and do calculations, I am specialized in **GreenMind AI** and **Debrecen's urban environmental sensor network**. I can't answer questions about UFOs or space trivia, but I'd love to help you check Debrecen's air quality, compare sensor costs, or calculate budget simulations!"
"""

def get_client() -> openai.OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", OPENAI_API_KEY)
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured in backend/.env")
    return openai.OpenAI(api_key=api_key)

def ask_copilot(
    messages: list[dict[str, str]],
    client_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute a chat completion tailored for non-technical users with warm guidance."""
    # Find the latest user message
    latest_user_msg = ""
    for msg in reversed(messages):
        if msg.get("role") == "user" and msg.get("content"):
            latest_user_msg = msg["content"].strip()
            break

    # Layer 1: Fast filter for completely out-of-topic topics (excluding greetings & math)
    if latest_user_msg and is_completely_off_topic(latest_user_msg):
        return {
            "reply": FRIENDLY_OFF_TOPIC_REPLY,
            "suggestions": PROJECT_DEFAULT_SUGGESTIONS,
            "model": "friendly-guardrail",
            "guardrail_triggered": True,
        }

    client = get_client()

    station_summary = get_station_summary()
    system_prompt = SYSTEM_BASE_PROMPT + f"\n\nLIVE DEBRECEN DATA CONTEXT:\n{station_summary}\n"

    if client_context:
        system_prompt += f"\nACTIVE USER APP CONTEXT:\n{json.dumps(client_context, indent=2)}\n"

    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ["user", "assistant", "system"] and content:
            api_messages.append({"role": role, "content": content})

    try:
        # Temperature 0.3 allows natural, friendly, non-robotic phrasing while staying grounded
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=api_messages,
            temperature=0.3,
            max_tokens=1500,
        )
        reply_content = (response.choices[0].message.content or "").strip()

        suggestions = [
            "How should we allocate €50k budget for school protection?",
            "Explain Reference vs IoT Mesh in plain words",
            "Calculate 5-year cost for 2 Reference and 5 IoT sensors",
            "What are current air quality risks in Debrecen?",
        ]

        return {
            "reply": reply_content,
            "suggestions": suggestions,
            "model": "gpt-4o-mini",
        }
    except Exception as e:
        raise RuntimeError(f"OpenAI error: {str(e)}") from e
