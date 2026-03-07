# ai_agent.py
from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_ai_answer(question, context_notes):
    notes_text = "\n".join([f"- {n['title']}: {n['content']}" for n in context_notes])
    prompt = f"Use these notes as context to answer the question: {question}\n\nNotes:\n{notes_text}"
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    return response.text

def get_ai_summary(content):
    prompt = f"Summarize this text concisely, highlighting key research points:\n{content}"
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    return response.text