from .auth import auth_bp
from .hospitals import hospitals_bp
from .resources import resources_bp
from .search import search_bp
from .alerts import alerts_bp
from .analytics import analytics_bp
from .users import users_bp
from .thresholds import thresholds_bp
from .audit_logs import audit_logs_bp
from .escalation import escalation_bp

def register_routes(app):
    @app.route('/')
    @app.route('/api')
    def index():
        return {"status": "success", "message": "MediGrid API is running", "version": "1.0.0"}

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(hospitals_bp, url_prefix='/api/hospitals')
    app.register_blueprint(resources_bp, url_prefix='/api/resources')
    app.register_blueprint(search_bp, url_prefix='/api/search')
    app.register_blueprint(alerts_bp, url_prefix='/api/alerts')
    app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(thresholds_bp, url_prefix='/api/thresholds')
    app.register_blueprint(audit_logs_bp, url_prefix='/api/audit-logs')
    app.register_blueprint(escalation_bp, url_prefix='/api/escalation')
