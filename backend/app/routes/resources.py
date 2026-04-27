from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.hospital import Hospital
from app.models.resource import Resource
from app.models.user import User
from app.models.audit_log import AuditLog
from app.extensions import db
from app.services.alert_service import check_and_trigger
from app.services.audit_service import log_action
from app.services.escalation_service import update_escalation_level, LEVEL_NAMES
from app.utils.responses import success_response, error_response
from app.schemas.hospital_schema import hospital_schema
from app.schemas.resource_schema import resources_schema, resource_updates_schema

resources_bp = Blueprint('resources', __name__)

@resources_bp.route('', methods=['GET'])
@jwt_required()
def get_resources():
    try:
        hospital_id = request.args.get('hospital_id')
        query = Resource.query
        if hospital_id:
            query = query.filter_by(hospital_id=hospital_id)
        resources = query.all()
        return success_response({"resources": resources_schema.dump(resources)})
    except Exception as e:
        return error_response(str(e))

@resources_bp.route('/<hospital_id>', methods=['PATCH'])
@resources_bp.route('/<hospital_id>/update', methods=['PATCH'])
@jwt_required()
def update_resources(hospital_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if not user:
            return error_response("User not found", 404)

        if user.role == 'hospital_admin' and str(user.hospital_id) != hospital_id:
            return error_response("Forbidden: You can only update your own hospital", 403)

        if user.role not in ['hospital_admin', 'system_admin']:
            return error_response("Forbidden: Unauthorized role", 403)

        data = request.get_json() or {}
        hospital = Hospital.query.get_or_404(hospital_id)

        updates = []
        errors = {}

        for r_type, available in data.items():
            resource = Resource.query.filter_by(hospital_id=hospital_id, resource_type=r_type).first()
            if not resource:
                continue

            if available > resource.total_count:
                errors[r_type] = f"Available count ({available}) cannot exceed total count ({resource.total_count})"
                continue

            old_val = resource.available_count
            resource.available_count = available
            resource.updated_by = user_id
            updates.append((r_type, old_val, available))

        if errors:
            return error_response("Validation failed", 400, errors)

        for r_type, old_v, new_v in updates:
            check_and_trigger(hospital_id, r_type, new_v, session=db.session)
            log_action(user_id, "UPDATE", "resource", hospital_id,
                       old_value={r_type: old_v}, new_value={r_type: new_v},
                       session=db.session, commit=False)

        # Recalculate and persist the escalation level
        new_level = update_escalation_level(
            hospital_id=hospital_id,
            user_id=str(user_id),
            db=db
        )

        db.session.commit()

        resources_data = hospital_schema.dump(hospital).get('resources')
        return success_response({
            "resources": resources_data,
            "escalation_level": new_level,
            "escalation_level_name": LEVEL_NAMES[new_level]
        }, "Resources updated")
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return error_response(str(e))

@resources_bp.route('/<hospital_id>/history', methods=['GET'])
@jwt_required()
def get_resource_history(hospital_id):
    try:
        logs = AuditLog.query.filter_by(entity_type='resource', entity_id=hospital_id) \
            .order_by(AuditLog.created_at.desc()).limit(20).all()

        return success_response({"history": resource_updates_schema.dump(logs)})
    except Exception as e:
        return error_response(str(e))
