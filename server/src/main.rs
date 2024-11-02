mod alarm;
mod cron;
mod db;

use alarm::{Alarm, AlarmId};
use anyhow::Result;
use axum::{
    body::Body,
    extract::{Request, State},
    http::{HeaderValue, StatusCode, Uri},
    middleware::{from_fn, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use cron::{CreateCronError, ScheduleEntry};
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tower_http::services::ServeDir;

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
        .with_state(state);
    let app = Router::new()
        .nest("/api", api_routes)
        .fallback_service(ServeDir::new("dist"))
        .layer(from_fn(frontend_middleware));
    let listener = TcpListener::bind("0.0.0.0:8080").await?;
    println!("listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await?;
    Ok(())
}

#[derive(Clone)]
struct AppState {
    alarm: Alarm,
}

async fn frontend_middleware(uri: Uri, request: Request<Body>, next: Next) -> impl IntoResponse {
    let mut response = next.run(request).await;
    if !uri.path().starts_with("/api") && response.status() == StatusCode::OK {
        response.headers_mut().insert(
            "cache-control",
            HeaderValue::from_static("public, max-age=31536000"),
        );
    }
    if uri.path() == "/" {
        response.headers_mut().insert(
            "x-clacks-overhead",
            HeaderValue::from_static("GNU Terry Pratchett"),
        );
    }
    response
}

#[derive(Deserialize, Serialize)]
struct AlarmEntry {
    alarm: ScheduleEntry,
    id: i64,
    is_enabled: bool,
}

async fn get_all_alarms(State(AppState { alarm }): State<AppState>) -> Json<Vec<AlarmEntry>> {
    let alarms = alarm.get_all_crons().unwrap();
    Json(alarms)
}

async fn stop_alarm(State(AppState { alarm }): State<AppState>) {
    alarm.stop_alarm();
}

#[derive(Deserialize)]
struct AlarmEntryInput {
    alarm: ScheduleEntry,
    is_enabled: bool,
}

#[derive(Deserialize, Serialize)]
struct AlarmIdJson {
    id: i64,
}

async fn create_alarm(
    State(AppState { mut alarm }): State<AppState>,
    Json(payload): Json<AlarmEntryInput>,
) -> Response {
    #[derive(Serialize)]
    struct ErrorResponse {
        error: String,
    }

    match alarm.add_alarm(
        payload.is_enabled,
        payload.alarm.hours,
        payload.alarm.minutes,
        payload.alarm.days.into_iter().collect(),
    ) {
        Ok(id) => (StatusCode::OK, Json(AlarmIdJson { id: id.0 })).into_response(),
        Err(e) => {
            if let Some(create_cron_error) = e.downcast_ref::<CreateCronError>() {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: create_cron_error.to_string(),
                    }),
                )
                    .into_response();
            } else {
                panic!("{e:?}");
            }
        }
    }
}

async fn delete_alarm(
    State(AppState { mut alarm }): State<AppState>,
    Json(payload): Json<AlarmIdJson>,
) {
    alarm.remove_alarm(AlarmId(payload.id)).unwrap();
}

async fn update_alarm(
    State(AppState { mut alarm }): State<AppState>,
    Json(payload): Json<AlarmEntry>,
) {
    alarm
        .update_alarm(
            AlarmId(payload.id),
            payload.is_enabled,
            payload.alarm.hours,
            payload.alarm.minutes,
            payload.alarm.days.into_iter().collect(),
        )
        .unwrap();
}
