from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.hospital import Hospital
from app.utils.decorators import role_required

escalation_bp = Blueprint('escalation', __name__)


@escalation_bp.route('/history', methods=['GET'])
@jwt_required()
@role_required('system_admin', 'authority')
def get_escalation_history():
    """
    GET /api/escalation/history
    Query params:
      - hospital_id (optional) — filter to one hospital
      - days (optional, default 30) — how many days back
      - page (optional, default 1)
      - per_page (optional, default 20)

    Returns audit log entries where entity_type = 'escalation_level',
    enriched with hospital name.
    """
    hospital_id = request.args.get('hospital_id')
    days = int(request.args.get('days', 30))
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))

    from datetime import datetime, timezone, timedelta
    since = datetime.now(timezone.utc) - timedelta(days=days)

    query = db.session.query(AuditLog, Hospital).join(
        Hospital, AuditLog.entity_id == Hospital.hospital_id
    ).filter(
        AuditLog.entity_type == 'escalation_level',
        AuditLog.created_at >= since
    )

    if hospital_id:
        query = query.filter(AuditLog.entity_id == hospital_id)

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()) \
                .offset((page - 1) * per_page) \
                .limit(per_page) \
                .all()

    results = []
    for log, hospital in logs:
        results.append({
            "log_id": str(log.log_id),
            "hospital_id": str(log.entity_id),
            "hospital_name": hospital.name,
            "hospital_zone": hospital.zone,
            "old_level": log.old_value.get('level') if log.old_value else None,
            "old_level_name": log.old_value.get('name') if log.old_value else None,
            "new_level": log.new_value.get('level') if log.new_value else None,
            "new_level_name": log.new_value.get('name') if log.new_value else None,
            "changed_at": log.created_at.isoformat()
        })

    return jsonify({
        "status": "success",
        "data": {
            "history": results,
            "total": total,
            "page": page,
            "per_page": per_page
        }
    })


@escalation_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_escalation_summary():
    """
    GET /api/escalation/summary
    Returns current count of hospitals at each escalation level.
    Accessible to all authenticated roles.
    """
    from app.services.escalation_service import get_city_escalation_summary
    summary = get_city_escalation_summary(db)
    return jsonify({"status": "success", "data": summary})


@escalation_bp.route('/hospitals', methods=['GET'])
@jwt_required()
def get_hospitals_by_level():
    """
    GET /api/escalation/hospitals?level=2
    Returns all active hospitals at a specific escalation level.
    Useful for the Dashboard 'Diverted' and 'Critical' hospital lists.
    """
    level = request.args.get('level', type=int)
    if level is None or level not in [0, 1, 2, 3]:
        return jsonify({"status": "error", "message": "level must be 0, 1, 2, or 3"}), 400

    hospitals = db.session.query(Hospital).filter_by(
        status='active', escalation_level=level
    ).all()

    from app.schemas.hospital_schema import HospitalSchema
    schema = HospitalSchema(many=True)
    return jsonify({
        "status": "success",
        "data": {
            "hospitals": schema.dump(hospitals),
            "count": len(hospitals)
        }
    })
