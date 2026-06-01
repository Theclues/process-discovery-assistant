// Process Discovery Assistant — Frontend App

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

let sessionId = "";
let isProcessing = false;

// ─── DOM refs ──────────────────────────────────────────────────
const messagesEl = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const btnSend = document.getElementById("btnSend");
const btnConclude = document.getElementById("btnConclude");
const btnNew = document.getElementById("btnNew");
const headerStats = document.getElementById("headerStats");
const mermaidContainer = document.getElementById("mermaidContainer");
const reportContent = document.getElementById("reportContent");

// ─── Init ──────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch("/api/session/new", { method: "POST" });
    const data = await res.json();
    sessionId = data.sessionId;
    addMessage("assistant", data.message);
    updateHeader(data);
    enableInput(true);
  } catch (err) {
    addMessage("system", "连接服务器失败，请确认服务已启动。");
  }
}

// ─── Send Message ──────────────────────────────────────────────
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || isProcessing) return;

  addMessage("user", text);
  userInput.value = "";
  isProcessing = true;
  btnSend.disabled = true;

  const typing = addMessage("assistant", '<span class="spinner"></span> 思考中...');

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: text }),
    });
    const data = await res.json();
    typing.remove();
    addMessage("assistant", data.message);

    if (data.mermaidDiagram) {
      renderMermaid(data.mermaidDiagram);
    }
    updateHeader(data);
    btnConclude.disabled = data.nodeCount < 3;
  } catch (err) {
    typing.remove();
    addMessage("system", "请求失败: " + err.message);
  }

  isProcessing = false;
  btnSend.disabled = false;
  userInput.focus();
}

// ─── Conclude Session ──────────────────────────────────────────
async function concludeSession() {
  if (!sessionId || isProcessing) return;
  isProcessing = true;

  try {
    const res = await fetch("/api/conclude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    addMessage("assistant", data.message);

    if (data.mermaidDiagram) renderMermaid(data.mermaidDiagram);
    if (data.report) renderReport(data.report);
    updateHeader(data);
    enableInput(false);
  } catch (err) {
    addMessage("system", "请求失败: " + err.message);
  }
  isProcessing = false;
}

// ─── New Session ───────────────────────────────────────────────
async function newSession() {
  messagesEl.innerHTML = "";
  mermaidContainer.innerHTML = '<p class="placeholder">开始对话后，流程图将在此显示</p>';
  reportContent.innerHTML = '<p class="placeholder">完成建模后可查看分析报告</p>';
  btnConclude.disabled = true;
  await init();
}

// ─── UI Helpers ────────────────────────────────────────────────
function addMessage(role, html) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  if (role === "assistant") {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = "流程助手";
    div.appendChild(meta);
  }
  const content = document.createElement("div");
  content.innerHTML = html;
  div.appendChild(content);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function updateHeader(data) {
  const parts = [];
  if (data.stateLabel) parts.push(`状态: ${data.stateLabel}`);
  if (data.nodeCount) parts.push(`节点: ${data.nodeCount}`);
  if (data.edgeCount) parts.push(`边: ${data.edgeCount}`);
  if (data.confidence != null) parts.push(`置信度: ${data.confidence}%`);
  if (data.gapCount) parts.push(`缺口: ${data.gapCount}`);
  headerStats.textContent = parts.join(" | ");
}

function enableInput(enabled) {
  userInput.disabled = !enabled;
  btnSend.disabled = !enabled;
  if (enabled) userInput.focus();
}

// ─── Mermaid ───────────────────────────────────────────────────
async function renderMermaid(code) {
  try {
    const { svg } = await mermaid.render("mermaidGraph", code);
    mermaidContainer.innerHTML = svg;
  } catch (err) {
    mermaidContainer.innerHTML = `<pre style="font-size:0.8em;overflow:auto">${escapeHtml(code)}</pre>`;
  }
}

// ─── Report ────────────────────────────────────────────────────
function renderReport(report) {
  let html = `<p>${report.summary}</p>`;

  // Stats grid
  html += '<h3>模型统计</h3><div class="stat-grid">';
  const stats = [
    ["节点数", report.stats.nodeCount],
    ["边数", report.stats.edgeCount],
    ["置信度", Math.round(report.stats.avgConfidence * 100) + "%"],
    ["部门数", report.stats.departmentCount],
    ["跨部门交接", report.stats.crossDepartmentEdges],
    ["单点故障", report.stats.spofCount],
  ];
  for (const [lbl, val] of stats) {
    html += `<div class="stat"><div class="val">${val}</div><div class="lbl">${lbl}</div></div>`;
  }
  html += '</div>';

  // Top gaps
  if (report.topGaps?.length) {
    html += '<h3>主要缺口</h3>';
    for (const g of report.topGaps) {
      html += `<div class="gap-item"><strong>${g.type}</strong> (${g.score}): ${g.description}</div>`;
    }
  }

  // Recommendations
  if (report.recommendations?.length) {
    html += '<h3>建议</h3>';
    for (const r of report.recommendations) {
      html += `<div class="rec-item">→ ${r}</div>`;
    }
  }

  reportContent.innerHTML = html;
}

// ─── Tab Switching ─────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  event.target.classList.add("active");
  document.getElementById("tab" + name.charAt(0).toUpperCase() + name.slice(1)).classList.add("active");
}

// ─── Keyboard ──────────────────────────────────────────────────
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ─── Escape HTML ───────────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Start
init();
