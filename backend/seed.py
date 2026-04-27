from app import create_app
from app.extensions import db
from app.models import Hospital, Resource, User, Threshold, Alert
from datetime import datetime

app = create_app()

def seed_db():
    with app.app_context():
        # Clear existing data
        db.drop_all()
        db.create_all()

        print("Seeding hospitals...")
        hospitals_data = [
            { "name": "City General Hospital",        "zone": "Central",  "type": "public",  "address": "1 Sassoon Road, Pune 411001", "lat": 18.5204, "lng": 73.8567, "contact": "020-26128000", "email": "citygeneral@pune.gov.in",     "resources": {"general_bed": (200,145), "icu_bed": (20,8),  "ventilator": (15,3)} },
            { "name": "Apollo Medical Center",         "zone": "North",    "type": "private", "address": "154A Nagar Road, Pune 411014", "lat": 18.5523, "lng": 73.8975, "contact": "020-41804180", "email": "info@apollopune.com",          "resources": {"general_bed": (120,89), "icu_bed": (25,18), "ventilator": (12,10)} },
            { "name": "Government District Hospital",  "zone": "South",    "type": "public",  "address": "Near Swargate, Pune 411042", "lat": 18.4983, "lng": 73.8606, "contact": "020-24440101", "email": "gdh.south@pune.gov.in",        "resources": {"general_bed": (350,201), "icu_bed": (30,4), "ventilator": (20,2)} },
            { "name": "Lifeline Multispecialty",       "zone": "East",     "type": "private", "address": "45 Hadapsar Road, Pune 411028", "lat": 18.5069, "lng": 73.9309, "contact": "020-27128800", "email": "admin@lifelinepune.com",       "resources": {"general_bed": (80,55),  "icu_bed": (15,12), "ventilator": (10,8)} },
            { "name": "Sassoon General Hospital",      "zone": "West",     "type": "public",  "address": "Near Pune Railway Station, Pune 411001", "lat": 18.5181, "lng": 73.8568, "contact": "020-26128000", "email": "sassoon@pune.gov.in",          "resources": {"general_bed": (500,312), "icu_bed": (40,22), "ventilator": (25,14)} },
            { "name": "Ruby Hall Clinic",              "zone": "Central",  "type": "private", "address": "40 Sassoon Road, Pune 411001", "lat": 18.5248, "lng": 73.8678, "contact": "020-66455000", "email": "info@rubyhall.com",            "resources": {"general_bed": (100,78), "icu_bed": (12,9),  "ventilator": (8,6)} },
            { "name": "Jehangir Hospital",             "zone": "North",    "type": "private", "address": "32 Sassoon Road, Pune 411001", "lat": 18.5255, "lng": 73.8708, "contact": "020-66814444", "email": "info@jehangir.com",            "resources": {"general_bed": (60,44),  "icu_bed": (10,7),  "ventilator": (6,4)} },
            { "name": "District Civil Hospital",       "zone": "Suburban", "type": "public",  "address": "Pimpri-Chinchwad, Pune 411018", "lat": 18.6298, "lng": 73.8055, "contact": "020-27652015", "email": "dch.pimpri@pune.gov.in",       "resources": {"general_bed": (200,0),  "icu_bed": (20,0),  "ventilator": (15,0)}, "status": "inactive" },
            { "name": "Poona Hospital",                "zone": "East",     "type": "public",  "address": "27 Sadashiv Peth, Pune 411030", "lat": 18.5151, "lng": 73.8553, "contact": "020-24476111", "email": "info@poonahospital.org",       "resources": {"general_bed": (250,167), "icu_bed": (25,15), "ventilator": (18,9)} },
        ]

        hospitals_map = {}
        for h_info in hospitals_data:
            resources_info = h_info.pop("resources")
            h = Hospital(**h_info)
            db.session.add(h)
            db.session.flush()
            hospitals_map[h.name] = h.hospital_id
            
            for r_type, (total, avail) in resources_info.items():
                res = Resource(hospital_id=h.hospital_id, resource_type=r_type, total_count=total, available_count=avail)
                db.session.add(res)
                
                # Default Thresholds
                min_v = 30 if r_type == 'general_bed' else (5 if r_type == 'icu_bed' else 3)
                thresh = Threshold(hospital_id=h.hospital_id, resource_type=r_type, min_value=min_v)
                db.session.add(thresh)

        print("Seeding users...")
        users_data = [
            { "name": "Dr. System Admin",   "email": "admin@medigrid.in",       "password": "Admin@1234",    "role": "system_admin",   "hospital_id": None },
            { "name": "Dr. Priya Rao",      "email": "priya.rao@citygeneral.in","password": "Hospital@123",  "role": "hospital_admin", "hospital": "City General Hospital" },
            { "name": "Dr. Arjun Mehta",    "email": "arjun@apollo.com",        "password": "Apollo@123",    "role": "hospital_admin", "hospital": "Apollo Medical Center" },
            { "name": "Insp. Rohan Sharma", "email": "rohan.s@punepolice.in",   "password": "Operator@123",  "role": "operator",       "hospital_id": None },
            { "name": "Ms. Kavita Desai",   "email": "kavita@punecity.gov.in",  "password": "Authority@123", "role": "authority",      "hospital_id": None },
        ]

        admin_user = None
        for u_info in users_data:
            h_name = u_info.pop("hospital", None)
            if h_name:
                u_info["hospital_id"] = hospitals_map.get(h_name)
            
            password = u_info.pop("password")
            user = User(**u_info)
            user.set_password(password)
            db.session.add(user)
            if u_info.get("role") == "system_admin":
                admin_user = user

        db.session.flush()  # Flush to get user IDs

        print("Seeding demo alerts...")
        # City General Hospital | ICU beds: 8, threshold: 10 -> alert
        cgh_id = hospitals_map["City General Hospital"]
        cgh_thresh = Threshold.query.filter_by(hospital_id=cgh_id, resource_type="icu_bed").first()
        cgh_thresh.min_value = 10
        alert0 = Alert(hospital_id=cgh_id, resource_type="icu_bed", threshold_value=10, current_value=8, severity="warning", status="active")
        db.session.add(alert0)

        # Government District Hospital | Ventilators: 2, threshold: 3 -> alert
        gdh_id = hospitals_map["Government District Hospital"]
        alert1 = Alert(hospital_id=gdh_id, resource_type="ventilator", threshold_value=3, current_value=2, severity="critical", status="active")
        db.session.add(alert1)

        # Poona Hospital | General beds: 167, threshold: 200 -> alert
        ph_id = hospitals_map["Poona Hospital"]
        ph_thresh = Threshold.query.filter_by(hospital_id=ph_id, resource_type="general_bed").first()
        ph_thresh.min_value = 200
        alert2 = Alert(hospital_id=ph_id, resource_type="general_bed", threshold_value=200, current_value=167, severity="warning", status="active")
        db.session.add(alert2)

        print("Computing initial escalation levels...")
        from app.services.escalation_service import update_escalation_level
        db.session.flush()  # Ensure resources are flushed before computing levels

        # Use the admin user id for audit log attribution during seeding
        admin_id = str(admin_user.user_id) if admin_user else "00000000-0000-0000-0000-000000000000"

        for hospital in db.session.query(Hospital).all():
            update_escalation_level(
                hospital_id=str(hospital.hospital_id),
                user_id=admin_id,
                db=db
            )

        db.session.commit()
        print("Database seeded successfully!")
        print("Escalation levels seeded for all hospitals.")

if __name__ == '__main__':
    seed_db()

