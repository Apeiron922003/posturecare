from fastapi.testclient import TestClient

from main import app


def test_start_takeover_stop():
    with TestClient(app) as c:
        headers = {"X-Device-Token": "tok-a"}
        r = c.post("/api/sessions/start", json={"tab_id": "t1"}, headers=headers)
        assert r.status_code == 200
        body = r.json()
        sid = body["session_id"]
        assert body["state"] in ("calibrating", "monitoring")
        assert body["lease_generation"] == 1
        assert body["you_are_leader"] is True

        r2 = c.post("/api/sessions/start", json={"tab_id": "t2"}, headers=headers)
        assert r2.json()["session_id"] == sid
        assert r2.json()["owner_live"] is True
        assert r2.json()["you_are_leader"] is False

        t = c.post(f"/api/sessions/{sid}/takeover", json={"tab_id": "t2"}, headers=headers)
        assert t.status_code == 200
        assert t.json()["you_are_leader"] is True
        assert t.json()["lease_generation"] == 2

        hb = c.post(
            f"/api/sessions/{sid}/heartbeat",
            json={"tab_id": "t1", "lease_generation": 1, "face_present": True},
            headers=headers,
        )
        assert hb.status_code == 409

        ok = c.post(
            f"/api/sessions/{sid}/heartbeat",
            json={"tab_id": "t2", "lease_generation": 2, "face_present": True},
            headers=headers,
        )
        assert ok.status_code == 200

        other = c.get(f"/api/sessions/{sid}", headers={"X-Device-Token": "other"})
        assert other.status_code == 403

        stop = c.post(f"/api/sessions/{sid}/stop", json={"tab_id": "t2"}, headers=headers)
        assert stop.json()["state"] == "ended"


def test_rules_scoped_and_bounds():
    with TestClient(app) as c:
        a = {"X-Device-Token": "a"}
        b = {"X-Device-Token": "b"}
        bad = c.put("/api/rules", json={"rules": {"hold_danger_sec": 0}}, headers=a)
        assert bad.status_code == 422
        ok = c.put("/api/rules", json={"rules": {"demo_mode": True, "pitch_threshold_deg": 8}}, headers=a)
        assert ok.status_code == 204
        ra = c.get("/api/rules", headers=a).json()
        rb = c.get("/api/rules", headers=b).json()
        assert ra["demo_mode"] is True
        assert ra["pitch_threshold_deg"] == 8
        assert rb["demo_mode"] is False
        assert rb["pitch_threshold_deg"] == 5
