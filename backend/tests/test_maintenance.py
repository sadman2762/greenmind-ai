from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_maintenance_endpoints():
    # 1. GET all orders
    res = client.get("/api/maintenance-orders/")
    assert res.status_code == 200
    data = res.json()
    assert "orders" in data
    assert "total" in data
    assert data["total"] >= 3

    # 2. POST create new order
    new_order_payload = {
        "stationCode": "DEB-KER18",
        "stationName": "Southern Economic Zone junction 481-47 intersection",
        "sensorType": "Environmental Air & Particulate Pole",
        "priority": "CRITICAL",
        "scheduledDate": "2026-06-25",
        "scheduledTime": "11:00",
        "assignedTechnician": "Test Tech",
        "issueDescription": "Scheduled filter replacement",
        "actionRequired": "Replace filter cartridge",
    }
    create_res = client.post("/api/maintenance-orders/", json=new_order_payload)
    assert create_res.status_code == 200
    created = create_res.json()["order"]
    order_id = created["id"]
    assert created["stationCode"] == "DEB-KER18"
    assert created["priority"] == "CRITICAL"
    assert created["scheduledDate"] == "2026-06-25"

    # 3. PUT modify scheduled date and time
    update_payload = {
        "scheduledDate": "2026-06-28",
        "scheduledTime": "14:30",
        "priority": "HIGH",
    }
    update_res = client.put(f"/api/maintenance-orders/{order_id}", json=update_payload)
    assert update_res.status_code == 200
    updated = update_res.json()["order"]
    assert updated["scheduledDate"] == "2026-06-28"
    assert updated["scheduledTime"] == "14:30"
    assert updated["priority"] == "HIGH"

    # 4. DELETE cancel work order
    cancel_res = client.delete(f"/api/maintenance-orders/{order_id}")
    assert cancel_res.status_code == 200
    assert "cancelled successfully" in cancel_res.json()["message"]

    # Verify cancelled order is no longer in active list
    res_after = client.get("/api/maintenance-orders/")
    order_ids = [o["id"] for o in res_after.json()["orders"]]
    assert order_id not in order_ids
