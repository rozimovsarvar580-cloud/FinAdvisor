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

export function renderDashboard(dashboard, locale = "uz", busy = false, syncStatus = { online: true, queued: 0 }, chat = { messages: [], busy: false }) {
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
