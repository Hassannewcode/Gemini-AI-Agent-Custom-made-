/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Content, Part, Type, GenerateContentParameters } from "@google/genai";
import { marked } from "https://esm.sh/marked@12.0.2";
import JSZip from 'jszip';
import saveAs from 'file-saver';


// Make Prism available in the global scope for TypeScript
declare const Prism: any;
// Make Babel available in the global scope
declare const Babel: any;
// Make Prettier available in the global scope
declare const prettier: any;
declare const prettierPlugins: any;


const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  const chatContainer = document.getElementById('chat-messages') as HTMLElement;
  chatContainer.innerHTML = '<div class="message error-message"><div class="message-content"><p>Error: API key is missing. Please set the API_KEY environment variable.</p></div></div>';
  throw new Error("API key is missing.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- UI Elements ---
const chatContainer = document.getElementById('chat-messages') as HTMLElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const newChatButton = document.getElementById('new-chat-button') as HTMLButtonElement;
const historyList = document.getElementById('chat-history-list') as HTMLUListElement;
const searchToggle = document.getElementById('search-toggle') as HTMLInputElement;
const codingToggle = document.getElementById('coding-toggle') as HTMLInputElement;
const chatHeader = document.querySelector('.chat-header') as HTMLElement;
const chatTitle = document.getElementById('chat-title') as HTMLElement;
const cloudBrowserPreview = document.getElementById('cloud-browser-preview') as HTMLElement;

// Clear History Modal
const clearHistoryButton = document.getElementById('clear-history-button') as HTMLButtonElement;
const clearHistoryModal = document.getElementById('clear-history-modal') as HTMLElement;
const cancelClearButton = document.getElementById('cancel-clear-button') as HTMLButtonElement;
const confirmClearButton = document.getElementById('confirm-clear-button') as HTMLButtonElement;
const confirmClearInput = document.getElementById('confirm-clear-input') as HTMLInputElement;

// Generic Confirmation Modal
const confirmModal = document.getElementById('confirm-modal') as HTMLElement;
const confirmModalTitle = document.getElementById('confirm-modal-title') as HTMLElement;
const confirmModalText = document.getElementById('confirm-modal-text') as HTMLElement;
const confirmModalCancel = document.getElementById('confirm-modal-cancel') as HTMLButtonElement;
const confirmModalConfirm = document.getElementById('confirm-modal-confirm') as HTMLButtonElement;


// Coding Sandbox
const sandboxContainer = document.getElementById('coding-sandbox-container') as HTMLElement;
const sandboxTabs = document.getElementById('sandbox-tabs') as HTMLElement;
const addFileButton = document.getElementById('add-file-button') as HTMLButtonElement;
const sandboxEditorWrapper = document.querySelector('.sandbox-editor-wrapper') as HTMLElement;
const sandboxCodePre = document.getElementById('sandbox-code-pre') as HTMLElement;
const sandboxCodeHighlight = document.getElementById('sandbox-code-highlight') as HTMLElement;
const sandboxCodeEditor = document.getElementById('sandbox-code-editor') as HTMLTextAreaElement;
const sandboxPreviewPanel = document.querySelector('.sandbox-preview-panel') as HTMLElement;
const sandboxPreviewTitle = document.getElementById('sandbox-preview-title') as HTMLElement;
const sandboxPreviewIframe = document.getElementById('sandbox-preview-iframe') as HTMLIFrameElement;
const sandboxConsoleOutput = document.getElementById('console-output') as HTMLElement;
const runCodeButton = document.getElementById('run-code-button') as HTMLButtonElement;
const closeSandboxButton = document.getElementById('close-sandbox-button') as HTMLButtonElement;
const sandboxResizer = document.getElementById('sandbox-resizer') as HTMLElement;
const fullscreenButton = document.getElementById('fullscreen-button') as HTMLButtonElement;
const sandboxContextMenu = document.getElementById('sandbox-context-menu') as HTMLElement;
const contextRename = document.getElementById('context-rename') as HTMLLIElement;
const contextDelete = document.getElementById('context-delete') as HTMLLIElement;
const saveCodeButton = document.getElementById('save-code-button') as HTMLButtonElement;
const historyCodeButton = document.getElementById('history-code-button') as HTMLButtonElement;
const formatCodeButton = document.getElementById('format-code-button') as HTMLButtonElement;
const downloadCodeButton = document.getElementById('download-code-button') as HTMLButtonElement;

// File History Modal
const fileHistoryModal = document.getElementById('file-history-modal') as HTMLElement;
const fileHistoryTitle = document.getElementById('file-history-title') as HTMLElement;
const historyVersionList = document.getElementById('history-version-list') as HTMLUListElement;
const historyCodePre = document.getElementById('history-code-pre') as HTMLElement;
const historyCodeHighlight = document.getElementById('history-code-highlight') as HTMLElement;
const closeHistoryButton = document.getElementById('close-history-button') as HTMLButtonElement;
const restoreHistoryButton = document.getElementById('restore-history-button') as HTMLButtonElement;


// Message Context Menu
const messageContextMenu = document.getElementById('message-context-menu') as HTMLElement;
const messageContextCopy = document.getElementById('message-context-copy') as HTMLLIElement;
const messageContextCopyRaw = document.getElementById('message-context-copy-raw') as HTMLLIElement;
const messageContextRetry = document.getElementById('message-context-retry') as HTMLLIElement;

// AI Action Modal
const aiActionModal = document.getElementById('ai-action-modal') as HTMLElement;
const aiActionList = document.getElementById('ai-action-list') as HTMLUListElement;
const allowAiActionButton = document.getElementById('allow-ai-action-button') as HTMLButtonElement;
const denyAiActionButton = document.getElementById('deny-ai-action-button') as HTMLButtonElement;

// Request Sandbox Modal
const requestSandboxModal = document.getElementById('request-sandbox-modal') as HTMLElement;
const cancelSandboxRequestButton = document.getElementById('cancel-sandbox-request-button') as HTMLButtonElement;
const confirmSandboxRequestButton = document.getElementById('confirm-sandbox-request-button') as HTMLButtonElement;


// Settings Modal
const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const closeSettingsButton = document.getElementById('close-settings-button') as HTMLButtonElement;
const themeSelector = document.getElementById('theme-selector') as HTMLSelectElement;
const temperatureSlider = document.getElementById('temperature-slider') as HTMLInputElement;
const temperatureValue = document.getElementById('temperature-value') as HTMLSpanElement;
const typingSpeedSlider = document.getElementById('typing-speed-slider') as HTMLInputElement;
const typingSpeedValue = document.getElementById('typing-speed-value') as HTMLSpanElement;
const clearSandboxButton = document.getElementById('clear-sandbox-button') as HTMLButtonElement;
const exportZipButton = document.getElementById('export-zip-button') as HTMLButtonElement;


// --- Types and State ---
type AppSettings = {
    theme: 'dark' | 'light';
    temperature: number;
    typingWPM: number;
    isSandboxOpen: boolean;
};
type FileHistoryEntry = {
    timestamp: number;
    content: string;
};
type SandboxFile = {
    id: string;
    name: string;
    content: string;
    history: FileHistoryEntry[];
};
type SandboxState = {
    activeFileId: string | null;
    files: Record<string, SandboxFile>;
    previewFile: string;
};
type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  history: Content[];
  sandboxState: SandboxState;
};
type AIFileAction = {
    action_type: 'create_file' | 'update_file' | 'delete_file';
    file_name: string;
    content?: string;
};
type AIWidget = {
    name: string;
    html: string;
    css: string;
    javascript: string;
    height?: number;
};
type AIResponse = {
    displayText: string;
    actions?: AIFileAction[];
    widget?: AIWidget;
};

let allChats: Record<string, ChatSession> = {};
let currentChatId: string | null = null;
let appSettings: AppSettings = { theme: 'dark', temperature: 0.5, typingWPM: 800, isSandboxOpen: false };
const CONFIRMATION_PHRASE = "Clear all of my chat history";
let pendingAIActions: AIFileAction[] | null = null;
let contextMenuFileId: string | null = null;
let contextMenuMessageElement: HTMLElement | null = null;
let originalUserMessageForSandboxRequest: string | null = null;
let activeHistoryModal: { fileId: string; selectedTimestamp: number | null } | null = null;


let codingSandboxState: SandboxState = {
    activeFileId: null,
    files: {},
    previewFile: 'index.html'
};

const sandboxActionSchema = {
    type: Type.OBJECT,
    required: ['displayText'],
    properties: {
        displayText: {
            type: Type.STRING,
            description: "A short, helpful explanation of the changes you are making for the user. This is always required. Do NOT include any markdown code blocks in this property; all code must be in the 'actions' property."
        },
        actions: {
            type: Type.ARRAY,
            description: "An optional list of file operations for the coding sandbox.",
            items: {
                type: Type.OBJECT,
                required: ["action_type", "file_name"],
                properties: {
                    action_type: {
                        type: Type.STRING,
                        enum: ['create_file', 'update_file', 'delete_file'],
                        description: "The type of file operation."
                    },
                    file_name: {
                        type: Type.STRING,
                        description: "The name of the file to perform the action on (e.g., 'index.html', 'script.py')."
                    },
                    content: {
                        type: Type.STRING,
                        description: "The full code content of the file. Required for 'create_file' and 'update_file'."
                    }
                }
            }
        }
    }
};

const regularChatResponseSchema = {
    type: Type.OBJECT,
    required: ['displayText'],
    properties: {
        displayText: {
            type: Type.STRING,
            description: "Your text response to the user, formatted in markdown. This should explain the widget if one is provided."
        },
        request_enable_sandbox: {
            type: Type.BOOLEAN,
            description: "Set to true if you believe the user's request is best handled in the interactive coding sandbox. Omit if providing a widget."
        },
        widget: {
            type: Type.OBJECT,
            description: "An optional self-contained, interactive widget to display directly in the chat.",
            properties: {
                name: {
                    type: Type.STRING,
                    description: "A short, descriptive name for the widget (e.g., 'Calculator', 'Color Picker')."
                },
                html: {
                    type: Type.STRING,
                    description: "The HTML content for the widget's body."
                },
                css: {
                    type: Type.STRING,
                    description: "The CSS styles for the widget. Should be self-contained."
                },
                javascript: {
                    type: Type.STRING,
                    description: "The JavaScript code for the widget's functionality. Must be self-contained and should not access parent window."
                },
                height: {
                    type: Type.NUMBER,
                    description: "The suggested height of the widget container in pixels. Defaults to 300.",
                }
            }
        }
    }
};


// --- State Management and Initialization ---

function loadSettings() {
    const storedSettings = localStorage.getItem('gemini-app-settings');
    if (storedSettings) {
        appSettings = { ...appSettings, ...JSON.parse(storedSettings) };
    }
}

function saveSettings() {
    localStorage.setItem('gemini-app-settings', JSON.stringify(appSettings));
}

function loadChatsFromStorage() {
  const storedChats = localStorage.getItem('gemini-chat-history');
  if (storedChats) {
    allChats = JSON.parse(storedChats);
  }
}

function saveChatsToStorage() {
  try {
    localStorage.setItem('gemini-chat-history', JSON.stringify(allChats));
  } catch (e) {
    console.error("Failed to save chats to storage.", e);
    showToast("Could not save chat history. Storage might be full.", 'error');
  }
}

function persistSandboxStateToCurrentChat() {
    if (currentChatId && allChats[currentChatId]) {
        // Ensure sandboxState exists before assigning
        if (!allChats[currentChatId].sandboxState) {
             allChats[currentChatId].sandboxState = { activeFileId: null, files: {}, previewFile: 'index.html' };
        }
        allChats[currentChatId].sandboxState = JSON.parse(JSON.stringify(codingSandboxState));
        saveChatsToStorage();
    }
}


function initializeApp() {
  // Migration: remove old separate sandbox state if it exists
  localStorage.removeItem('gemini-sandbox-state');
  
  loadSettings();
  loadChatsFromStorage();
  applyTheme();
  renderChatHistory();

  // Set toggle state from settings before loading chat.
  codingToggle.checked = appSettings.isSandboxOpen;
  
  const latestChatId = Object.keys(allChats).sort((a, b) => allChats[b].createdAt - allChats[a].createdAt)[0];
  if (latestChatId) {
    loadChat(latestChatId);
  } else {
    startNewChat();
  }
  
  setupEventListeners();
  setupSandboxListeners();
  
  // Now, based on the checked state, initialize the UI.
  if (codingToggle.checked) {
      // This will show the container and render the files.
      initializeCodingSandbox();
  } else {
      sandboxContainer.style.display = 'none';
  }
}

// --- Chat Operations ---

function startNewChat() {
  const newId = `chat_${Date.now()}`;
  const newChat: ChatSession = {
    id: newId,
    title: 'New Chat',
    createdAt: Date.now(),
    history: [],
    sandboxState: {
        activeFileId: null,
        files: {},
        previewFile: 'index.html'
    }
  };
  allChats[newId] = newChat;
  saveChatsToStorage();
  renderChatHistory();
  loadChat(newId);
}

function loadChat(id: string) {
  if (!allChats[id]) return;
  currentChatId = id;
  const chat = allChats[id];
  
  // --- SANDBOX STATE MIGRATION & LOADING ---
  if (!chat.sandboxState) {
      chat.sandboxState = { activeFileId: null, files: {}, previewFile: 'index.html' };
  }
  // Backward compatibility for file history
  Object.values(chat.sandboxState.files).forEach(file => {
      if (!Array.isArray(file.history)) {
          file.history = file.content ? [{ timestamp: Date.now(), content: file.content }] : [];
      }
  });

  // Use a deep copy to prevent mutation issues
  codingSandboxState = JSON.parse(JSON.stringify(chat.sandboxState));
  renderSandboxTabs();
  // Ensure the UI reflects the loaded state correctly
  if (codingSandboxState.activeFileId && codingSandboxState.files[codingSandboxState.activeFileId]) {
      switchActiveSandboxFile(codingSandboxState.activeFileId);
  } else {
      const firstFileId = Object.keys(codingSandboxState.files)[0] || null;
      switchActiveSandboxFile(firstFileId);
  }
  updateSandboxPreview();

  chatContainer.innerHTML = '';
  cloudBrowserPreview.style.display = 'none';
  
  // Reset toggles to a neutral state, will be updated by history or user
  // The global app setting for sandbox visibility will be handled by initializeApp
  if (!appSettings.isSandboxOpen) {
      codingToggle.checked = false;
  }
  searchToggle.checked = false;


  if (chat.history.length === 0) {
    appendMessage('ai', { displayText: 'Hello! I\'m Gemini. How can I assist you today?'});
  } else {
     chat.history.forEach((item, index) => {
        const role = item.role === 'user' ? 'user' : 'ai';
        let content: AIResponse;
        try {
            const textContent = (item.parts[0] as {text: string}).text;
            if (role === 'ai') {
                const parsed = JSON.parse(textContent);
                // Handle both old and new formats
                content = typeof parsed === 'object' && parsed.displayText !== undefined ? parsed : { displayText: textContent };
            } else {
                content = { displayText: textContent };
            }
        } catch (e) {
            // Gracefully handle old message formats or errors
            const rawText = (item.parts[0] as {text: string}).text || '';
            content = { displayText: rawText };
        }
        const messageElement = appendMessage(role, content);
        messageElement.dataset.historyIndex = String(index);
    });
  }
  
  chatTitle.textContent = chat.title;
  updateActiveHistoryItem();
  setFormState(true);
}

function deleteChat(id: string) {
    showConfirmationModal(
        'Delete Chat?',
        `Are you sure you want to permanently delete the chat titled "${allChats[id].title}"?`,
        () => {
            if (!allChats[id]) return;
            delete allChats[id];
            saveChatsToStorage();
            renderChatHistory();
            if (currentChatId === id) {
                const latestChatId = Object.keys(allChats).sort((a, b) => allChats[b].createdAt - allChats[a].createdAt)[0];
                if (latestChatId) {
                    loadChat(latestChatId);
                } else {
                    startNewChat();
                }
            }
        }
    );
}

function renameChat(id: string, newTitle: string) {
    if (!allChats[id] || !newTitle.trim()) return;
    allChats[id].title = newTitle.trim();
    saveChatsToStorage();
    renderChatHistory();
    if (id === currentChatId) {
        chatTitle.textContent = newTitle.trim();
    }
}

function performClearAllHistory() {
    allChats = {};
    saveChatsToStorage();
    renderChatHistory();
    startNewChat();
}

async function generateChatTitle(userPrompt: string, aiResponse: string) {
    if (!currentChatId || allChats[currentChatId].history.length > 2) return;
    try {
        const prompt = `Based on this conversation:\n\nUser: "${userPrompt}"\nAI: "${aiResponse}"\n\nGenerate a very short, concise title for this chat (5 words max).`;
        const result = await ai.models.generateContent({model: 'gemini-2.5-flash', contents: prompt });
        const newTitle = result.text.replace(/"/g, '').trim();
        if (newTitle && currentChatId) {
            renameChat(currentChatId, newTitle);
        }
    } catch (e) {
        console.warn("Could not generate chat title.", e);
    }
}


// --- UI Rendering ---

function renderChatHistory() {
  historyList.innerHTML = '';
  Object.values(allChats)
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(chat => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.dataset.id = chat.id;
      li.title = chat.title;
      li.innerHTML = `
        <span>${chat.title}</span>
        <button class="delete-chat-button" aria-label="Delete chat" title="Delete chat"><i class="fa-solid fa-trash-can"></i></button>
      `;
      historyList.appendChild(li);
    });
  updateActiveHistoryItem();
}

function updateActiveHistoryItem() {
  document.querySelectorAll('.history-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-id') === currentChatId);
  });
}

function appendMessage(sender: 'user' | 'ai', content: AIResponse, animate: boolean = false): HTMLElement {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender}-message`;
  const avatarSrc = sender === 'user'
    ? 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeD0iMyIgeT0iMyIgcng9IjEwMCIvPjxwYXRoIGQ9Ik0xOCAxN2ExMi44IDEyLjggMCAwIDAtMTIgMCIvPjwvc3ZnPg=='
    : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI0IDRDMTIuOTU0MyA0IDQgMTIuOTU0MyA0IDI0QzQgMzUuMDQ1NyAxMi45NTQzIDQ0IDI0IDQ0QzM1LjA0NTcgNDQgNDQgMzUuMDQ1NyA0NCAyNEM0NCAxMi45NTQzIDM1LjA0NTcgNCAyNCA0WiIgZmlsbD0iIzhBQjRGOCIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTI0LjAwMDEgMTJDMjguMjgxOCAxMiAzMi4xMzg0IDEzLjc5MjQgMzQuODE2OCAxNi41ODE2QzMzLjU2MTMgMTguNzA5IDMyLjM5MjYgMjAuOTEwMyAzMS4zMTA2IDIzLjE4NTNDMzAuOTgzOSAyMy45MDA5IDMxLjA1NDYgMjQuNzMzMSAzMS41MjIyIDI1LjM5OThDMzIuOTU4NyAyNy4yNDcxIDM0LjkwODQgMjkuMjE1MiAzNy4zNzMyIDMxLjI5MzNDMzUuNzk3OSAzMy4zMjU5IDMzLjcyNTkgMzQuOTA1NiAzMS4yODQxIDM1LjgwMUMyOS4wNzE1IDM2LjYxMTYgMjYuNjU3NSAzNi41MjYyIDI0LjU3MTQgMzUuNTY4M0MyMC42NzEgMzMuODAxNiAxNy44MDg1IDMwLjE0MTMgMTcuMzg4MiAyNS44MzQ0QzE2Ljk2NzggMjEuNTI3NSAxOS4wNjg5IDE3LjQzMzMgMjIuODQyNyAxNS4zNTI0QzI0Ljg5MTYgMTQuMjg4MiAyNy4yNDU4IDE0LjE2MjMgMjkuNDE4NCAxNC55NDU4QzI4LjUzNjEgMTQuMTI4NyAyNy42NzQ5IDEzLjM4NTcgMjYuODM0NyAxMi43MTY4QzI1Ljk2ODYgMTIuMjQ3MSAyNC45OTk2IDEyIDI0LjAwMDEgMTJaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTE2LjU4MTYgMzQuODE2OEMxOC43MDkgMzMuNTYxMyAyMC45MTAzIDMyLjM5MjYgMjMuMTg1MyAzMS4zMTA2QzIzLjkwMDkgMzAuOTgzOSAyNC43MzMxIDMxLjA1NDYgMjUuMzk5OCAzMS41MjIyQzI3LjI0NzEgMzIuOTU4NyAyOS4yMTUyIDM0LjkwODQgMzEuMjkzMyAzNy4zNzMyQzMzLjMyNTkgMzUuNzk3OSAzNC45MDU2IDMzLjcyNTkgMzUuODAxIDMxLjI4NDFDMzYuNjExNiAyOS4wNzE1IDM2LjUyNjIgMjYuNjU3NSAzNS41NjgzIDI0LjU3MTRDMzMuODAxNiAyMC42NzEgMzAuMTQxMyAxNy44MDg1IDI1LjgzNDQgMTcuMzg4MkMyMS41Mjc1IDE2Ljk2NzggMTcuNDMzMyAxOS4wNjg5IDE1LjM1MjQgMjIuODQyN0MxNC4yODgyIDI0Ljg5MTYgMTQuMTYyMyAyNy4yNDU4IDE0Ljk0NTggMjkuNDE4NEMxNC4xMjg3IDI4LjUzNjEgMTMuMzg1NyAyNy42NzQ5IDEyLjcxNjggMjYuODM0N0MxMi4yNDcxIDI1Ljk2ODYgMTIgMjQuOTk5NiAxMiAyNC4wMDAxQzEyIDI4LjI4MTggMTMuNzkyNCAzMi4xMzg0IDE2LjU4MTYgMzQuODE2OFoiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=';
  
  messageElement.innerHTML = `
      <img src="${avatarSrc}" alt="${sender} Avatar" class="avatar">
      <div class="message-content">
      </div>
  `;
  
  const contentDiv = messageElement.querySelector('.message-content') as HTMLElement;
  
  if (sender === 'ai' && content.widget) {
    renderWidgetInMessage(contentDiv, content.widget, content.displayText);
  } else if (animate) {
      animateAiResponse(messageElement, content.displayText || '');
  } else {
      const textHtml = marked.parse(content.displayText || '') as string;
      contentDiv.innerHTML = textHtml;
      if (sender === 'ai' && content.displayText) {
          Prism.highlightAllUnder(contentDiv);
      }
  }

  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return messageElement;
}


function renderCloudBrowserPreview(state: 'searching' | 'results', data?: any) {
    if (state === 'searching') {
        cloudBrowserPreview.style.display = 'block';
        cloudBrowserPreview.innerHTML = `
            <h4><i class="fa-solid fa-cloud"></i> Cloud Browser</h4>
            <div class="cloud-browser-content">
                <p>Searching the web for: "<em>${data}</em>"</p>
                <div class="thinking-indicator small"><span></span><span></span><span></span></div>
            </div>
        `;
    } else if (state === 'results' && data && data.length > 0) {
        const sourcesList = data.map((chunk: any) => `
            <li class="source-item">
                <a href="${chunk.web.uri}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-link"></i>
                    ${chunk.web.title || new URL(chunk.web.uri).hostname}
                </a>
            </li>
        `).join('');
        cloudBrowserPreview.innerHTML = `
            <h4><i class="fa-solid fa-cloud-arrow-down"></i> Cloud Browser Results</h4>
            <div class="cloud-browser-content">
                <p>Used the following sources to generate the answer:</p>
                <ul class="sources-list">${sourcesList}</ul>
            </div>
        `;
    } else {
        cloudBrowserPreview.style.display = 'none';
    }
}


function setFormState(enabled: boolean) {
  chatInput.disabled = !enabled;
  sendButton.disabled = !enabled;
  sendButton.classList.toggle('loading', !enabled);
  if (enabled) chatInput.focus();
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}


// --- Main Chat Logic ---
function renderWidgetInMessage(container: HTMLElement, widget: AIWidget, displayText: string) {
    // Clear any previous content (like thinking indicator)
    container.innerHTML = marked.parse(displayText || 'Here is the widget you requested:') as string;
    Prism.highlightAllUnder(container);

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'widget-wrapper';

    const widgetHeader = document.createElement('div');
    widgetHeader.className = 'widget-header';
    widgetHeader.innerHTML = `<i class="fa-solid fa-puzzle-piece"></i><span>${widget.name || 'Interactive Widget'}</span>`;

    const iframe = document.createElement('iframe');
    iframe.className = 'widget-iframe';
    iframe.sandbox.add('allow-scripts', 'allow-modals');
    iframe.title = widget.name || 'Interactive Widget';
    const widgetHeight = widget.height && widget.height > 50 ? widget.height : 300;
    iframe.style.height = `${widgetHeight}px`;

    const iframeBg = appSettings.theme === 'light' ? '#ffffff' : '#1e1e1e';
    const iframeFg = appSettings.theme === 'light' ? '#202124' : '#e8eaed';

    const srcDoc = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                :root {
                    --text-color: ${iframeFg};
                    --bg-color: ${iframeBg};
                }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
                    margin: 0;
                    padding: 10px;
                    background-color: var(--bg-color);
                    color: var(--text-color);
                    box-sizing: border-box;
                }
                ${widget.css || ''}
            </style>
        </head>
        <body>
            ${widget.html || ''}
            <script>
                (function() {
                    try {
                        ${widget.javascript || ''}
                    } catch(e) {
                        console.error('Widget Error:', e);
                        const errorDiv = document.createElement('div');
                        errorDiv.style.color = 'red';
                        errorDiv.style.fontFamily = 'monospace';
                        errorDiv.textContent = 'Error: ' + e.message;
                        document.body.prepend(errorDiv);
                    }
                })();
            <\/script>
        </body>
        </html>
    `;
    iframe.srcdoc = srcDoc;
    
    widgetWrapper.appendChild(widgetHeader);
    widgetWrapper.appendChild(iframe);

    container.appendChild(widgetWrapper);
}

async function animateAiResponse(messageElement: HTMLElement, markdownText: string) {
    const contentDiv = messageElement.querySelector('.message-content') as HTMLElement;
    if (!contentDiv) return;

    const charsPerSecond = (appSettings.typingWPM * 5) / 60; // 5 chars per word on average
    const delay = 1000 / charsPerSecond;

    // Instantly render for performance if delay is too short (sub-4ms is unreliable for setTimeout)
    if (delay < 4 || appSettings.typingWPM > 3000) {
        contentDiv.innerHTML = marked.parse(markdownText) as string;
        Prism.highlightAllUnder(contentDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
    }

    let currentText = '';
    const cursorSpan = '<span class="typing-cursor"></span>';
    contentDiv.innerHTML = cursorSpan;
    
    // Use a single pre block for code to avoid re-highlighting on each character
    const codeBlockRegex = /(```[\s\S]*?```)/g;
    const parts = markdownText.split(codeBlockRegex);

    for (const part of parts) {
        if (codeBlockRegex.test(part)) {
             // It's a code block, type it out without intermediate markdown parsing
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            pre.appendChild(code);
            contentDiv.insertBefore(pre, contentDiv.querySelector('.typing-cursor'));
            currentText += part;
            
            for (const char of part) {
                code.textContent += char;
                chatContainer.scrollTop = chatContainer.scrollHeight;
                await new Promise(resolve => setTimeout(resolve, delay));
            }

        } else {
            // It's regular text, type it out and re-parse markdown
            for (const char of part) {
                currentText += char;
                // Avoid parsing every single character for performance
                if (currentText.length % 3 === 0 || ' \n\t.'.includes(char)) {
                    contentDiv.innerHTML = marked.parse(currentText) as string + cursorSpan;
                }
                chatContainer.scrollTop = chatContainer.scrollHeight;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // Final render with full content and highlighting
    contentDiv.innerHTML = marked.parse(markdownText) as string;
    Prism.highlightAllUnder(contentDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function handleSendMessage(event: Event | string) {
  if (typeof event !== 'string') {
      event.preventDefault();
  }
  
  if (!currentChatId) {
    showToast("No active chat session.", 'error');
    return;
  }
  
  const messageText = (typeof event === 'string') ? event : chatInput.value.trim();
  if (!messageText) return;

  setFormState(false);
  // Only add a new user message if it's not a re-send from the sandbox modal
  if (typeof event !== 'string' || event !== originalUserMessageForSandboxRequest) {
    const userMessageContent: Content = { role: 'user', parts: [{ text: messageText }] };
    allChats[currentChatId].history.push(userMessageContent);
    const userMessageIndex = allChats[currentChatId].history.length - 1;
    const userMessageElement = appendMessage('user', { displayText: messageText });
    userMessageElement.dataset.historyIndex = String(userMessageIndex);
  }
  chatInput.value = '';
  chatInput.style.height = 'auto';

  const aiMessageElement = appendMessage('ai', {displayText: ''});
  const aiMessageIndex = allChats[currentChatId].history.length;
  aiMessageElement.dataset.historyIndex = String(aiMessageIndex);
  
  const thinkingIndicator = document.createElement('div');
  thinkingIndicator.className = 'thinking-indicator';
  thinkingIndicator.innerHTML = '<span></span><span></span><span></span>';
  aiMessageElement.querySelector('.message-content')?.appendChild(thinkingIndicator);
  
  try {
    const useSearch = searchToggle.checked;
    const useCodingSandbox = codingToggle.checked;
    const modelConfig = { temperature: appSettings.temperature };
    let request: GenerateContentParameters;

    if (useSearch) {
        renderCloudBrowserPreview('searching', messageText);
        const systemInstruction = "You are a helpful research assistant. Your goal is to answer the user's question based on the provided search results. Summarize the information clearly and concisely.";
        request = {
            model: 'gemini-2.5-flash',
            contents: [...allChats[currentChatId].history],
            config: { systemInstruction, tools: [{ googleSearch: {} }], ...modelConfig }
        };
    } else if (useCodingSandbox) {
        const filesContext = Object.values(codingSandboxState.files)
            .map(f => `// file: ${f.name}\n${f.content}`)
            .join('\n\n---\n\n');
        
        const systemInstruction = `You are a world-class AI software engineer integrated into a professional coding environment that mirrors VS Code. You have the capability to execute and debug any programming language (client-side or server-side, e.g., Python, PHP, Node.js, TSX) in a secure, containerized backend.

**Your Task:**
1.  **Analyze the user's request** in the context of the complete project files provided.
2.  **Formulate a plan:** Think step-by-step how to fulfill the request. This might involve creating new files, updating existing ones, or deleting obsolete ones.
3.  **Generate a response:** Your response MUST be a single JSON object that strictly adheres to the provided schema.
    *   **\`displayText\`:** Provide a concise, helpful explanation of the changes you are about to make. Explain your reasoning. If you are fixing a bug, describe the root cause.
    *   **\`actions\`:** Create a list of file operations. Be precise. Only modify what is necessary. For updates, provide the FULL, complete content of the file.

**Crucial Instructions:**
*   You are NOT a simple text generator. You are a code generator and manipulator.
*   NEVER include markdown code blocks (e.g., \`\`\`js ... \`\`\`) in the \`displayText\` property. ALL code must be delivered through the \`actions\` property.
*   Analyze file extensions (.py, .php, .tsx) to understand the project's nature and apply the correct logic.
*   When the user asks to "run" or "debug" the code, explain what you did (e.g., "I executed the Python script," "I compiled and ran the React app") and what the result was (output, errors, etc.). The user's preview pane is only for web-based projects; your execution environment is universal.

**CURRENT FILES IN SANDBOX:**
${filesContext || "(No files in sandbox yet)"}`;
        
        request = {
            model: 'gemini-2.5-flash',
            contents: [...allChats[currentChatId].history],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: sandboxActionSchema,
                ...modelConfig
            }
        };
    } else { // Regular Chat
        const systemInstruction = `You are an advanced AI agent, Gemini. Your goal is to be as helpful as possible.
You have three main modes of response:
1.  **Standard Text:** Provide well-formatted text answers using markdown for general questions.
2.  **Interactive Widget:** For requests that would benefit from a small, interactive UI (like a calculator, color picker, simple game, or data visualizer), you can create a self-contained widget. To do this, populate the 'widget' property in your JSON response with the widget's name, HTML, CSS, and JavaScript. The code must be entirely self-contained. Always provide an explanation of the widget in the 'displayText' property.
3.  **Coding Sandbox:** For complex coding tasks (e.g., multi-file projects, debugging existing code, building a full webpage), suggest enabling the interactive coding sandbox by setting 'request_enable_sandbox' to true.

Your response must always be a single JSON object that strictly follows the provided schema. Do not use a widget and request the sandbox at the same time.`;
        request = {
            model: 'gemini-2.5-flash',
            contents: [...allChats[currentChatId].history],
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: regularChatResponseSchema,
                ...modelConfig
            }
        };
    }

    const response = await ai.models.generateContent(request);
    const fullResponseText = response.text;
    
    thinkingIndicator.remove();
    cloudBrowserPreview.style.display = 'none';

    let aiResponse: AIResponse;
    let parsedResponse: any;

    try {
        parsedResponse = JSON.parse(fullResponseText);
    } catch (e) {
        console.error("Failed to parse AI JSON response:", e, "\nResponse text:", fullResponseText);
        const jsonMatch = fullResponseText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                parsedResponse = JSON.parse(jsonMatch[1]);
            } catch (e2) {
                 showToast("AI returned malformed JSON.", 'error');
                 parsedResponse = { displayText: `I encountered an error formatting my response. Here's the raw text:\n\n${fullResponseText}` };
            }
        } else {
             showToast("AI returned a non-JSON response.", 'info');
             parsedResponse = { displayText: fullResponseText };
        }
    }
    
    aiResponse = {
        displayText: parsedResponse.displayText || (useSearch ? fullResponseText : '[Empty Response]'),
        actions: parsedResponse.actions,
        widget: parsedResponse.widget
    };

    const contentDiv = aiMessageElement.querySelector('.message-content') as HTMLElement;
    
    if (aiResponse.widget) {
        renderWidgetInMessage(contentDiv, aiResponse.widget, aiResponse.displayText);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } else {
        await animateAiResponse(aiMessageElement, aiResponse.displayText);
    }
    
    if (useSearch) {
        const groundingMetadata = response?.candidates?.[0]?.groundingMetadata;
        if (groundingMetadata?.groundingChunks?.length) {
            renderCloudBrowserPreview('results', groundingMetadata.groundingChunks);
        }
    } else if (useCodingSandbox) {
        if (aiResponse.actions && aiResponse.actions.length > 0) {
            showAiActionConfirmation(aiResponse.actions);
        } else {
            sandboxContainer.style.display = 'flex';
        }
    } else { // Regular Chat with potential sandbox suggestion
        if (parsedResponse.request_enable_sandbox) {
            showSandboxRequestModal(messageText);
        }
    }
    
    const aiMessageToSave = useSearch ? { displayText: fullResponseText } : parsedResponse;
    const aiMessageContent: Content = { role: 'model', parts: [{ text: JSON.stringify(aiMessageToSave) }]};
    allChats[currentChatId].history.push(aiMessageContent);
    saveChatsToStorage();

    if (allChats[currentChatId].history.length <= 2) {
      generateChatTitle(messageText, aiResponse.displayText);
    }

  } catch (error: any) {
    console.error(error);
    thinkingIndicator.remove();
    cloudBrowserPreview.style.display = 'none';
    const contentDiv = aiMessageElement.querySelector('.message-content');
    
    if (contentDiv) {
        const errorMessage = String(error.message || error);
        let userFriendlyMessage = "";
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
            userFriendlyMessage = "Rate limit reached. You've sent requests too quickly. Please wait a moment before trying again.";
        } else {
            userFriendlyMessage = `An unexpected error occurred: ${errorMessage}`;
        }
        contentDiv.innerHTML = `<p class="error-text">${userFriendlyMessage}</p>`;
        aiMessageElement.classList.add('error-message');
    }

  } finally {
    setFormState(true);
  }
}

// --- Coding Sandbox Logic ---

function findFileByName(name: string): SandboxFile | undefined {
    return Object.values(codingSandboxState.files).find(f => f.name === name);
}

async function animateTyping(element: HTMLTextAreaElement, code: string) {
    const charsPerSecond = (appSettings.typingWPM * 5) / 60;
    const delay = 1000 / charsPerSecond;

    if (delay < 4 || appSettings.typingWPM > 3000) { // Render instantly for very high speed
        element.value = code;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }

    return new Promise<void>(resolve => {
        let i = 0;
        function type() {
            if (i < code.length) {
                element.value = code.substring(0, i + 1);
                element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                i++;
                setTimeout(type, delay);
            } else {
                element.value = code; // Ensure final value is correct
                element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                resolve();
            }
        }
        type();
    });
}

async function executeAiActions() {
    if (!pendingAIActions) return;
    sandboxContainer.style.display = 'flex';
    for (const action of pendingAIActions) {
        switch (action.action_type) {
            case 'create_file': {
                if (action.file_name && action.content !== undefined) {
                    if (findFileByName(action.file_name)) {
                         await updateSandboxFile(action.file_name, action.content);
                    } else {
                        await createSandboxFile(action.file_name, action.content, true);
                    }
                }
                break;
            }
            case 'update_file': {
                if (action.file_name && action.content !== undefined) {
                    await updateSandboxFile(action.file_name, action.content);
                }
                break;
            }
            case 'delete_file': {
                if (action.file_name) {
                    const file = findFileByName(action.file_name);
                    if (file) {
                        deleteSandboxFile(file.id, true); // Skip confirmation when AI does it
                    } else {
                        console.warn(`AI tried to delete non-existent file: ${action.file_name}`);
                    }
                }
                break;
            }
        }
    }
    pendingAIActions = null;
    updateSandboxPreview();
}

async function createSandboxFile(fileName: string, content: string, fromAI = false): Promise<string> {
    const id = `file_${Date.now()}_${Math.random()}`;
    codingSandboxState.files[id] = { id, name: fileName, content: '', history: [] }; // Add empty first
    renderSandboxTabs();
    switchActiveSandboxFile(id);
    if (fromAI) {
        await animateTyping(sandboxCodeEditor, content);
    } else {
        sandboxCodeEditor.value = content;
        sandboxCodeEditor.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Create initial history snapshot
    saveFileSnapshot(id);
    persistSandboxStateToCurrentChat();
    return id;
}

async function updateSandboxFile(fileName: string, content: string) {
    const file = findFileByName(fileName);
    if (file) {
        switchActiveSandboxFile(file.id);
        await animateTyping(sandboxCodeEditor, content);
    } else {
        await createSandboxFile(fileName, content, true);
    }
}

function initializeCodingSandbox() {
    renderSandboxTabs();
    if (Object.keys(codingSandboxState.files).length > 0) {
        const fileToLoad = codingSandboxState.activeFileId && codingSandboxState.files[codingSandboxState.activeFileId]
            ? codingSandboxState.activeFileId
            : Object.keys(codingSandboxState.files)[0];
        switchActiveSandboxFile(fileToLoad);
    } else {
        switchActiveSandboxFile(null);
    }
    sandboxContainer.style.display = 'flex';
    updateSandboxPreview();
}

function renderSandboxTabs() {
    sandboxTabs.innerHTML = '';
    Object.values(codingSandboxState.files).forEach(file => {
        const tab = document.createElement('div');
        tab.className = 'sandbox-tab';
        tab.dataset.fileId = file.id;
        tab.title = file.name;
        tab.classList.toggle('active', file.id === codingSandboxState.activeFileId);
        tab.innerHTML = `<span class="tab-name">${file.name}</span>`;
        sandboxTabs.appendChild(tab);
    });
    sandboxTabs.appendChild(addFileButton);
}

function getLanguageFromFilename(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js': return 'javascript';
        case 'py': return 'python';
        case 'css': return 'css';
        case 'html': return 'markup';
        case 'ts': return 'typescript';
        case 'tsx': return 'tsx';
        case 'jsx': return 'jsx';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'rb': return 'ruby';
        case 'php': return 'php';
        case 'go': return 'go';
        case 'java': return 'java';
        case 'c': return 'c';
        case 'cpp': return 'cpp';
        case 'cs': return 'csharp';
        case 'sh': return 'bash';
        default: return 'clike';
    }
}

function switchActiveSandboxFile(fileId: string | null) {
    if (!fileId || !codingSandboxState.files[fileId]) {
        sandboxCodeEditor.value = '';
        sandboxCodeHighlight.innerHTML = '';
        codingSandboxState.activeFileId = null;
        sandboxCodeEditor.disabled = true;
    } else {
        codingSandboxState.activeFileId = fileId;
        const file = codingSandboxState.files[fileId];
        const language = getLanguageFromFilename(file.name);
        sandboxCodeEditor.disabled = false;
        sandboxCodeEditor.value = file.content;
        sandboxCodeHighlight.className = `language-${language}`;
        sandboxCodeHighlight.textContent = file.content;
        Prism.highlightElement(sandboxCodeHighlight);
    }
    persistSandboxStateToCurrentChat();
    document.querySelectorAll('.sandbox-tab').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-file-id') === fileId);
    });

    const activeTabEl = sandboxTabs.querySelector(`.sandbox-tab[data-file-id="${fileId}"]`);
    if (activeTabEl) {
        activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
}

function addSandboxFile() {
    const existingInput = sandboxTabs.querySelector('.add-file-input');
    if (existingInput) {
        (existingInput as HTMLElement).focus();
        return;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'add-file-input';
    input.placeholder = 'new-file.html';
    
    const finish = () => {
        const fileName = input.value.trim();
        if (fileName) {
            if (findFileByName(fileName)) {
                showToast("A file with this name already exists.", 'error');
            } else {
                createSandboxFile(fileName, '').then(id => {
                    switchActiveSandboxFile(id);
                    sandboxCodeEditor.focus();
                });
            }
        }
        input.remove();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') {
            input.remove();
        }
    });

    sandboxTabs.insertBefore(input, addFileButton);
    input.focus();
}

function deleteSandboxFile(fileId: string, skipConfirm = false) {
    if (!codingSandboxState.files[fileId]) return;
    const fileName = codingSandboxState.files[fileId].name;
    
    const performDelete = () => {
        delete codingSandboxState.files[fileId];
        renderSandboxTabs();
        if (codingSandboxState.activeFileId === fileId) {
            const nextFileId = Object.keys(codingSandboxState.files)[0] || null;
            switchActiveSandboxFile(nextFileId);
        }
        persistSandboxStateToCurrentChat();
        updateSandboxPreview();
    };

    if (skipConfirm) {
        performDelete();
    } else {
        showConfirmationModal(
            'Delete File?',
            `Are you sure you want to delete "${fileName}"? This cannot be undone.`,
            performDelete
        );
    }
}

function renameSandboxFile(fileId: string, oldName: string) {
    const tab = sandboxTabs.querySelector(`[data-file-id="${fileId}"] .tab-name`) as HTMLElement;
    if (!tab) return;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = oldName;
    tab.replaceWith(input);
    input.focus();
    input.select();
    
    const finishEditing = () => {
        const newName = input.value.trim();
        if (!newName || newName === oldName) {
            renderSandboxTabs(); // Restore original
            return;
        }
        if (findFileByName(newName)) {
            showToast("A file with this name already exists.", 'error');
            renderSandboxTabs(); // Restore original
            return;
        }
        codingSandboxState.files[fileId].name = newName;
        persistSandboxStateToCurrentChat();
        renderSandboxTabs();
        updateSandboxPreview();
    };

    input.addEventListener('blur', finishEditing);
    input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); });
}

async function updateSandboxPreview(targetFile: string = 'index.html') {
    sandboxConsoleOutput.innerHTML = '';
    codingSandboxState.previewFile = findFileByName(targetFile) ? targetFile : 'index.html';
    
    let html = `<div style="font-family: sans-serif; text-align: center; padding: 2rem;"><h2>404: Not Found</h2><p>Could not find <strong>${codingSandboxState.previewFile}</strong> in the sandbox.</p></div>`;
    let css = '';
    let scriptContent = '';
    
    const files = Object.values(codingSandboxState.files);
    const htmlFile = files.find(f => f.name === codingSandboxState.previewFile);
    
    if (htmlFile) {
        html = htmlFile.content;
        sandboxPreviewTitle.textContent = `Preview: ${htmlFile.name}`;
    } else {
        sandboxPreviewTitle.textContent = 'Preview: Not Found';
    }

    files.forEach(f => {
        if (f.name.endsWith('.css')) {
            css += `/*==> ${f.name} <==*/\n${f.content}\n\n`;
        } else if (/\.(js|jsx|ts|tsx)$/.test(f.name)) {
            // Wrap in IIFE to prevent scope collision
            scriptContent += `\n// File: ${f.name}\n;\n(function(){\n${f.content}\n})();\n`;
        }
    });

    let transpiledJs = '';
    if (scriptContent && typeof Babel !== 'undefined') {
        try {
            const output = Babel.transform(scriptContent, {
                presets: ['react', 'typescript'],
                filename: 'sandbox.tsx' // A dummy filename to hint Babel about JSX/TSX
            }).code;
            transpiledJs = output || '';
        } catch (e: any) {
            logToSandboxConsole('error', `Babel Transpilation Error: ${e.message}`);
            return; // Don't proceed if transpilation fails
        }
    } else if (scriptContent) {
        logToSandboxConsole('error', 'Babel is not loaded. Cannot transpile advanced scripts.');
        transpiledJs = scriptContent; // Attempt to run as-is
    }


    const injectedScripts = `
        const iframeConsole={log:(...a)=>window.parent.postMessage({type:"console",level:"log",message:a.map(b=>JSON.stringify(b,null,2)).join(" ")},"*"),error:(...a)=>window.parent.postMessage({type:"console",level:"error",message:a.map(b=>b?b.stack||JSON.stringify(b,null,2):'undefined').join(" ")},"*"),warn:(...a)=>window.parent.postMessage({type:"console",level:"warn",message:a.map(b=>JSON.stringify(b,null,2)).join(" ")},"*")};
        window.console={...window.console,...iframeConsole};
        window.addEventListener("error",e=>iframeConsole.error(e.message,'at',e.filename+':'+e.lineno));
        document.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (link && link.href) {
                const url = new URL(link.href);
                if (url.origin === window.location.origin && !link.hash) {
                    e.preventDefault();
                    const targetFile = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
                    window.parent.postMessage({type: 'sandbox_nav', file: targetFile}, '*');
                }
            }
        });
        try{${transpiledJs}}catch(e){iframeConsole.error(e)}
    `;

    const srcDoc = `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${injectedScripts}<\/script></body></html>`;
    sandboxPreviewIframe.srcdoc = srcDoc;
}

function logToSandboxConsole(level: 'log' | 'error' | 'warn', message: string) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    entry.appendChild(messageSpan);
    if (level === 'error') {
        const fixButton = document.createElement('button');
        fixButton.className = 'fix-error-button';
        fixButton.textContent = 'Fix with AI';
        fixButton.title = 'Ask AI to fix this error';
        fixButton.dataset.errorMessage = message;
        entry.appendChild(fixButton);
    }
    sandboxConsoleOutput.appendChild(entry);
    sandboxConsoleOutput.scrollTop = sandboxConsoleOutput.scrollHeight;
}


// --- Modal & Settings Logic ---
function showAiActionConfirmation(actions: AIFileAction[]) {
    pendingAIActions = actions;
    aiActionList.innerHTML = actions.map(action => {
        const tagClass = action.action_type.split('_')[0];
        return `<li class="ai-action-item">
            <span class="ai-action-tag ${tagClass}">${tagClass.toUpperCase()}</span>
            <span>${action.file_name}</span>
        </li>`;
    }).join('');
    aiActionModal.style.display = 'flex';
}

function hideAiActionConfirmation() {
    aiActionModal.style.display = 'none';
    pendingAIActions = null;
}

function showSandboxRequestModal(originalUserMessage: string) {
    originalUserMessageForSandboxRequest = originalUserMessage;
    requestSandboxModal.style.display = 'flex';
}

function hideSandboxRequestModal() {
    requestSandboxModal.style.display = 'none';
    originalUserMessageForSandboxRequest = null;
}


function showConfirmationModal(title: string, text: string, onConfirm: () => void) {
    confirmModalTitle.textContent = title;
    confirmModalText.textContent = text;
    
    let confirmHandler: () => void;
    const hide = () => {
        confirmModal.style.display = 'none';
        confirmModalConfirm.removeEventListener('click', confirmHandler);
    };
    confirmHandler = () => {
        onConfirm();
        hide();
    };
    confirmModal.style.display = 'flex';
    confirmModalConfirm.addEventListener('click', confirmHandler, { once: true });
    confirmModalCancel.addEventListener('click', hide, { once: true });
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) hide();
    }, { once: true });
}

function showClearHistoryModal() {
    confirmClearInput.value = '';
    confirmClearButton.disabled = true;
    clearHistoryModal.style.display = 'flex';
    confirmClearInput.focus();
}

function hideClearHistoryModal() {
    clearHistoryModal.style.display = 'none';
}

function showSettingsModal() {
    themeSelector.value = appSettings.theme;
    temperatureSlider.value = String(appSettings.temperature);
    temperatureValue.textContent = String(appSettings.temperature);
    typingSpeedSlider.value = String(appSettings.typingWPM);
    typingSpeedValue.textContent = String(appSettings.typingWPM);
    settingsModal.style.display = 'flex';
}

function hideSettingsModal() {
    settingsModal.style.display = 'none';
}

function applyTheme() {
    document.body.className = appSettings.theme === 'light' ? 'light-theme' : '';
    const prismLink = document.querySelector<HTMLLinkElement>('link[href*="prism"]');
    if (prismLink) {
        prismLink.href = appSettings.theme === 'light'
            ? 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css'
            : 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
    }
}

// --- Event Listeners ---
function setupSandboxListeners() {
    closeSandboxButton.addEventListener('click', () => {
        codingToggle.checked = false;
        // Trigger change event to centralize logic (hide panel, save setting)
        codingToggle.dispatchEvent(new Event('change'));
    });
    runCodeButton.addEventListener('click', () => {
        // Now, this is primarily a shortcut for asking the AI to run the code.
        const activeFile = codingSandboxState.activeFileId ? codingSandboxState.files[codingSandboxState.activeFileId] : null;
        const prompt = activeFile
            ? `Run the file "${activeFile.name}". If it's part of a larger project (like a web app), run the whole project with "${activeFile.name}" as the context.`
            : "Run the current project in the sandbox.";
        handleSendMessage(prompt);
    });
    
    addFileButton.addEventListener('click', addSandboxFile);
    fullscreenButton.addEventListener('click', () => {
        sandboxPreviewPanel.classList.toggle('fullscreen');
        fullscreenButton.querySelector('i')?.classList.toggle('fa-expand');
        fullscreenButton.querySelector('i')?.classList.toggle('fa-compress');
    });

    sandboxTabs.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tab = target.closest<HTMLElement>('.sandbox-tab');
        if (!tab || !tab.dataset.fileId) return;
        switchActiveSandboxFile(tab.dataset.fileId);
    });

    sandboxTabs.addEventListener('contextmenu', (e) => {
        const tab = (e.target as HTMLElement).closest<HTMLElement>('.sandbox-tab');
        if (!tab || !tab.dataset.fileId) return;
        e.preventDefault();
        contextMenuFileId = tab.dataset.fileId;
        sandboxContextMenu.style.display = 'block';
        sandboxContextMenu.style.left = `${e.clientX}px`;
        sandboxContextMenu.style.top = `${e.clientY}px`;
    });
    
    contextRename.addEventListener('click', () => {
        if (contextMenuFileId && codingSandboxState.files[contextMenuFileId]) {
            renameSandboxFile(contextMenuFileId, codingSandboxState.files[contextMenuFileId].name);
        }
    });

    contextDelete.addEventListener('click', () => {
        if (contextMenuFileId) deleteSandboxFile(contextMenuFileId);
    });

    document.addEventListener('click', () => {
        sandboxContextMenu.style.display = 'none';
        messageContextMenu.style.display = 'none';
        contextMenuFileId = null;
        contextMenuMessageElement = null;
    });

    sandboxCodeEditor.addEventListener('input', () => {
        if (!codingSandboxState.activeFileId) return;
        const content = sandboxCodeEditor.value;
        codingSandboxState.files[codingSandboxState.activeFileId].content = content;
        // Don't persist on every keystroke, let save button or file switch do it
        sandboxCodeHighlight.textContent = content;
        Prism.highlightElement(sandboxCodeHighlight);
    });
    
    sandboxCodeEditor.addEventListener('scroll', () => {
        sandboxCodePre.scrollTop = sandboxCodeEditor.scrollTop;
        sandboxCodePre.scrollLeft = sandboxCodeEditor.scrollLeft;
    });

    window.addEventListener('message', (e) => {
        if (e.data?.type === 'console') logToSandboxConsole(e.data.level, e.data.message);
        if (e.data?.type === 'sandbox_nav') updateSandboxPreview(e.data.file);
    });

    sandboxConsoleOutput.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>('.fix-error-button');
        if (button && button.dataset.errorMessage) {
            codingToggle.checked = true;
            codingToggle.dispatchEvent(new Event('change'));
            const prompt = `The code in the sandbox produced this error: "${button.dataset.errorMessage}". You are an expert software engineer. Your task is to analyze all the files in the current sandbox context (which can include any language like HTML, CSS, JS, PHP, Python), identify the root cause of the error, and provide a fix. Explain the problem clearly in the displayText before providing the file actions.`;
            handleSendMessage(prompt);
        }
    });

    // Sandbox Actions
    saveCodeButton.addEventListener('click', () => {
        if (codingSandboxState.activeFileId) {
            saveFileSnapshot(codingSandboxState.activeFileId);
        } else {
            showToast("No active file to save.", "info");
        }
    });

    historyCodeButton.addEventListener('click', () => {
        if (codingSandboxState.activeFileId) {
            showFileHistoryModal(codingSandboxState.activeFileId);
        } else {
            showToast("No active file to view history for.", "info");
        }
    });
    
    formatCodeButton.addEventListener('click', formatActiveFile);
    downloadCodeButton.addEventListener('click', downloadProject);


    let isResizing = false;
    sandboxResizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const mouseMoveHandler = (moveEvent: MouseEvent) => {
            if (!isResizing) return;
            const containerRect = sandboxContainer.getBoundingClientRect();
            const newEditorWidth = moveEvent.clientX - containerRect.left;
            (sandboxResizer.previousElementSibling as HTMLElement).style.flex = `0 0 ${newEditorWidth}px`;
        };
        const mouseUpHandler = () => {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            window.removeEventListener('mousemove', mouseMoveHandler);
            window.removeEventListener('mouseup', mouseUpHandler);
        };
        window.addEventListener('mousemove', mouseMoveHandler);
        window.addEventListener('mouseup', mouseUpHandler);
    });
}


function setupEventListeners() {
    chatForm.addEventListener('submit', handleSendMessage);
    newChatButton.addEventListener('click', startNewChat);

    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.requestSubmit();
        }
    });

    chatTitle.addEventListener('dblclick', () => {
        if (!currentChatId) return;
        const oldTitle = chatTitle.textContent ?? '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chat-title-input';
        input.value = oldTitle;
        chatTitle.replaceWith(input);
        input.focus();
        input.select();
        
        const finish = () => {
            const newTitle = input.value.trim();
            input.replaceWith(chatTitle);
            if (newTitle && newTitle !== oldTitle) {
                renameChat(currentChatId!, newTitle);
            } else {
                chatTitle.textContent = oldTitle;
            }
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    });

    searchToggle.addEventListener('change', () => { if (searchToggle.checked) codingToggle.checked = false; });
    
    codingToggle.addEventListener('change', () => {
        appSettings.isSandboxOpen = codingToggle.checked;
        saveSettings();

        if (codingToggle.checked) {
            searchToggle.checked = false;
            initializeCodingSandbox();
        } else {
            sandboxContainer.style.display = 'none';
        }
    });

    historyList.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const historyItem = target.closest<HTMLElement>('.history-item');
        if (!historyItem?.dataset.id) return;
        const chatId = historyItem.dataset.id;
        if (target.closest('.delete-chat-button')) {
            e.stopPropagation();
            deleteChat(chatId);
            return;
        }
        if (target.closest('.history-title-input')) {
            return; // Don't load chat if clicking the input field
        }
        if (chatId !== currentChatId) {
            loadChat(chatId);
        }
    });
    
    historyList.addEventListener('dblclick', (e) => {
        const target = e.target as HTMLElement;
        const historyItem = target.closest<HTMLElement>('.history-item');
        const titleSpan = historyItem?.querySelector('span');

        if (!historyItem || !titleSpan || !historyItem.dataset.id || historyItem.querySelector('.history-title-input')) return;

        const chatId = historyItem.dataset.id;
        const oldTitle = allChats[chatId].title;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'history-title-input';
        input.value = oldTitle;

        titleSpan.style.display = 'none';
        // Insert input before the delete button if it exists
        const deleteButton = historyItem.querySelector('.delete-chat-button');
        historyItem.insertBefore(input, deleteButton);
        input.focus();
        input.select();

        const finish = () => {
            const newTitle = input.value.trim();
            input.remove();
            titleSpan.style.display = '';
            if (newTitle && newTitle !== oldTitle) {
                renameChat(chatId, newTitle); // This will re-render everything
            }
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') input.blur();
            if (ev.key === 'Escape') { input.value = oldTitle; input.blur(); }
        });
    });

    // Message Context Menu
    chatContainer.addEventListener('contextmenu', (e) => {
        const messageEl = (e.target as HTMLElement).closest<HTMLElement>('.message');
        if (!messageEl || !currentChatId) return;
        
        e.preventDefault();
        contextMenuMessageElement = messageEl;
        const historyIndex = parseInt(messageEl.dataset.historyIndex || '-1', 10);
        const isAiMessage = messageEl.classList.contains('ai-message');
        const isLastMessage = messageEl === chatContainer.lastElementChild;
        
        messageContextCopyRaw.classList.toggle('hidden', !isAiMessage);
        messageContextRetry.classList.toggle('hidden', !(isAiMessage && isLastMessage));
        
        messageContextMenu.style.display = 'block';
        messageContextMenu.style.left = `${e.clientX}px`;
        messageContextMenu.style.top = `${e.clientY}px`;
    });
    
    messageContextCopy.addEventListener('click', () => {
        if (!contextMenuMessageElement) return;
        const content = (contextMenuMessageElement.querySelector('.message-content') as HTMLElement)?.innerText || '';
        navigator.clipboard.writeText(content).then(() => showToast('Copied to clipboard!', 'success'));
    });

    messageContextCopyRaw.addEventListener('click', () => {
        if (!contextMenuMessageElement || !currentChatId) return;
        const historyIndex = parseInt(contextMenuMessageElement.dataset.historyIndex || '-1', 10);
        if (historyIndex > -1) {
            const historyItem = allChats[currentChatId].history[historyIndex];
            if (historyItem) {
                const rawText = (historyItem.parts[0] as {text: string}).text;
                navigator.clipboard.writeText(rawText).then(() => showToast('Copied raw JSON!', 'success'));
            }
        }
    });

    messageContextRetry.addEventListener('click', () => {
        if (!currentChatId) return;
        const history = allChats[currentChatId].history;
        if (history.length >= 2 && history[history.length - 1].role === 'model') {
            // Pop the AI response and the user prompt
            history.pop();
            const lastUserPrompt = history.pop();
            
            if (lastUserPrompt && lastUserPrompt.role === 'user') {
                const promptText = (lastUserPrompt.parts[0] as { text: string }).text;
                // Remove the last two message elements from the DOM
                if(chatContainer.lastChild) chatContainer.lastChild.remove();
                if(chatContainer.lastChild) chatContainer.lastChild.remove();
                saveChatsToStorage();
                // Resend the prompt
                handleSendMessage(promptText);
            }
        }
    });


    // Modals
    clearHistoryButton.addEventListener('click', showClearHistoryModal);
    cancelClearButton.addEventListener('click', hideClearHistoryModal);
    clearHistoryModal.addEventListener('click', (e) => { if (e.target === clearHistoryModal) hideClearHistoryModal(); });
    confirmClearInput.addEventListener('input', () => { confirmClearButton.disabled = confirmClearInput.value.trim() !== CONFIRMATION_PHRASE; });
    confirmClearButton.addEventListener('click', () => {
        performClearAllHistory();
        hideClearHistoryModal();
    });
    
    settingsButton.addEventListener('click', showSettingsModal);
    closeSettingsButton.addEventListener('click', hideSettingsModal);
    settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) hideSettingsModal(); });
    themeSelector.addEventListener('change', () => {
        appSettings.theme = themeSelector.value as 'dark' | 'light';
        saveSettings();
        applyTheme();
    });
    temperatureSlider.addEventListener('input', () => {
        appSettings.temperature = parseFloat(temperatureSlider.value);
        temperatureValue.textContent = temperatureSlider.value;
    });
    temperatureSlider.addEventListener('change', saveSettings);
    typingSpeedSlider.addEventListener('input', () => {
        appSettings.typingWPM = parseInt(typingSpeedSlider.value, 10);
        typingSpeedValue.textContent = typingSpeedSlider.value;
    });
    typingSpeedSlider.addEventListener('change', saveSettings);

    clearSandboxButton.addEventListener('click', () => {
        showConfirmationModal("Clear Sandbox for this Chat?", "Are you sure you want to delete all files in the sandbox for the current chat? This cannot be undone.", () => {
            codingSandboxState = { activeFileId: null, files: {}, previewFile: 'index.html' };
            persistSandboxStateToCurrentChat();
            initializeCodingSandbox();
            showToast("Sandbox for this chat has been cleared!", 'success');
        });
        hideSettingsModal();
    });

    exportZipButton.addEventListener('click', () => {
        downloadProject();
        hideSettingsModal();
    });

    allowAiActionButton.addEventListener('click', () => {
        executeAiActions();
        hideAiActionConfirmation();
    });
    denyAiActionButton.addEventListener('click', hideAiActionConfirmation);
    aiActionModal.addEventListener('click', e => { if (e.target === aiActionModal) hideAiActionConfirmation() });
    
    // Sandbox Request Modal Listeners
    cancelSandboxRequestButton.addEventListener('click', hideSandboxRequestModal);
    requestSandboxModal.addEventListener('click', e => { if (e.target === requestSandboxModal) hideSandboxRequestModal() });
    confirmSandboxRequestButton.addEventListener('click', () => {
        codingToggle.checked = true;
        codingToggle.dispatchEvent(new Event('change', { bubbles: true }));
        hideSandboxRequestModal();
        if (originalUserMessageForSandboxRequest) {
            handleSendMessage(originalUserMessageForSandboxRequest);
        }
        originalUserMessageForSandboxRequest = null;
    });

    // File History Modal Listeners
    closeHistoryButton.addEventListener('click', hideFileHistoryModal);
    fileHistoryModal.addEventListener('click', e => { if(e.target === fileHistoryModal) hideFileHistoryModal(); });
    restoreHistoryButton.addEventListener('click', restoreFileFromHistory);

}

// --- Sandbox Tools ---
function saveFileSnapshot(fileId: string) {
    const file = codingSandboxState.files[fileId];
    if (!file) return;

    const currentContent = file.content;
    const lastVersion = file.history[file.history.length - 1];

    if (!lastVersion || lastVersion.content !== currentContent) {
        file.history.push({
            timestamp: Date.now(),
            content: currentContent,
        });
        persistSandboxStateToCurrentChat();
        showToast(`Saved version for ${file.name}`, "success");
    } else {
        showToast("No changes to save.", "info");
    }
}

function showFileHistoryModal(fileId: string) {
    const file = codingSandboxState.files[fileId];
    if (!file || file.history.length === 0) {
        showToast("No history found for this file.", "info");
        return;
    }

    activeHistoryModal = { fileId, selectedTimestamp: null };
    fileHistoryTitle.textContent = `History for: ${file.name}`;
    historyVersionList.innerHTML = '';

    // Sort descending
    const sortedHistory = [...file.history].reverse();

    sortedHistory.forEach((version, index) => {
        const li = document.createElement('li');
        li.className = 'history-version-item';
        li.dataset.timestamp = String(version.timestamp);
        li.textContent = new Date(version.timestamp).toLocaleString();
        if (index === 0) {
            li.textContent += ' (Latest)';
        }
        li.addEventListener('click', () => selectHistoryVersion(version));
        historyVersionList.appendChild(li);
    });

    // Select the first (latest) version by default
    selectHistoryVersion(sortedHistory[0]);
    fileHistoryModal.style.display = 'flex';
}

function selectHistoryVersion(version: FileHistoryEntry) {
    if (!activeHistoryModal) return;
    
    activeHistoryModal.selectedTimestamp = version.timestamp;

    document.querySelectorAll('.history-version-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-timestamp') === String(version.timestamp));
    });
    
    const file = codingSandboxState.files[activeHistoryModal.fileId];
    const language = getLanguageFromFilename(file.name);
    historyCodeHighlight.className = `language-${language}`;
    historyCodeHighlight.textContent = version.content;
    Prism.highlightElement(historyCodeHighlight);

    restoreHistoryButton.disabled = false;
}

function hideFileHistoryModal() {
    fileHistoryModal.style.display = 'none';
    activeHistoryModal = null;
}

function restoreFileFromHistory() {
    if (!activeHistoryModal || !activeHistoryModal.selectedTimestamp) return;

    const { fileId, selectedTimestamp } = activeHistoryModal;
    const file = codingSandboxState.files[fileId];
    const versionToRestore = file.history.find(h => h.timestamp === selectedTimestamp);

    if (file && versionToRestore) {
        file.content = versionToRestore.content;
        
        // If restoring to the active file, update the editor
        if (fileId === codingSandboxState.activeFileId) {
            sandboxCodeEditor.value = file.content;
            sandboxCodeEditor.dispatchEvent(new Event('input', { bubbles: true }));
        }

        saveFileSnapshot(fileId); // Save the restored version as a new "latest"
        persistSandboxStateToCurrentChat();
        showToast(`Restored ${file.name} to selected version.`, 'success');
    }
    hideFileHistoryModal();
}

async function downloadProject() {
    if (Object.keys(codingSandboxState.files).length === 0) {
        showToast("Sandbox is empty. Nothing to download.", 'info');
        return;
    }
    const zip = new JSZip();
    Object.values(codingSandboxState.files).forEach(file => {
        zip.file(file.name, file.content);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "gemini-sandbox-project.zip");
    showToast("Project download started!", "success");
}

function formatActiveFile() {
    if (!codingSandboxState.activeFileId) {
        showToast("No active file to format.", "info");
        return;
    }
    if (typeof prettier === 'undefined' || typeof prettierPlugins === 'undefined') {
        showToast("Formatting library is not available.", "error");
        return;
    }

    const file = codingSandboxState.files[codingSandboxState.activeFileId];
    const lang = getLanguageFromFilename(file.name);
    
    let parser: string;
    let plugins: any[];
    
    switch(lang) {
        case 'javascript':
        case 'jsx':
        case 'typescript':
        case 'tsx':
            parser = 'babel-ts';
            plugins = [prettierPlugins.babel];
            break;
        case 'css':
            parser = 'css';
            plugins = [prettierPlugins.postcss];
            break;
        case 'markup':
        case 'html':
            parser = 'html';
            plugins = [prettierPlugins.html];
            break;
        default:
            showToast(`Formatting not supported for ${lang} files.`, "info");
            return;
    }

    try {
        const formattedCode = prettier.format(file.content, {
            parser: parser,
            plugins: plugins,
            tabWidth: 4,
            semi: true,
        });

        sandboxCodeEditor.value = formattedCode;
        // Trigger input event to update state and highlighting
        sandboxCodeEditor.dispatchEvent(new Event('input', { bubbles: true }));
        saveFileSnapshot(file.id);
        showToast(`${file.name} formatted successfully.`, "success");
    } catch (e: any) {
        console.error("Prettier formatting error:", e);
        showToast(`Could not format code: ${e.message}`, "error");
    }
}


// Initialize the application
initializeApp();
