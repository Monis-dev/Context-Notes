from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from urllib.parse import urlparse

app = Flask(__name__)
bcrypt = Bcrypt(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///notes.db'
db = SQLAlchemy(app)

class Website(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), unique=True, nullable=False)
    domain = db.Column(db.String(200))
    notes = db.relationship('Note', backref='site', lazy=True, cascade="all, delete-orphan")

class Note(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text)
    text_selection = db.Column(db.Text)
    website_id = db.Column(db.Integer, db.ForeignKey('website.id'), nullable=False)

with app.app_context():
    db.create_all()

@app.route('/notes', methods=['POST'])
def add_note():
    data = request.json
    url = data['url']
    site = Website.query.filter_by(url=url).first()
    if not site:
        domain = urlparse(url).netloc
        site = Website(url=url, domain=domain)
        db.session.add(site)
        db.session.commit()
    new_note = Note(
        content=data['content'],
        text_selection=data.get('text_selection'),
        website_id=site.id
    )
    db.session.add(new_note)
    db.session.commit()
    return jsonify({"message": "Saved!"}), 201

@app.route('/notes', methods=['GET'])
def get_notes():
    url = request.args.get('url')
    site = Website.query.filter_by(url=url).first()
    if not site:
        return jsonify([])
    return jsonify([{
        "id": n.id, 
        "content": n.content, 
        "selection": n.text_selection
    } for n in site.notes])

@app.route('/notes/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    note = db.session.get(Note, note_id) 
    if note:
        db.session.delete(note)
        db.session.commit()
        return jsonify({"message": "Deleted"}), 200
    return jsonify({"error": "Note not found"}), 404

@app.route("/dashboard", methods=["GET"])
def dashboard():
    websites = Website.query.all()
    return render_template("dashboard.html", websites=websites)

@app.route("/notes/<int:note_id>", methods=["PUT"])
def update_note(note_id):
    note = db.seesion.get(Note, note_id)
    if not note:
        return jsonify({"error": "Note not found"}), 404

    data = request.json
    note.content = data.get("content")
    db.session.commit()
    return jsonify({"message": "Update Sucessfully"}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)