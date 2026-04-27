from app.extensions import db
from datetime import datetime, timezone
import uuid

class Hospital(db.Model):
    __tablename__ = 'hospitals'
    
    hospital_id = db.Column(db.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = db.Column(db.String(200), nullable=False)
    address = db.Column(db.Text, nullable=False)
    zone = db.Column(db.String(50), nullable=False)  # 'North','South','East','West','Central','Suburban'
    type = db.Column(db.String(20), nullable=False)  # 'public' or 'private'
    contact = db.Column(db.String(20))
    email = db.Column(db.String(100))
    lat = db.Column(db.Numeric(10, 7))
    lng = db.Column(db.Numeric(10, 7))
    status = db.Column(db.String(20), nullable=False, default='active')
    registered_at = db.Column(db.DateTime, default=datetime.utcnow)
    escalation_level = db.Column(db.Integer, nullable=False, default=0)
    escalation_updated_at = db.Column(db.DateTime(timezone=True), nullable=True)

    resources = db.relationship('Resource', backref='hospital', lazy=True, cascade="all, delete-orphan")
    alerts = db.relationship('Alert', backref='hospital', lazy=True, cascade="all, delete-orphan")
    thresholds = db.relationship('Threshold', backref='hospital', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Hospital {self.name}>'
