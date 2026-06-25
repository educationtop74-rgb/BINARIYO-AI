// ---------- State ----------
let history = []; // { role: 'user' | 'assistant', content: string }

// ---------- DOM ----------
const stream = document.getElementById('stream');
const emptyState = document.getElementById('emptyState');
const composer = document.getElementById('composer');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const orb = document.getElementById('orb');
const status = document.getElementById('status');
const clearBtn = document.getElementById('clearBtn');

// ---------- Auto-resize textarea ----------
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 140) + 'px';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

// ---------- Minimal markdown renderer (no external deps) ----------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderMarkdown(text) {
  let safe = escapeHtml(text);

  // code blocks ```...```
  safe = safe.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  // inline code
  safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italics
  safe = safe.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // paragraphs
  const paragraphs = safe.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}

// ---------- Rendering ----------
function hideEmptyState() {
  if (emptyState) emptyState.style.display = 'none';
}

function addMessage(role, content) {
  hideEmptyState();
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  if (role === 'assistant') {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.textContent = content;
  }
  msg.appendChild(bubble);
  stream.appendChild(msg);
  stream.scrollTop = stream.scrollHeight;
  return bubble;
}

function addTypingIndicator() {
  hideEmptyState();
  const msg = document.createElement('div');
  msg.className = 'msg assistant';
  msg.id = 'typingIndicator';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  msg.appendChild(bubble);
  stream.appendChild(msg);
  stream.scrollTop = stream.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function setThinking(isThinking) {
  orb.classList.toggle('thinking', isThinking);
  status.textContent = isThinking ? 'thinking…' : 'ready';
  sendBtn.disabled = isThinking;
  input.disabled = isThinking;
}

// ---------- Send flow ----------
async function sendMessage(text) {
  history.push({ role: 'user', content: text });
  addMessage('user', text);

  input.value = '';
  input.style.height = 'auto';
  setThinking(true);
  addTypingIndicator();

  try {
    // Vercel API routing update
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });

    removeTypingIndicator();

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error (${res.status})`);
    }

    const data = await res.json();
    const reply = data.reply || 'Sorry, I had trouble generating a response.';

    history.push({ role: 'assistant', content: reply });
    addMessage('assistant', reply);
  } catch (err) {
    removeTypingIndicator();
    const msg = document.createElement('div');
    msg.className = 'msg error';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = `⚠ ${err.message || 'Something went wrong. Please try again.'}`;
    msg.appendChild(bubble);
    stream.appendChild(msg);
    stream.scrollTop = stream.scrollHeight;
  } finally {
    setThinking(false);
    input.focus();
  }
}

composer.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  sendMessage(text);
});

clearBtn.addEventListener('click', () => {
  history = [];
  stream.innerHTML = '';
  stream.appendChild(emptyState);
  emptyState.style.display = 'flex';
});
