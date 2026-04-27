from datetime import datetime, timezone
from app.models.hospital import Hospital
from app.models.resource import Resource
from app.services.audit_service import log_action


LEVEL_NAMES = {0: "Normal", 1: "Pressured", 2: "Diverted", 3: "Critical"}


def calculate_level(hospital_id: str, db) -> int:
    """
    Compute escalation level (0–3) for a hospital based on current resource availability.
    Called inside the existing resource update transaction.
    Returns the integer level.
    """
    resources = db.session.query(Resource).filter_by(
        hospital_id=hospital_id
    ).all()

    if not resources:
        return 0

    percentages = []
    for r in resources:
        if r.total_count and r.total_count > 0:
            pct = (r.available_count / r.total_count) * 100
            percentages.append(pct)

    if not percentages:
        return 0

    avg_pct = sum(percentages) / len(percentages)

    if avg_pct >= 30:
        return 0
    elif avg_pct >= 20:
        return 1
    elif avg_pct >= 10:
        return 2
    else:
        return 3


def update_escalation_level(hospital_id: str, user_id: str, db) -> int:
    """
    Recalculate and persist the escalation level for a hospital.
    Writes to audit_log only if the level changed.
    Returns the new level integer.

    Call this at the END of the resource update transaction in resources.py,
    after the resource rows have been updated but before db.session.commit().
    """
    hospital = db.session.query(Hospital).filter_by(
        hospital_id=hospital_id
    ).first()

    if not hospital:
        return 0

    old_level = hospital.escalation_level
    new_level = calculate_level(hospital_id, db)

    hospital.escalation_level = new_level
    hospital.escalation_updated_at = datetime.now(timezone.utc)

    # Only write audit log if level actually changed
    if old_level != new_level:
        try:
            log_action(
                user_id=user_id,
                action="UPDATE",
                entity_type="escalation_level",
                entity_id=hospital_id,
                old_value={"level": old_level, "name": LEVEL_NAMES[old_level]},
                new_value={"level": new_level, "name": LEVEL_NAMES[new_level]},
                session=db.session,
                commit=False
            )
        except Exception:
            pass  # Never fail resource updates due to audit log errors

    return new_level


def get_city_escalation_summary(db) -> dict:
    """
    Returns counts of hospitals at each escalation level.
    Used by Dashboard and Analytics endpoints.
    Only counts active hospitals.
    """
    hospitals = db.session.query(Hospital).filter_by(status='active').all()

    summary = {0: 0, 1: 0, 2: 0, 3: 0}
    for h in hospitals:
        level = h.escalation_level if h.escalation_level in summary else 0
        summary[level] += 1

    return {
        "normal":    summary[0],
        "pressured": summary[1],
        "diverted":  summary[2],
        "critical":  summary[3],
        "total":     len(hospitals)
    }
