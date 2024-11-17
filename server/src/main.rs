mod alarm;
mod db;
mod scheduler;

use alarm::{Alarm, AlarmEntry, AlarmId};
use anyhow::Result;
use axum::{
    extract::State,
    http::{header, HeaderName, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use db::DbEntry;
use include_dir::{include_dir, Dir};
use scheduler::SchedulerError;
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tokio::net::TcpSocket;
use tower::ServiceBuilder;
use tower_http::{compression::CompressionLayer, decompression::RequestDecompressionLayer};

#[tokio::main]
async fn main() -> Result<()> {
    let alarm = Alarm::initialise()?;
    let state = AppState { alarm };
    let api_routes = Router::new()
        .route("/alarm", get(get_all_alarms))
        .route("/alarm", post(create_alarm))
        .route("/alarm", delete(delete_alarm))
        .route("/alarm", put(update_alarm))
        .route("/stop", get(stop_alarm))
        .route("/start", get(start_alarm))
        .with_state(state);
    let app = Router::new()
        .nest("/api", api_routes)
        .fallback(static_handler)
        .layer(
            ServiceBuilder::new()
                .layer(RequestDecompressionLayer::new())
                .layer(CompressionLayer::new()),
        );
    let socket = TcpSocket::new_v4()?;
    socket.set_nodelay(true)?;
    socket.bind(SocketAddr::new(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)), 8080))?;
    let listener = socket.listen(1024)?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    static STATIC_DIR: Dir = include_dir!("src/dist");
    let mut path = uri.path().trim_start_matches('/');
    if path.is_empty() {
        path = "index.html";
    }
    match STATIC_DIR.get_file(path) {
        Some(file) => {
            let contents = file.contents();
            let mime_type = mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string();
            (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, mime_type),
                    (
                        header::CACHE_CONTROL,
                        "public, max-age=31536000".to_string(),
                    ),
                    (
                        HeaderName::from_static("x-clacks-overhead"),
                        "GNU Terry Pratchett".to_string(),
                    ),
                ],
                contents,
            )
                .into_response()
        }
        None => (StatusCode::NOT_FOUND, "404 Not Found").into_response(),
    }
}

#[derive(Clone)]
struct AppState {
    alarm: Alarm,
}

async fn get_all_alarms(
    State(AppState { alarm }): State<AppState>,
) -> Json<Vec<DbEntry<AlarmEntry>>> {
    let alarms = alarm.get_all_alarms().unwrap();
    Json(alarms)
}

async fn stop_alarm(State(AppState { alarm }): State<AppState>) {
    alarm.stop_alarm().unwrap();
}

async fn start_alarm(State(AppState { alarm }): State<AppState>) {
    alarm.start_alarm().await.unwrap();
}

#[derive(Deserialize, Serialize)]
struct AlarmIdJson {
    id: AlarmId,
}

async fn create_alarm(
    State(AppState { mut alarm }): State<AppState>,
    Json(payload): Json<AlarmEntry>,
) -> Result<Json<AlarmIdJson>, SchedulerError> {
    let id = match alarm.add_alarm(payload) {
        Ok(id) => id,
        Err(e) => {
            if let Some(sched_error) = e.downcast_ref::<SchedulerError>() {
                return Err(sched_error.clone());
            } else {
                panic!("{e}");
            }
        }
    };
    Ok(Json(AlarmIdJson { id }))
}

async fn delete_alarm(
    State(AppState { mut alarm }): State<AppState>,
    Json(payload): Json<AlarmIdJson>,
) {
    alarm.remove_alarm(payload.id).unwrap();
}

async fn update_alarm(
    State(AppState { mut alarm }): State<AppState>,
    Json(payload): Json<DbEntry<AlarmEntry>>,
) -> Result<(), SchedulerError> {
    if let Err(e) = alarm.update_alarm(payload) {
        if let Some(sched_error) = e.downcast_ref::<SchedulerError>() {
            return Err(sched_error.clone());
        } else {
            panic!("{e}");
        }
    }
    Ok(())
}

impl IntoResponse for SchedulerError {
    fn into_response(self) -> Response {
        #[derive(Serialize)]
        struct ErrorResponse {
            error: String,
        }

        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: self.to_string(),
            }),
        )
            .into_response()
    }
}
