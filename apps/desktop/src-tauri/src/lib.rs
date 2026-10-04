use std::{sync::Mutex, time::Duration};

use reqwest::{Client, RequestBuilder, Url};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Default)]
struct AgentState {
    session: Mutex<Option<AgentSession>>,
}

#[derive(Clone)]
struct AgentSession {
    api_base_url: String,
    token: String,
}

#[derive(Serialize)]
struct LoginInfo {
    email: String,
}

#[derive(Serialize, Deserialize)]
struct Device {
    id: String,
    name: String,
    status: String,
    created_at: String,
}

#[derive(Serialize, Deserialize)]
struct Command {
    id: String,
    name: String,
    status: String,
    device_id: Option<String>,
    created_at: String,
}

#[derive(Deserialize)]
struct ListResponse<T> {
    items: Vec<T>,
}

#[derive(Deserialize)]
struct LoginResponse {
    access_token: Option<String>,
    user: Option<LoginUser>,
}

#[derive(Deserialize)]
struct LoginUser {
    email: String,
}

#[derive(Serialize)]
struct Dashboard {
    devices: Vec<Device>,
    commands: Vec<Command>,
}

#[derive(Serialize)]
struct RegisterDeviceRequest<'a> {
    name: &'a str,
}

#[derive(Serialize)]
struct SyncStatementRequest<'a> {
    device_id: &'a str,
}

fn normalize_api_base_url(value: &str) -> Result<String, String> {
    let mut url = Url::parse(value.trim()).map_err(|_| "invalid_api_url".to_string())?;
    let host = url.host_str().unwrap_or_default();
    let is_local_http = url.scheme() == "http"
        && matches!(host, "localhost" | "127.0.0.1" | "[::1]");

    if (url.scheme() != "https" && !is_local_http)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("invalid_api_url".to_string());
    }

    let path = url.path().trim_end_matches('/').to_string();
    url.set_path(&path);
    Ok(url.as_str().trim_end_matches('/').to_string())
}

fn active_session(state: &AgentState) -> Result<AgentSession, String> {
    state
        .session
        .lock()
        .map_err(|_| "internal_error".to_string())?
        .clone()
        .ok_or_else(|| "not_authenticated".to_string())
}

fn map_request_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "api_timeout".to_string()
    } else if error.is_connect() {
        "api_unreachable".to_string()
    } else {
        "network_error".to_string()
    }
}

async fn send_authenticated(
    session: &AgentSession,
    request: RequestBuilder,
) -> Result<reqwest::Response, String> {
    let response = request
        .bearer_auth(&session.token)
        .send()
        .await
        .map_err(map_request_error)?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("session_expired".to_string());
    }
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Err("device_not_found".to_string());
    }
    if response.status() == reqwest::StatusCode::FORBIDDEN {
        return Err("permission_denied".to_string());
    }
    if !response.status().is_success() {
        return Err("api_request_failed".to_string());
    }
    Ok(response)
}

#[tauri::command]
async fn login(
    state: State<'_, AgentState>,
    client: tauri::State<'_, Client>,
    api_base_url: String,
    email: String,
    password: String,
) -> Result<LoginInfo, String> {
    let api_base_url = normalize_api_base_url(&api_base_url)?;
    let response = client
        .post(format!("{api_base_url}/auth/login"))
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(map_request_error)?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("invalid_credentials".to_string());
    }
    if response.status() == reqwest::StatusCode::UNPROCESSABLE_ENTITY {
        return Err("invalid_input".to_string());
    }
    if !response.status().is_success() {
        return Err("api_request_failed".to_string());
    }

    let auth: LoginResponse = response
        .json()
        .await
        .map_err(|_| "invalid_api_response".to_string())?;
    let token = auth
        .access_token
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "invalid_api_response".to_string())?;
    let email = auth
        .user
        .map(|user| user.email)
        .ok_or_else(|| "invalid_api_response".to_string())?;

    *state
        .session
        .lock()
        .map_err(|_| "internal_error".to_string())? = Some(AgentSession {
        api_base_url,
        token,
    });

    Ok(LoginInfo { email })
}

#[tauri::command]
async fn load_dashboard(
    state: State<'_, AgentState>,
    client: State<'_, Client>,
) -> Result<Dashboard, String> {
    let session = active_session(&state)?;
    let devices_response = send_authenticated(
        &session,
        client.get(format!("{}/agent/devices", session.api_base_url)),
    )
    .await?;
    let commands_response = send_authenticated(
        &session,
        client.get(format!("{}/agent/commands", session.api_base_url)),
    )
    .await?;

    let devices = devices_response
        .json::<ListResponse<Device>>()
        .await
        .map_err(|_| "invalid_api_response".to_string())?
        .items;
    let commands = commands_response
        .json::<ListResponse<Command>>()
        .await
        .map_err(|_| "invalid_api_response".to_string())?
        .items;

    Ok(Dashboard { devices, commands })
}

#[tauri::command]
async fn register_device(
    state: State<'_, AgentState>,
    client: State<'_, Client>,
    name: String,
) -> Result<Device, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 120 {
        return Err("invalid_device_name".to_string());
    }

    let session = active_session(&state)?;
    send_authenticated(
        &session,
        client
            .post(format!("{}/agent/devices", session.api_base_url))
            .json(&RegisterDeviceRequest { name }),
    )
    .await?
    .json::<Device>()
    .await
    .map_err(|_| "invalid_api_response".to_string())
}

#[tauri::command]
async fn queue_statement_sync(
    state: State<'_, AgentState>,
    client: State<'_, Client>,
    device_id: String,
) -> Result<Command, String> {
    let session = active_session(&state)?;
    send_authenticated(
        &session,
        client
            .post(format!(
                "{}/agent/commands/sync-statement",
                session.api_base_url
            ))
            .json(&SyncStatementRequest {
                device_id: &device_id,
            }),
    )
    .await?
    .json::<Command>()
    .await
    .map_err(|_| "invalid_api_response".to_string())
}

#[tauri::command]
fn logout(state: State<'_, AgentState>) -> Result<(), String> {
    *state
        .session
        .lock()
        .map_err(|_| "internal_error".to_string())? = None;
    Ok(())
}

pub fn run() {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("could not initialize the HTTP client");

    tauri::Builder::default()
        .manage(AgentState::default())
        .manage(client)
        .invoke_handler(tauri::generate_handler![
            login,
            load_dashboard,
            register_device,
            queue_statement_sync,
            logout
        ])
        .run(tauri::generate_context!())
        .expect("error while running FinAdvisor Agent");
}

#[cfg(test)]
mod tests {
    use super::normalize_api_base_url;

    #[test]
    fn accepts_https_and_local_development_urls() {
        assert_eq!(
            normalize_api_base_url(" https://api.finadvisor.uz/ ").unwrap(),
            "https://api.finadvisor.uz"
        );
        assert_eq!(
            normalize_api_base_url("http://127.0.0.1:8000/").unwrap(),
            "http://127.0.0.1:8000"
        );
    }

    #[test]
    fn rejects_insecure_remote_urls_and_embedded_credentials() {
        assert!(normalize_api_base_url("http://api.finadvisor.uz").is_err());
        assert!(normalize_api_base_url("https://user:password@example.com").is_err());
    }
}
