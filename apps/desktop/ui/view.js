import { getMessages } from "./messages.js";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function renderAccountingWorkspace(locale, businessType, activeScreen, busy) {
  const t = getMessages(locale);
  const screens = businessType === "services"
    ? ["sales", "expenses", "catalog"]
    : ["inventory", "sales", "expenses", "catalog"];
  const screen = screens.includes(activeScreen) ? activeScreen : screens[0];
  const fields = {
    inventory: [
      ["product", "text", true],
      ["quantity", "number", true],
      ["direction", "select", true],
      ["date", "date", true]
    ],
    sales: [
      ["product", "text", true],
      ["quantity", "number", true],
      ["amount", "number", true],
      ["category", "text", true],
      ["date", "date", true]
    ],
    expenses: [
      ["amount", "number", true],
      ["category", "text", true],
      ["description", "text", false],
      ["date", "date", true]
    ],
    catalog: [
      ["name", "text", true],
      ["item_type", "select", true],
      ["unit", "text", true],
      ["service_duration_minutes", "number", false]
    ]
  }[screen];
  const resource = ({ inventory: "stock-movements", catalog: "inventory" })[screen] ?? screen;
  const inputs = fields.map(([name, type, required]) => {
    const label = name;
    if (name === "direction") {
      return `<label>${escapeHtml(t.direction)}<select name="direction" required><option value="in">${escapeHtml(t.stockIn)}</option><option value="out">${escapeHtml(t.stockOut)}</option></select></label>`;
    }
    if (name === "item_type") {
      const options = businessType === "mixed" ? ["goods", "service"] : [businessType === "services" ? "service" : "goods"];
      return `<label>${escapeHtml(t.itemType)}<select name="item_type" required>${options.map(value => `<option value="${value}">${escapeHtml(t[value])}</option>`).join("")}</select></label>`;
    }
    const isDuration = name === "service_duration_minutes";
    const hidden = isDuration && businessType !== "services";
    return `<label${isDuration ? ' data-duration-field="true"' : ""}${hidden ? " hidden" : ""}>${escapeHtml(t[label])}<input name="${escapeHtml(name)}" type="${type}"${type === "number" ? ' min="0.001" step="any"' : ""}${required ? " required" : ""} /></label>`;
  }).join("");
  return `
    <section class="panel" aria-labelledby="accounting-title">
      <div class="section-heading"><h2 id="accounting-title">${escapeHtml(t.accountingTitle)}</h2></div>
      <label>${escapeHtml(t.businessType)}<select id="accounting-business-type" ${busy ? "disabled" : ""}>
        ${["goods", "services", "mixed"].map(value => `<option value="${value}"${businessType === value ? " selected" : ""}>${escapeHtml(t[value])}</option>`).join("")}
      </select></label>
      <nav class="accounting-tabs" aria-label="${escapeHtml(t.accountingTitle)}">
        ${screens.map(key => `<button type="button" class="button button-secondary" data-accounting-screen="${key}" aria-pressed="${screen === key}">${escapeHtml(t[key])}</button>`).join("")}
      </nav>
      <form id="accounting-form" class="form-stack" data-resource="${resource}">
        ${inputs}
        <button class="button" type="submit" ${busy ? "disabled" : ""}>${escapeHtml(t.saveAccounting)}</button>
      </form>
      <button class="button button-secondary" type="button" data-sync-accounting ${busy ? "disabled" : ""}>${escapeHtml(t.syncAccounting)}</button>
    </section>`;
}

export function renderDashboard(dashboard, locale = "uz", busy = false, syncStatus = { online: true, queued: 0 }, chat = { messages: [], busy: false }, businessType = "goods", accountingScreen = "inventory") {
  const t = getMessages(locale);
  const translateStatus = (status) =>
    ({ registered: t.registered, queued: t.queued })[status] ?? status;
  const translateCommand = (name) =>
    ({ sync_statement: t.syncStatement })[name] ?? name;
  const devices = dashboard.devices.length
    ? dashboard.devices
        .map(
          (device) => `
            <article class="device-card">
              <div>
                <h3>${escapeHtml(device.name)}</h3>
                <p class="muted">${escapeHtml(translateStatus(device.status))}</p>
              </div>
              <button class="button button-secondary" data-sync="${escapeHtml(device.id)}" type="button" ${busy ? "disabled" : ""}>
                ${escapeHtml(t.syncStatement)}
              </button>
            </article>`
        )
        .join("")
    : `<p class="empty-state">${escapeHtml(t.noDevices)}</p>`;
  const commands = dashboard.commands.length
    ? dashboard.commands
        .map(
          (command) => `
            <tr>
              <td>${escapeHtml(translateCommand(command.name))}</td>
              <td>${escapeHtml(translateStatus(command.status))}</td>
              <td>${escapeHtml(command.created_at)}</td>
            </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="empty-state">${escapeHtml(t.noCommands)}</td></tr>`;

  return `
    ${renderAccountingWorkspace(locale, businessType, accountingScreen, busy)}
    <section class="panel" aria-labelledby="owner-chat-title">
      <div class="section-heading"><h2 id="owner-chat-title">${escapeHtml(t.ownerChat)}</h2></div>
      <div class="chat-transcript" role="log" aria-label="${escapeHtml(t.chatTranscript)}" aria-live="polite">
        ${chat.messages.length ? chat.messages.map((message) => `<p class="chat-message chat-${message.role}"><strong>${escapeHtml(t[message.role])}:</strong> ${escapeHtml(message.content)}</p>`).join("") : `<p class="empty-state">${escapeHtml(t.chatEmpty)}</p>`}
      </div>
      <form id="chat-form" class="inline-form">
        <label class="sr-only" for="chat-message">${escapeHtml(t.chatPlaceholder)}</label>
        <input id="chat-message" name="message" maxlength="4000" required placeholder="${escapeHtml(t.chatPlaceholder)}" ${chat.busy ? "disabled" : ""} />
        <button class="button" type="submit" ${chat.busy ? "disabled" : ""}>${escapeHtml(chat.busy ? t.chatSending : t.chatSend)}</button>
      </form>
    </section>
    <p class="sync-status" role="status">${escapeHtml(syncStatus.online ? t.syncOnline : t.syncOffline)} · ${escapeHtml(t.queuedRecords)}: ${Number(syncStatus.queued) || 0}</p>
    <section class="panel">
      <div class="section-heading"><h2>${escapeHtml(t.devices)}</h2></div>
      <div class="device-list">${devices}</div>
      <form id="register-device-form" class="inline-form">
        <label class="sr-only" for="device-name">${escapeHtml(t.deviceName)}</label>
        <input id="device-name" name="name" maxlength="120" required placeholder="${escapeHtml(t.deviceName)}" />
        <button class="button" type="submit" ${busy ? "disabled" : ""}>${escapeHtml(t.registerDevice)}</button>
      </form>
    </section>
    <section class="panel">
      <div class="section-heading"><h2>${escapeHtml(t.commands)}</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>${escapeHtml(t.command)}</th><th>${escapeHtml(t.status)}</th><th>${escapeHtml(t.createdAt)}</th></tr></thead>
          <tbody>${commands}</tbody>
        </table>
      </div>
    </section>`;
}
