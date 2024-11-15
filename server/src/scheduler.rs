use crate::alarm::AlarmId;
use anyhow::Result;
use jiff::{civil::Weekday, Zoned};
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    time::Duration,
};
use thiserror::Error;
use tokio::task::AbortHandle;

#[derive(Error, Debug, Clone)]
pub enum SchedulerError {
    #[error("contains duplicate alarm key")]
    DuplicateKey,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchedulerEntry {
    pub hours: u8,
    pub minutes: u8,
    pub days: HashSet<Weekday>,
}

#[derive(Clone)]
pub struct Scheduler {
    id_mapping: Arc<Mutex<HashMap<AlarmId, AbortHandle>>>,
    on_loop_done: Option<Arc<dyn Fn(AlarmId) + Send + Sync + 'static>>,
}

impl Scheduler {
    pub fn new() -> Self {
        Self {
            id_mapping: Arc::new(Mutex::new(HashMap::new())),
            on_loop_done: None,
        }
    }

    pub fn cancel_schedule(&mut self, id: AlarmId) {
        let mut id_mapping = self.id_mapping.lock().unwrap();
        if let Some(abort_handle) = id_mapping.remove(&id) {
            abort_handle.abort();
        }
    }

    pub fn add_loop_done_callback<F>(&mut self, callback: F)
    where
        F: Fn(AlarmId) + Send + Sync + 'static,
    {
        self.on_loop_done = Some(Arc::new(callback));
    }

    pub fn add_schedule<G>(&self, id: AlarmId, schedule: SchedulerEntry, mut task: G) -> Result<()>
    where
        G: FnMut() + 'static + Send,
    {
        let mut id_mapping = self.id_mapping.lock().unwrap();
        if id_mapping.contains_key(&id) {
            return Err(SchedulerError::DuplicateKey.into());
        }
        let on_loop_done = self.on_loop_done.clone();
        let handle = tokio::task::spawn(async move {
            let mut alarm_time = Zoned::now();
            loop {
                alarm_time = if schedule.days.is_empty() {
                    let today_with_time = alarm_time
                        .with()
                        .hour(schedule.hours as i8)
                        .minute(schedule.minutes as i8)
                        .build()
                        .unwrap();
                    if today_with_time > alarm_time {
                        alarm_time
                    } else {
                        alarm_time.tomorrow().unwrap()
                    }
                } else {
                    schedule
                        .days
                        .iter()
                        .map(|&day| alarm_time.nth_weekday(1, day).unwrap())
                        .min()
                        .unwrap()
                }
                .with()
                .hour(schedule.hours as i8)
                .minute(schedule.minutes as i8)
                .build()
                .unwrap();
                let duration_until = Zoned::now().duration_until(&alarm_time);
                tokio::time::sleep(Duration::from_secs_f64(duration_until.as_secs_f64())).await;
                task();
                if schedule.days.is_empty() {
                    break;
                }
            }
            if let Some(on_loop_done) = on_loop_done {
                on_loop_done(id);
            }
        });
        id_mapping.insert(id, handle.abort_handle());
        Ok(())
    }
}
