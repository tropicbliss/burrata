use anyhow::Result;
use jiff::{civil::Weekday, Zoned};
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    time::Duration,
};
use thiserror::Error;
use tokio::task::AbortHandle;

use crate::alarm::AlarmId;

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
}

impl Scheduler {
    pub fn new() -> Self {
        Self {
            id_mapping: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn add_schedule<F>(&self, id: AlarmId, schedule: SchedulerEntry, mut task: F) -> Result<()>
    where
        F: FnMut() + 'static,
    {
        let mut id_mapping = self.id_mapping.lock().unwrap();
        if id_mapping.contains_key(&id) {
            return Err(SchedulerError::DuplicateKey.into());
        }
        let handle = tokio::task::spawn_local(async move {
            let mut alarm_time = Zoned::now();
            loop {
                alarm_time = if schedule.days.is_empty() {
                    alarm_time.tomorrow().unwrap()
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
        });
        id_mapping.insert(id, handle.abort_handle());
        Ok(())
    }

    pub fn cancel_schedule(&mut self, id: AlarmId) {
        let mut id_mapping = self.id_mapping.lock().unwrap();
        if let Some(abort_handle) = id_mapping.remove(&id) {
            abort_handle.abort();
        }
    }
}
