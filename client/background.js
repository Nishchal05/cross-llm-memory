// Background service worker.
// This will eventually handle communication with your FastAPI backend
// (since content scripts have CORS restrictions, the background script
// or the backend needs to allow requests properly).

chrome.runtime.onInstalled.addListener(() => {
  console.log("[LLM Memory] Extension installed");
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RETRIEVE_CONTEXT") {
    console.log("[LLM Memory] Background retrieving context for:", message.text);
    fetch("http://localhost:5000/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.text })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => {
      console.error("[LLM Memory] Retrieval error:", err);
      sendResponse({ context: "" });
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === "SAVE_CONTEXT") {
    console.log("[LLM Memory] Background saving context");
    fetch("http://localhost:5000/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_text: message.user_text, ai_text: message.ai_text })
    })
    .then(r => r.json())
    .then(data => sendResponse(data))
    .catch(err => {
      console.error("[LLM Memory] Save error:", err);
      sendResponse({ status: "error" });
    });
    return true; // Keep message channel open for async response
  }
});
