import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_ai_city_analytics():
    response = client.get("/api/recommendations/ai-city-analytics")
    assert response.status_code == 200
    data = response.json()
    
    # 1. City Health Index
    assert "cityHealth" in data
    health = data["cityHealth"]
    assert 0 <= health["healthScore"] <= 100
    assert health["vitalityLabel"] in [
        "Optimal & Fresh", "Good & Healthy", "Moderate Concern", "Unhealthy Alert"
    ]
    assert len(health["citizenTip"]) > 10
    
    # 2. District Machine Learning Predictions
    assert "districtProfiles" in data
    districts = data["districtProfiles"]
    assert len(districts) == 7
    for d in districts:
        assert "district" in d
        assert "pm25" in d
        assert "dayNoise" in d
        assert "krigingUncertainty" in d
        assert "informationGainScore" in d
        assert d["dayNoise"] > 0
        assert 0 <= d["krigingUncertainty"] <= 100
        
    # 3. Telemetry
    assert "telemetry" in data
    telem = data["telemetry"]
    assert telem["airStationCount"] > 0
    assert telem["noiseStationCount"] == 5
    assert telem["noiseRecordCount"] == 300
    assert telem["groundwaterStationCount"] == 15
    assert telem["groundwaterRecordCount"] == 31625

def test_data_quality_endpoint():
    response = client.get("/api/data-quality/")
    assert response.status_code == 200
    data = response.json()
    assert "noiseSummary" in data
    assert "waterSummary" in data
    assert data["noiseSummary"]["stationCount"] == 5
    assert data["waterSummary"]["stationCount"] == 15
