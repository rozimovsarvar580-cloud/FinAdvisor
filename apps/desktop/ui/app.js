import { escapeHtml, renderDashboard } from "./view.js";
import { getMessages } from "./messages.js";

const app = document.querySelector("#app");
const state = {
  locale: localStorage.getItem("finadvisor-agent-locale") ?? "uz",
  theme: localStorage.getItem("finadvisor-agent-theme") ?? "system",
  apiBaseUrl: "http://127.0.0.1:8000",
  email: "",
  dashboard: { devices: [], commands: [] },
  loggedIn: false,
  busy: false
};

function invoke(command, args = {}) {
  const tauriInvoke = window.__TAURI__?.core?.invoke;
  if (!tauriInvoke) {
    return Promise.reject("app_unavailable");
  }
  return tauriInvoke(command, args);
}

function render() {
  const t = getMessages(state.locale);
  document.documentElement.lang = state.locale;
  document.documentElement.dataset.theme = state.theme;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="${escapeHtml(t.appTitle)}">
          <span class="brand-mark" aria-hidden="true">F</span>
          <span>FinAdvisor</span>
        </a>
        <div class="toolbar">
          <label class="sr-only" for="locale">${escapeHtml(t.language)}</label>
          <select id="locale" aria-label="${escapeHtml(t.language)}">
            <option value="uz" ${state.locale === "uz" ? "selected" : ""}>O‘zbekcha</option>
            <option value="ru" ${state.locale === "ru" ? "selected" : ""}>Русский</option>
            <option value="en" ${state.locale === "en" ? "selected" : ""}>English</option>
          </select>
          <button class="icon-button" id="toggle-theme" type="button" aria-label="${escapeHtml(t.theme)}">◐</button>
        </div>
      </header>
      <section class="hero">
        <p class="eyebrow">FinAdvisor Agent</p>
        <h1>${escapeHtml(t.appTitle)}</h1>
        <p class="muted">${escapeHtml(t.appDescription)}</p>
      </section>
      <p id="status" class="status" role="status" aria-live="polite"></p>
      ${
        state.loggedIn
          ? `
            <div class="account-bar">
              <span>${escapeHtml(t.connectedAs)} <strong>${escapeHtml(state.email)}</strong></span>
              <button id="logout" class="button button-secondary" type="button">${escapeHtml(t.signOut)}</button>
            </div>
            ${renderDashboard(state.dashboard, state.locale)}`
          : `
            <section class="panel login-panel">
              <h2>${escapeHtml(t.loginTitle)}</h2>
              <form id="login-form" class="form-stack">
                <label for="api-url">${escapeHtml(t.apiUrl)}</label>
                <input id="api-url" name="apiBaseUrl" type="url" value="${escapeHtml(state.apiBaseUrl)}" autocomplete="url" required />
                <label for="email">${escapeHtml(t.email)}</label>
                <input id="email" name="email" type="email" autocomplete="username" required />
                <label for="password">${escapeHtml(t.password)}</label>
                <input id="password" name="password" type="password" autocomplete="current-password" required />
                <button class="button" type="submit" ${state.busy ? "disabled" : ""}>${escapeHtml(state.busy ? t.signingIn : t.signIn)}</button>
              </form>
            </section>`
      }
      <footer>${escapeHtml(t.appDescription)}</footer>
    </div>`;
}

function setStatus(message) {
  const node = document.querySelector("#status");
  if (node) {
    node.textContent = message;
  }
}

function errorMessage(error) {
  const t = getMessages(state.locale);
  const keys = {
    api_unreachable: "apiUnreachable",
    api_timeout: "apiTimeout",
    invalid_api_url: "invalidApiUrl",
    invalid_credentials: "invalidCredentials",
    invalid_input: "invalidInput",
    invalid_device_name: "invalidDeviceName",
    device_not_found: "deviceNotFound",
    permission_denied: "permissionDenied",
    session_expired: "sessionExpired",
    not_authenticated: "notAuthenticated",
    invalid_api_response: "invalidApiResponse",
    app_unavailable: "appUnavailable",
    network_error: "networkError",
    internal_error: "internalError",
    api_request_failed: "apiRequestFailed"
  };
  return t[keys[error] ?? "requestFailed"];
}

async function refreshDashboard() {
  state.dashboard = await invoke("load_dashboard");
  render();
}

app.addEventListener("change", (event) => {
  if (event.target.id === "locale") {
    state.locale = event.target.value;
    localStorage.setItem("finadvisor-agent-locale", state.locale);
    render();
  }
});

app.addEventListener("click", async (event) => {
  if (event.target.closest("#toggle-theme")) {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("finadvisor-agent-theme", state.theme);
    render();
    return;
  }

  if (event.target.closest("#logout")) {
    try {
      await invoke("logout");
      state.loggedIn = false;
      state.dashboard = { devices: [], commands: [] };
      render();
    } catch (error) {
      setStatus(errorMessage(error));
    }
    return;
  }

  const syncButton = event.target.closest("[data-sync]");
  if (syncButton) {
    try {
      state.busy = true;
      render();
      await invoke("queue_statement_sync", { deviceId: syncButton.dataset.sync });
      state.dashboard = await invoke("load_dashboard");
      state.busy = false;
      render();
    } catch (error) {
      state.busy = false;
      render();
      setStatus(errorMessage(error));
    }
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;

  if (form.id === "login-form") {
    const formData = new FormData(form);
    state.apiBaseUrl = String(formData.get("apiBaseUrl"));
    try {
      state.busy = true;
      render();
      const result = await invoke("login", {
        apiBaseUrl: state.apiBaseUrl,
        email: String(formData.get("email")),
        password: String(formData.get("password"))
      });
      state.email = result.email;
      state.loggedIn = true;
      state.busy = false;
      await refreshDashboard();
    } catch (error) {
      state.busy = false;
      render();
      setStatus(errorMessage(error));
    }
  } else if (form.id === "register-device-form") {
    const formData = new FormData(form);
    try {
      state.busy = true;
      render();
      await invoke("register_device", { name: String(formData.get("name")) });
      state.dashboard = await invoke("load_dashboard");
      state.busy = false;
      render();
      setStatus(getMessages(state.locale).deviceRegistered);
    } catch (error) {
      state.busy = false;
      render();
      setStatus(errorMessage(error));
    }
  }
});

render();
