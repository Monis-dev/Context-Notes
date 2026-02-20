from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from urllib.parse import urlparse
from authlib.integrations.flask_client import OAuth
from flask_cors import CORS
from dotenv import load_dotenv
import os

app = Flask(__name__)
load_dotenv()
app.secret_key = "super_secret_key" 
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sync.db'
app.config['SQALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, supports_credentials=True)

db = SQLAlchemy(app)
oauth = OAuth(app)

google = oauth.register(
    name='google',
    client_id=os.getenv("CLIENT_ID"),
    client_secret=os.getenv("CLIENT_SECRET"),
    access_token_url="https://accounts.google.com/o/oauth2/token",
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    client_kwargs={'scope': 'email profile'}
)

class UserSync(db.Model):
    email = db.Column(db.String(120), primary_key=True)
    sync_data = db.Column(db.TEXT)

with app.app_context():
    db.create_all()

@app.route("/login")
def login():
    redirect_uri = url_for('authorize', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/authorize')
def authorize():
    token = google.authorize_access_token()
    user_info = google.get('userinfo').json()
    session['user_email'] = user_info['email']
    return redirect(url_for('server_dashboard', _external=True))

@app.route('/logout')
def logout():
    session.pop("user_email", None)
    return redirect("/")

@app.route('/user_info')
def user_info():
    if 'user_email'in session:
        return jsonify({'email': session['user_email']})
    return jsonify({"error": "Not logged in"}), 401

@app.route('/sync', methods=["POST"])
def push_data():
    if 'user_email' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    email = session['user_email']
    
    data = request.json.get('data') 
    
    user = db.session.get(UserSync, email)
    if not user:
        user = UserSync(email=email, sync_data=data)
        db.session.add(user)
    else:
        user.sync_data = data
    db.session.commit()
    return jsonify({"message": "Synced"}), 200

@app.route("/sync", methods=["GET"])
def pull_data():
    if 'user_email' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    email = session['user_email']
    user = db.session.get(UserSync, email)
    if user and user.sync_data:
        return jsonify({"data": user.sync_data}), 200
    return jsonify({"data": []}), 200

@app.route('/dashboard')
def server_dashborad():
    return render_template("dashboard.html")

if __name__ == '__main__':
    app.run(debug=True, port=5000)