from app.models import AwardScan


def test_award_scan_table_shape():
    cols = AwardScan.__table__.columns
    for name in ("id", "platform", "username", "measurements",
                 "archive_watermark", "games_parsed", "scanned_at"):
        assert name in cols, f"missing column {name}"


def test_platform_and_username_are_uniquely_constrained():
    constraints = {
        tuple(sorted(c.columns.keys()))
        for c in AwardScan.__table__.constraints
        if hasattr(c, "columns") and len(c.columns) == 2
    }
    assert ("platform", "username") in constraints
