from flask import Blueprint, request, make_response
from flask_jwt_extended import jwt_required
from app.models.hospital import Hospital
from app.models.resource import Resource
from app.models.audit_log import AuditLog
from app.extensions import db
from app.utils.responses import success_response, error_response
from app.utils.decorators import role_required as custom_role_required
from app.services.escalation_service import get_city_escalation_summary
import csv
import io
from datetime import datetime, timedelta

analytics_bp = Blueprint('analytics', __name__)

@analytics_bp.route('/summary', methods=['GET'])
@jwt_required()
@custom_role_required('authority', 'system_admin')
def get_summary():
    try:
        total_hospitals = Hospital.query.count()

        city_totals = {}
        for r_type in ['general_bed', 'icu_bed', 'ventilator']:
            total = db.session.query(db.func.sum(Resource.total_count)).filter(Resource.resource_type == r_type).scalar() or 0
            available = db.session.query(db.func.sum(Resource.available_count)).filter(Resource.resource_type == r_type).scalar() or 0
            city_totals[r_type] = {"total": total, "available": available}

        zones = db.session.query(Hospital.zone).distinct().all()
        zone_utilization = []
        for (zone,) in zones:
            total = db.session.query(db.func.sum(Resource.total_count)).join(Hospital).filter(Hospital.zone == zone).scalar() or 1
            available = db.session.query(db.func.sum(Resource.available_count)).join(Hospital).filter(Hospital.zone == zone).scalar() or 0
            util_pct = round(((total - available) / total) * 100)
            zone_utilization.append({"zone": zone, "utilization_pct": util_pct})

        hospital_rows = []
        hospitals = Hospital.query.all()
        for h in hospitals:
            total = sum((r.total_count for r in h.resources)) or 1
            available = sum((r.available_count for r in h.resources))
            utilization_pct = round(((total - available) / total) * 100)
            hospital_rows.append({
                "hospital_id": str(h.hospital_id),
                "name": h.name,
                "zone": h.zone,
                "utilization_pct": utilization_pct
            })

        top_overloaded = sorted(hospital_rows, key=lambda x: x["utilization_pct"], reverse=True)[:5]
        top_underutilized = sorted(hospital_rows, key=lambda x: x["utilization_pct"])[:5]

        escalation_summary = get_city_escalation_summary(db)

        return success_response({
            "total_hospitals": total_hospitals,
            "city_totals": city_totals,
            "zone_utilization": zone_utilization,
            "top_overloaded": top_overloaded,
            "top_underutilized": top_underutilized,
            "escalation_summary": escalation_summary
        })
    except Exception as e:
        return error_response(str(e))


@analytics_bp.route('/trends', methods=['GET'])
@jwt_required()
@custom_role_required('authority', 'system_admin')
def get_trends():
    try:
        range_days = request.args.get('range', '7d')
        resource_filter = request.args.get('resource_type', 'all')
        days = 7
        if range_days == '30d':
            days = 30
        elif range_days == '90d':
            days = 90

        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days - 1)

        resources = Resource.query.all()
        current_map = {(str(r.hospital_id), r.resource_type): r.available_count for r in resources}

        logs = AuditLog.query.filter(
            AuditLog.entity_type == 'resource',
            AuditLog.created_at >= datetime.combine(start_date, datetime.min.time()),
            AuditLog.created_at <= datetime.combine(end_date, datetime.max.time())
        ).order_by(AuditLog.created_at.asc()).all()

        earliest_seen = set()
        for log in logs:
            if not log.old_value:
                continue
            for r_type, old_val in (log.old_value or {}).items():
                key = (str(log.entity_id), r_type)
                if key not in earliest_seen:
                    current_map[key] = old_val
                    earliest_seen.add(key)

        logs_by_day = {}
        for log in logs:
            day_key = log.created_at.date()
            logs_by_day.setdefault(day_key, []).append(log)

        labels = []
        datasets = {"general_bed": [], "icu_bed": [], "ventilator": []}

        for i in range(days):
            day = start_date + timedelta(days=i)
            labels.append(day.strftime("%a" if days == 7 else "%d %b"))
            for log in logs_by_day.get(day, []):
                for r_type, new_val in (log.new_value or {}).items():
                    current_map[(str(log.entity_id), r_type)] = new_val

            totals = {"general_bed": 0, "icu_bed": 0, "ventilator": 0}
            for (hospital_id, r_type), value in current_map.items():
                if r_type in totals:
                    totals[r_type] += value

            for r_type in totals.keys():
                datasets[r_type].append(totals[r_type])

        if resource_filter and resource_filter != 'all' and resource_filter in datasets:
            datasets = {resource_filter: datasets[resource_filter]}

        return success_response({
            "labels": labels,
            "datasets": datasets
        })
    except Exception as e:
        return error_response(str(e))

@analytics_bp.route('/export', methods=['GET'])
@jwt_required()
@custom_role_required('authority', 'system_admin')
def export_csv():
    try:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['date', 'hospital_name', 'zone', 'general_bed_available', 'icu_bed_available', 'ventilator_available'])

        hospitals = Hospital.query.all()
        for h in hospitals:
            res = {r.resource_type: r.available_count for r in h.resources}
            writer.writerow([
                datetime.utcnow().strftime("%Y-%m-%d"),
                h.name,
                h.zone,
                res.get('general_bed', 0),
                res.get('icu_bed', 0),
                res.get('ventilator', 0)
            ])

        response = make_response(output.getvalue())
        response.headers["Content-Disposition"] = f"attachment; filename=medigrid_report_{datetime.utcnow().strftime('%Y%m%d')}.csv"
        response.headers["Content-type"] = "text/csv"
        return response
    except Exception as e:
        return error_response(str(e))
