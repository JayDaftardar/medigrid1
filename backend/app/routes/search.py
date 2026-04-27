from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models.hospital import Hospital
from app.models.resource import Resource
from app.models.search_log import SearchLog
from app.extensions import db
from app.schemas.hospital_schema import hospital_schema
from app.utils.responses import success_response, error_response
import math

search_bp = Blueprint('search', __name__)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@search_bp.route('', methods=['GET'])
def search():
    try:
        zone = request.args.get('zone')
        resource_type = request.args.get('resource_type', 'general_bed')
        h_type = request.args.get('type')
        min_available = request.args.get('min_available', 0, type=int)
        query_text = request.args.get('q', '')
        user_lat = request.args.get('user_lat', type=float)
        user_lng = request.args.get('user_lng', type=float)
        include_critical = request.args.get('include_critical', 'false').lower() == 'true'

        query = db.session.query(Hospital).join(Resource).filter(Hospital.status == 'active')

        # Soft-exclude Level 3 hospitals unless include_critical=true
        if not include_critical:
            query = query.filter(Hospital.escalation_level < 3)

        if zone and zone != 'All Zones':
            query = query.filter(Hospital.zone == zone)
        if h_type and h_type != 'All Types':
            query = query.filter(Hospital.type.ilike(h_type))
        if query_text:
            query = query.filter((Hospital.name.ilike(f"%{query_text}%")) | (Hospital.address.ilike(f"%{query_text}%")))

        query = query.filter(Resource.resource_type == resource_type)
        query = query.filter(Resource.available_count >= min_available)

        hospitals = query.order_by(Resource.available_count.desc()).all()
        results = []

        from app.services.escalation_service import LEVEL_NAMES
        for h in hospitals:
            h_data = hospital_schema.dump(h)
            dist = None
            if user_lat is not None and user_lng is not None and h.lat and h.lng:
                dist = haversine(user_lat, user_lng, float(h.lat), float(h.lng))

            h_data['distance_km'] = round(dist, 2) if dist is not None else None
            h_data['escalation_level'] = h.escalation_level
            h_data['escalation_level_name'] = LEVEL_NAMES.get(h.escalation_level, "Normal")
            results.append(h_data)

        if user_lat is not None and user_lng is not None:
            results.sort(key=lambda x: (-x['resources'].get(resource_type, {}).get('available', 0), x['distance_km'] or 99999))

        if results:
            results[0]['is_best_match'] = True

        for i in range(1, len(results)):
            results[i]['is_best_match'] = False

        # Count excluded critical hospitals
        if not include_critical:
            excluded_count = db.session.query(Hospital).filter(
                Hospital.status == 'active',
                Hospital.escalation_level == 3
            ).count()
        else:
            excluded_count = 0

        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
        except Exception:
            user_id = None

        log = SearchLog(
            user_id=user_id,
            query_text=query_text,
            zone_filter=zone,
            resource_filter=resource_type,
            results_count=len(results)
        )
        db.session.add(log)
        db.session.commit()

        return success_response({
            "results": results,
            "total": len(results),
            "excluded_critical_count": excluded_count
        })
    except Exception as e:
        return error_response(str(e))
