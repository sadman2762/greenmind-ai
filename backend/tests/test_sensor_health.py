from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_sensor_health_endpoint():
    response = client.get("/api/sensor-health/")
    assert response.status_code == 200
    data = response.json()

    assert "fleetSummary" in data
    assert "stations" in data

    summary = data["fleetSummary"]
    assert "fleetHealthScore" in summary
    assert "totalStations" in summary
    assert summary["totalStations"] > 0
    assert 0 <= summary["fleetHealthScore"] <= 100

    stations = data["stations"]
    assert len(stations) > 0

    first = stations[0]
    assert "stationCode" in first
    assert "healthScore" in first
    assert "estimatedDaysToService" in first
    assert "status" in first
    assert "recommendedAction" in first
    assert first["status"] in ["OPTIMAL", "WARNING", "CRITICAL"]
    assert first["estimatedDaysToService"] >= 1


def test_add_new_sensor_endpoint():
    payload = {
        "stationCode": "DEB-TEST99",
        "name": "Debrecen Innovation Park Lab Node",
        "sensorCategory": "AIR",
        "sensorType": "Tier 1: Reference Air Monitoring Station",
        "latitude": 47.5450,
        "longitude": 21.6150,
        "healthScore": 100,
        "estimatedDaysToService": 180,
    }
    response = client.post("/api/sensor-health/stations", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "station" in data
    assert data["station"]["stationCode"] == "DEB-TEST99"
    assert data["station"]["healthScore"] == 100
    assert data["station"]["status"] == "OPTIMAL"

    # Verify new sensor is included in GET /api/sensor-health/
    get_res = client.get("/api/sensor-health/")
    assert get_res.status_code == 200
    all_codes = [s["stationCode"] for s in get_res.json()["stations"]]
    assert "DEB-TEST99" in all_codes


def test_remove_sensor_endpoint():
    # 1. Register a test sensor
    payload = {
        "stationCode": "DEB-DECOM01",
        "name": "Decommission Candidate Sensor",
        "sensorCategory": "AIR",
        "latitude": 47.5300,
        "longitude": 21.6200,
        "healthScore": 45,
        "estimatedDaysToService": 14,
    }
    client.post("/api/sensor-health/stations", json=payload)

    # 2. Decommission via DELETE
    del_res = client.delete("/api/sensor-health/stations/DEB-DECOM01")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["removedStationCode"] == "DEB-DECOM01"

    # 3. Verify it's purged from the returned fleet report and GET endpoint
    report_codes = [s["stationCode"] for s in del_data["fleetReport"]["stations"]]
    assert "DEB-DECOM01" not in report_codes

    get_res = client.get("/api/sensor-health/")
    assert get_res.status_code == 200
    all_codes = [s["stationCode"] for s in get_res.json()["stations"]]
    assert "DEB-DECOM01" not in all_codes

