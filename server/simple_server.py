"""
Minimal FastAPI server to receive your exact JS payload:
  { role: "user", content: message.text }

Run:
  pip install fastapi uvicorn --break-system-packages
  uvicorn simple_server:app --reload --port 5000

Then trigger your extension and watch this terminal for the printed message.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



import uuid
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

class RetrieveRequest(BaseModel):
    text: str

class SaveRequest(BaseModel):
    user_text: str
    ai_text: str

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-mpnet-base-v2")

# Initialize ChromaDB
vectorstore = Chroma(
    collection_name="memory_collection",
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)

@app.post("/retrieve")
def retrieve_context(req: RetrieveRequest):
    print(f"\n[RAG] Searching context for -> {req.text}")
    # Perform similarity search
    results = vectorstore.similarity_search(req.text, k=2)
    if not results:
        print("[RAG] No context found.")
        return {"context": ""}
    
    # Combine results into a single context string
    context = "\n\n".join([res.page_content for res in results])
    print(f"[RAG] Found context:\n{context}")
    return {"context": context}

@app.post("/save")
def save_context(req: SaveRequest):
    print(f"\n[RAG] Saving new conversation to memory...")
    # Format the conversation
    content = f"User: {req.user_text}\nAI: {req.ai_text}"
    
    # Add to ChromaDB
    doc = Document(page_content=content, metadata={"source": "chatgpt"})
    vectorstore.add_documents([doc], ids=[str(uuid.uuid4())])
    print(f"[RAG] Successfully saved conversation.")
    
    return {"status": "ok"}