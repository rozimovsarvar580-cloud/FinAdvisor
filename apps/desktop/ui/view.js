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

export function renderDashboard(dashboard, locale = "uz", busy = false) {
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
