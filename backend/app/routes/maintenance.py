import datetime
import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/api/maintenance-orders",
    tags=["Maintenance & Work Orders"],
)

# In-memory store initialized with realistic initial advisory work orders for Debrecen fleet
INITIAL_WORK_ORDERS = [
    {
        "id": "WO-2026-101",
        "stationCode": "DEB-KER02",
        "stationName": "Karácsony György street, Nursery",
        "sensorType": "Environmental Air & Particulate Pole",
        "priority": "HIGH",
        "status": "SCHEDULED",
        "scheduledDate": (datetime.date.today() + datetime.timedelta(days=3)).isoformat(),
        "scheduledTime": "09:30",
        "assignedTechnician": "Gábor Kovács (Senior Field Tech)",
        "issueDescription": "Optical chamber dust buildup leading to baseline drift (+21.7%).",
        "actionRequired": "Clean optical scattering cavity with nitrogen purge; perform zero-air calibration.",
        "estimatedHours": 1.5,
        "notes": "Access through courtyard gate. Notify nursery management upon arrival.",
        "createdAt": datetime.datetime.now().isoformat(),
        "updatedAt": datetime.datetime.now().isoformat(),
    },
    {
        "id": "WO-2026-102",
        "stationCode": "DEB-KER06",
        "stationName": "Debreceni Vörösmarty Mihály Elementary School",
        "sensorType": "Environmental Air & Particulate Pole",
        "priority": "HIGH",
        "status": "SCHEDULED",
        "scheduledDate": (datetime.date.today() + datetime.timedelta(days=5)).isoformat(),
        "scheduledTime": "13:00",
        "assignedTechnician": "Bence Nagy (IoT Systems Specialist)",
        "issueDescription": "Signal jitter elevated and optical lens dust accumulation.",
        "actionRequired": "Inspect laser diode stability and replace micro-screen filter.",
        "estimatedHours": 2.0,
        "notes": "School grounds require security badge check-in.",
        "createdAt": datetime.datetime.now().isoformat(),
        "updatedAt": datetime.datetime.now().isoformat(),
    },
    {
        "id": "WO-2026-103",
        "stationCode": "DEB-KER11",
        "stationName": "HUN-REN Institute for Nuclear Research",
        "sensorType": "Environmental Air & Particulate Pole",
        "priority": "CRITICAL",
        "status": "SCHEDULED",
        "scheduledDate": (datetime.date.today() + datetime.timedelta(days=1)).isoformat(),
        "scheduledTime": "10:00",
        "assignedTechnician": "László Tóth (Hardware Engineer)",
        "issueDescription": "High signal variance spikes (std > 8.3 µg/m³) indicating sensor transducer instability.",
        "actionRequired": "Complete sensor transducer diagnostic and check grounding cable.",
        "estimatedHours": 2.5,
        "notes": "High priority research anchor point. Contact radiation safety officer if entering perimeter.",
        "createdAt": datetime.datetime.now().isoformat(),
        "updatedAt": datetime.datetime.now().isoformat(),
    },
]

# Thread-safe in-memory cache
_orders_db: dict[str, dict[str, Any]] = {order["id"]: order for order in INITIAL_WORK_ORDERS}


class CreateWorkOrderPayload(BaseModel):
    stationCode: str
    stationName: str
    sensorType: str = "Environmental Air & Particulate Pole"
    priority: str = "HIGH"  # CRITICAL, HIGH, ROUTINE
    scheduledDate: Optional[str] = None
    scheduledTime: Optional[str] = "10:00"
    assignedTechnician: Optional[str] = "Unassigned (Fleet Technician Pool)"
    issueDescription: Optional[str] = "Preventive maintenance recommended by ML Prognostics engine."
    actionRequired: Optional[str] = "Inspect physical enclosure, clean optical apertures, and perform zero baseline calibration."
    estimatedHours: Optional[float] = 1.5
    notes: Optional[str] = ""


class UpdateWorkOrderPayload(BaseModel):
    scheduledDate: Optional[str] = None
    scheduledTime: Optional[str] = None
    priority: Optional[str] = None
    assignedTechnician: Optional[str] = None
    status: Optional[str] = None  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    notes: Optional[str] = None
    estimatedHours: Optional[float] = None


@router.get("/")
def get_all_work_orders():
    """Returns all scheduled, active, and completed maintenance work orders sorted by priority and date."""
    priority_order = {"CRITICAL": 1, "HIGH": 2, "ROUTINE": 3}
    sorted_orders = sorted(
        _orders_db.values(),
        key=lambda x: (
            priority_order.get(x.get("priority", "ROUTINE"), 99),
            x.get("scheduledDate", "9999-99-99"),
            x.get("scheduledTime", "99:99"),
        ),
    )
    return {
        "orders": sorted_orders,
        "total": len(sorted_orders),
        "criticalCount": sum(1 for o in sorted_orders if o.get("priority") == "CRITICAL" and o.get("status") != "CANCELLED"),
        "scheduledCount": sum(1 for o in sorted_orders if o.get("status") == "SCHEDULED"),
    }


@router.post("/")
def create_work_order(payload: CreateWorkOrderPayload):
    """Creates a new maintenance work order with smart default scheduling."""
    # If no date supplied, default to 3 days from now
    default_date = payload.scheduledDate or (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
    new_id = f"WO-2026-{uuid.uuid4().hex[:4].upper()}"

    new_order = {
        "id": new_id,
        "stationCode": payload.stationCode,
        "stationName": payload.stationName,
        "sensorType": payload.sensorType,
        "priority": payload.priority.upper(),
        "status": "SCHEDULED",
        "scheduledDate": default_date,
        "scheduledTime": payload.scheduledTime or "10:00",
        "assignedTechnician": payload.assignedTechnician or "Fleet Technician Pool",
        "issueDescription": payload.issueDescription,
        "actionRequired": payload.actionRequired,
        "estimatedHours": payload.estimatedHours or 1.5,
        "notes": payload.notes or "",
        "createdAt": datetime.datetime.now().isoformat(),
        "updatedAt": datetime.datetime.now().isoformat(),
    }

    _orders_db[new_id] = new_order
    return {"message": "Work order created successfully", "order": new_order}


@router.put("/{order_id}")
def update_work_order(order_id: str, payload: UpdateWorkOrderPayload):
    """Updates scheduled date, time, assigned technician, status, or notes."""
    if order_id not in _orders_db:
        raise HTTPException(status_code=404, detail=f"Work order {order_id} not found.")

    order = _orders_db[order_id]
    if payload.scheduledDate is not None:
        order["scheduledDate"] = payload.scheduledDate
    if payload.scheduledTime is not None:
        order["scheduledTime"] = payload.scheduledTime
    if payload.priority is not None:
        order["priority"] = payload.priority.upper()
    if payload.assignedTechnician is not None:
        order["assignedTechnician"] = payload.assignedTechnician
    if payload.status is not None:
        order["status"] = payload.status.upper()
    if payload.notes is not None:
        order["notes"] = payload.notes
    if payload.estimatedHours is not None:
        order["estimatedHours"] = payload.estimatedHours

    order["updatedAt"] = datetime.datetime.now().isoformat()
    return {"message": "Work order updated successfully", "order": order}


@router.delete("/{order_id}")
def cancel_work_order(order_id: str):
    """Cancels and removes a work order from the active maintenance schedule."""
    if order_id not in _orders_db:
        raise HTTPException(status_code=404, detail=f"Work order {order_id} not found.")

    removed = _orders_db.pop(order_id)
    return {"message": f"Work order {order_id} cancelled successfully", "cancelledOrder": removed}
