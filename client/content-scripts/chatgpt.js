console.log("[LLM Memory] content script loaded on ChatGPT");

let isSendingWithContext = false;

function getEditor() {
  return document.querySelector("#prompt-textarea");
}

function getSendButton() {
  return document.querySelector('button[data-testid="send-button"]');
}

function handleIntercept(e) {
  if (isSendingWithContext) return; // Allow programmatic send
  
  const editor = getEditor();
  if (!editor) return;
  
  const text = editor.innerText.trim();
  if (!text) return;

  // Intercept the event!
  e.preventDefault();
  e.stopImmediatePropagation();

  console.log("[LLM Memory] Intercepted prompt. Fetching context...");
  
  // Dim editor temporarily to show we are loading
  editor.style.opacity = "0.5";

  chrome.runtime.sendMessage({ type: "RETRIEVE_CONTEXT", text: text }, (response) => {
    editor.style.opacity = "1";
    
    let textToInsert = "";
    if (response && response.context) {
      console.log("[LLM Memory] Context found! Injecting...");
      textToInsert = `\n\n--- Memory Context ---\n${response.context}`;
    } else {
      console.log("[LLM Memory] No context found.");
    }
    
    // Inject into React contenteditable safely
    editor.focus();
    // Move cursor to the end
    const selection = window.getSelection();
    selection.selectAllChildren(editor);
    selection.collapseToEnd();
    
    if (textToInsert) {
      document.execCommand('insertText', false, textToInsert);
    }
    
    // Trigger real send
    isSendingWithContext = true;
    setTimeout(() => {
      const sendBtn = getSendButton();
      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
      } else {
        // Fallback: dispatch Enter key
        const enterEvent = new KeyboardEvent('keydown', {
          bubbles: true, cancelable: true, key: 'Enter', code: 'Enter'
        });
        editor.dispatchEvent(enterEvent);
      }
      
      // Reset flag after a short delay
      setTimeout(() => { isSendingWithContext = false; }, 500);
      
      // Start waiting for the response to finish generating
      waitForResponseAndSave();
    }, 100);
  });
}

// Intercept Enter key
document.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  if (e.key === "Enter" && !e.shiftKey && active && active.id === "prompt-textarea") {
    handleIntercept(e);
  }
}, true); // useCapture to catch it before React

// Intercept click on Send button
document.addEventListener("click", (e) => {
  const button = e.target.closest('button[data-testid="send-button"]');
  if (button && !isSendingWithContext) {
    handleIntercept(e);
  }
}, true);

// Saving logic
function waitForResponseAndSave() {
  console.log("[LLM Memory] Waiting for response to finish...");
  
  const observer = new MutationObserver((mutations, obs) => {
    // Check if the "Send" button is re-enabled, meaning generation stopped
    const sendBtn = getSendButton();
    if (sendBtn && !sendBtn.disabled) {
      obs.disconnect(); // Stop observing
      saveLastInteraction();
    }
  });
  
  // Start observing the body for changes
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
}

function saveLastInteraction() {
  console.log("[LLM Memory] Extracting conversation to save...");
  
  // Extract user messages
  const userMessages = document.querySelectorAll('[data-message-author-role="user"]');
  const aiMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
  
  if (userMessages.length === 0 || aiMessages.length === 0) return;
  
  const lastUserMsg = userMessages[userMessages.length - 1].innerText.trim();
  const lastAiMsg = aiMessages[aiMessages.length - 1].innerText.trim();
  
  // Remove the injected context from the user message before saving so it doesn't duplicate in memory
  const cleanUserMsg = lastUserMsg.split("--- Memory Context ---")[0].trim();
  
  console.log("[LLM Memory] Saving interaction...");
  
  chrome.runtime.sendMessage({
    type: "SAVE_CONTEXT",
    user_text: cleanUserMsg,
    ai_text: lastAiMsg
  });
}
