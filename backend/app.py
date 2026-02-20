from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from urllib.parse import urlparse
from authlib.integrations.flask_client import OAuth
from flask_cors import CORS
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "prod_secret_123")

# DB Config
uri = os.getenv("DATABASE_URL", "sqlite:///local.db")
if uri.startswith("postgres://"):
    uri = uri.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = uri
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# CORS is critical for the extension to talk to the server
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

db = SQLAlchemy(app)
oauth = OAuth(app)

# --- Models ---
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
    content = db.Column(db.Text, nullable=False)
    selection = db.Column(db.Text) 
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)

with app.app_context():
    db.create_all()

# --- Auth ---
google = oauth.register(
    name='google',
    client_id=os.getenv("CLIENT_ID"),
    client_secret=os.getenv("CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)

@app.route("/login")
def login():
    redirect_uri = url_for('authorize', _external=True)
    return google.authorize_redirect(redirect_uri)

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
    session.permanent = True # Keep session alive
    return redirect("/dashboard")

@app.route('/api/me') # Renamed from /user_info to fix 404
def get_me():
    if 'user_id' in session:
        return jsonify({'email': session['user_email'], 'id': session['user_id']})
    return jsonify({"error": "Not logged in"}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect("/")

# --- API ---
@app.route('/api/notes', methods=['POST'])
def add_note():
    if 'user_id' not in session: return jsonify({"error": "Login required"}), 401
    data = request.json
    user_id = session['user_id']
    
    site = Website.query.filter_by(url=data['url'], user_id=user_id).first()
    if not site:
        site = Website(url=data['url'], domain=urlparse(data['url']).netloc, user_id=user_id)
        db.session.add(site)
        db.session.commit()
    
    new_note = Note(content=data['content'], selection=data.get('selection'), website_id=site.id)
    db.session.add(new_note)
    db.session.commit()
    # Return the real ID so the extension can update its local storage
    return jsonify({"message": "Saved", "id": new_note.id}), 201

@app.route('/api/notes', methods=['GET'])
def get_notes():
    if 'user_id' not in session: return jsonify([]), 401
    user_id = session['user_id']
    websites = Website.query.filter_by(user_id=user_id).all()
    result = []
    for s in websites:
        result.append({
            "domain": s.domain,
            "url": s.url,
            "notes": [{"id": n.id, "content": n.content, "selection": n.selection} for n in s.notes]
        })
    return jsonify(result)

@app.route('/api/notes/<int:id>', methods=['PUT'])
def update_note(id):
    if 'user_id' not in session: return jsonify({"error": "Login required"}), 401
    note = db.session.get(Note, id)
    if note and note.website.user_id == session['user_id']:
        note.content = request.json.get('content', note.content)
        db.session.commit()
        return jsonify({"message": "Updated"})
    return jsonify({"error": "Unauthorized"}), 403

@app.route('/api/notes/<int:id>', methods=['DELETE'])
def delete_note(id):
    if 'user_id' not in session: return jsonify({"error": "Login required"}), 401
    note = db.session.get(Note, id)
    if note and note.website.user_id == session['user_id']:
        db.session.delete(note)
        db.session.commit()
        return '', 204
    return jsonify({"error": "Unauthorized"}), 403

@app.route('/dashboard')
def server_dashboard():
    return render_template("dashboard.html")

if __name__ == '__main__':
    app.run(debug=True, port=5000)