from marshmallow import Schema, fields, post_dump

class ResourceSchema(Schema):
    resource_type = fields.Str()
    total_count = fields.Int()
    available_count = fields.Int()
    last_updated = fields.DateTime()

class HospitalSchema(Schema):
    hospital_id = fields.UUID()
    name = fields.Str()
    address = fields.Str()
    zone = fields.Str()
    type = fields.Str()
    contact = fields.Str()
    email = fields.Email()
    lat = fields.Float()
    lng = fields.Float()
    status = fields.Str()
    registered_at = fields.DateTime()
    escalation_level = fields.Integer(dump_default=0)
    escalation_updated_at = fields.DateTime(allow_none=True)
    
    # Custom resource mapping for the frontend format
    resources = fields.Method("get_resources")
    last_updated = fields.Method("get_last_updated")

    def get_resources(self, obj):
        res_dict = {}
        for r in obj.resources:
            res_dict[r.resource_type] = {
                "total": r.total_count,
                "available": r.available_count
            }
        return res_dict

    def get_last_updated(self, obj):
        if not obj.resources:
            return obj.registered_at.isoformat() if obj.registered_at else None
        latest = max((r.last_updated for r in obj.resources if r.last_updated), default=obj.registered_at)
        return latest.isoformat() if latest else None

hospital_schema = HospitalSchema()
hospitals_schema = HospitalSchema(many=True)
