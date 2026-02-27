from flask import Flask, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from urllib.parse import urlparse
from authlib.integrations.flask_client import OAuth
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "prod_secret_123")

uri = os.getenv("DATABASE_URL", "sqlite:///local.db")
if uri.startswith("postgres://"): uri = uri.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

db = SQLAlchemy(app)
oauth = OAuth(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    websites = db.relationship('Website', backref='user', lazy=True)

class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), nullable=False)
    domain = db.Column(db.String(200))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    notes = db.relationship('Note', backref='website', lazy=True, cascade="all, delete-orphan")

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    local_id = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(255), nullable=False, default="Untitled")
    content = db.Column(db.Text, nullable=True)
    selection = db.Column(db.Text)
    pinned = db.Column(db.Boolean, default=False) # NEW: Pinned Feature
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)

with app.app_context(): db.create_all()

google = oauth.register(
    name='google', client_id=os.getenv("CLIENT_ID"), client_secret=os.getenv("CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@app.route("/login")
def login(): return google.authorize_redirect(url_for('authorize', _external=True))

@app.route('/authorize')
def authorize():
    token = google.authorize_access_token()
    user_info = token.get('userinfo')
    user = User.query.filter_by(email=user_info['email']).first()
    if not user:
        user = User(email=user_info['email'])
        db.session.add(user)
        db.session.commit()
    session['user_id'] = user.id
    session['user_email'] = user.email
    session.permanent = True
    return """<html><body><h2 style="font-family:sans-serif; text-align:center; margin-top:50px;">Logged in successfully! ✅ <br><br> You can close this tab and return to your Dashboard.</h2><script>setTimeout(() => window.close(), 2500);</script></body></html>"""

@app.route('/api/me') 
def get_me():
    if 'user_id' in session: return jsonify({'email': session['user_email']})
    return jsonify({"error": "Not logged in"}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200

@app.route('/api/sync', methods=['POST'])
def sync_notes():
    if 'user_id' not in session: return jsonify({"error": "Login required"}), 401
    user_id = session['user_id']
    for note in request.json:
        local_id = str(note.get('id'))
        existing = Note.query.join(Website).filter(Website.user_id == user_id, Note.local_id == local_id).first()
        if existing: continue
        site = Website.query.filter_by(url=note['url'], user_id=user_id).first()
        if not site:
            site = Website(url=note['url'], domain=note.get('domain', urlparse(note['url']).netloc), user_id=user_id)
            db.session.add(site)
            db.session.commit()
        db.session.add(Note(local_id=local_id, title=note.get('title', 'Untitled'), content=note.get('content', ''), selection=note.get('selection', ''), pinned=note.get('pinned', False), website_id=site.id))
    db.session.commit()
    return jsonify({"message": "Sync complete"}), 200

@app.route('/api/notes', methods=['GET'])
def get_notes():
    if 'user_id' not in session: return jsonify([]), 401
    user_id = session['user_id']
    websites = Website.query.filter_by(user_id=user_id).all()
    result = []
    for s in websites:
        result.append({
            "domain": s.domain, "url": s.url,
            "notes": [{"id": n.local_id, "title": n.title, "content": n.content, "selection": n.selection, "pinned": n.pinned} for n in s.notes]
        })
    return jsonify(result)

@app.route('/api/notes/<string:local_id>', methods=['PUT'])
def update_note(local_id):
    if 'user_id' not in session: return jsonify({"error": "Login required"}), 401
    note = Note.query.join(Website).filter(Website.user_id == session['user_id'], Note.local_id == local_id).first()
    if note:
        note.title = request.json.get('title', note.title)
        note.content = request.json.get('content', note.content)
        note.pinned = request.json.get('pinned', note.pinned)
        db.session.commit()
        return jsonify({"message": "Updated"})
    return jsonify({"error": "Unauthorized"}), 403

@app.route('/api/notes/<string:local_id>', methods=['DELETE'])
def delete_note(local_id):
    if 'user_id' not in session: return jsonify({"error": "Login required"}), 401
    note = Note.query.join(Website).filter(Website.user_id == session['user_id'], Note.local_id == local_id).first()
    if note:
        db.session.delete(note)
        db.session.commit()
        return '', 204
    return jsonify({"error": "Unauthorized"}), 403

if __name__ == '__main__': app.run(debug=True, port=5000)