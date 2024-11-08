mod alarm;
mod db;
mod scheduler;

use alarm::{Alarm, AlarmEntry, AlarmId};
use anyhow::Result;
use axum::{
    body::Body,
    extract::{MatchedPath, Request, State},
    http::{header, HeaderValue, StatusCode, Uri},
    middleware::{from_fn, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
    Json, Router,
};
use db::DbEntry;
use include_dir::{include_dir, Dir};
use scheduler::SchedulerError;
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

static STATIC_DIR: Dir = include_dir!("../client/dist");

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                format!("{}=debug,tower_http=debug", env!("CARGO_CRATE_NAME")).into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
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
        .fallback(static_handler)
        .layer(
            ServiceBuilder::new()
                .layer(from_fn(frontend_middleware))
                .layer(
                    TraceLayer::new_for_http()
                        .make_span_with(|req: &Request| {
                            let method = req.method();
                            let uri = req.uri();
                            let matched_path = req
                                .extensions()
                                .get::<MatchedPath>()
                                .map(|matched_path| matched_path.as_str());
                            tracing::debug_span!("request", %method, %uri, matched_path)
                        })
                        .on_failure(()),
                ),
        );
    let listener = TcpListener::bind("0.0.0.0:8080").await?;
    tracing::debug!("listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await?;
    Ok(())
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
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
                [(header::CONTENT_TYPE, mime_type)],
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

async fn get_all_alarms(
    State(AppState { alarm }): State<AppState>,
) -> Json<Vec<DbEntry<AlarmEntry>>> {
    let alarms = alarm.get_all_alarms().unwrap();
    Json(alarms)
}

async fn stop_alarm(State(AppState { alarm }): State<AppState>) {
    alarm.stop_alarm();
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
