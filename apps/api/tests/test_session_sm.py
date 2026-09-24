from session_sm import Session, accrue_exposure, apply_grace, empty_governor, on_face, tick


def _s(**kwargs) -> Session:
    base = dict(
        id="s1",
        device_token="d",
        state="calibrating",
        started_at=0.0,
        last_seen=0.0,
        governor=empty_governor(),
    )
    base.update(kwargs)
    return Session(**base)


def test_grace_to_monitoring():
    s = _s(state="calibrating", started_at=0.0)
    apply_grace(s, 19)
    assert s.state == "calibrating"
    apply_grace(s, 20)
    assert s.state == "monitoring"


def test_face_lost_away_only_from_monitoring():
    s = _s(state="monitoring", last_seen=0.0, last_face_present=False, face_lost_since=0.0)
    tick(s, 30)
    assert s.state == "away"
    s2 = _s(state="break", last_seen=0.0, last_face_present=False, face_lost_since=0.0)
    tick(s2, 30)
    assert s2.state == "break"


def test_heartbeat_timeout_away():
    s = _s(state="monitoring", last_seen=0.0, last_face_present=True)
    tick(s, 30)
    assert s.state == "away"


def test_away_reset_and_close():
    s = _s(state="away", last_seen=0.0, away_since=0.0, exposure_sec=100)
    tick(s, 180)
    assert s.exposure_sec == 0.0
    assert s.state == "away"
    tick(s, 900)
    assert s.state == "ended"


def test_return_before_3min_keeps_exposure():
    s = _s(state="away", last_seen=10.0, away_since=0.0, exposure_sec=40, last_face_present=False)
    on_face(s, True, 35)
    assert s.state == "monitoring"
    assert s.exposure_sec == 40


def test_exposure_only_monitoring_with_face():
    s = _s(state="monitoring")
    accrue_exposure(s, True)
    assert s.exposure_sec == 2
    s.state = "calibrating"
    accrue_exposure(s, True)
    assert s.exposure_sec == 2
    s.state = "monitoring"
    accrue_exposure(s, False)
    assert s.exposure_sec == 2
