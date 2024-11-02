use crate::{
    cron,
    db::{CronEntry, Db},
    AlarmEntry,
};
use anyhow::Result;
use chrono::Local;
use rodio::{Decoder, OutputStream, Sink, Source};
use std::{
    collections::HashSet,
    io::Cursor,
    sync::mpsc::{self, Sender},
    time::Duration,
};
use tokio_cron::{Job, Scheduler};

#[derive(Clone, Copy)]
pub struct AlarmId(pub i64);

enum AlarmMessage {
    Start,
    Stop,
}

#[derive(Clone)]
pub struct Alarm {
    db: Db,
    scheduler: Scheduler<Local>,
    tx: Sender<AlarmMessage>,
}

impl Alarm {
    pub fn initialise() -> Result<Self> {
        let mut scheduler = Scheduler::local();
        let db: Db = Db::initialise()?;
        let initial: Vec<CronEntry> = db.get_all_crons()?;
        let (tx, rx) = mpsc::channel();
        for cron in initial {
            let tx = tx.clone();
            scheduler.add(Job::named(&cron.id.to_string(), cron.value, move || {
                alarm_job(tx.clone())
            }));
        }
        std::thread::spawn(move || {
            let alarm = include_bytes!("../sounds/Alarm_Classic.wav");
            let (_stream, stream_handle) = OutputStream::try_default()?;
            let sink = Sink::try_new(&stream_handle)?;
            let cursor = Cursor::new(alarm);
            let decoder = Decoder::new_wav(cursor)?
                .repeat_infinite()
                .fade_in(Duration::from_secs(3));
            while let Ok(message) = rx.recv() {
                match message {
                    AlarmMessage::Start if sink.empty() => {
                        sink.append(decoder.clone());
                    }
                    AlarmMessage::Stop => {
                        sink.stop();
                    }
                    _ => {}
                }
            }
            Ok::<(), anyhow::Error>(())
        });
        Ok(Self { db, scheduler, tx })
    }

    pub fn get_all_crons(&self) -> Result<Vec<AlarmEntry>> {
        Ok(self
            .db
            .get_all_crons()?
            .into_iter()
            .map(|entry| AlarmEntry {
                alarm: cron::parse_cron(&entry.value),
                id: entry.id,
                is_enabled: entry.is_enabled,
            })
            .collect())
    }

    pub fn add_alarm(
        &mut self,
        is_enabled: bool,
        hours: u8,
        minutes: u8,
        days: HashSet<u8>,
    ) -> Result<AlarmId> {
        let cron = cron::create_cron(hours, minutes, days.into_iter().collect())?;
        let id = self.db.insert_cron(&cron, is_enabled)?;
        if is_enabled {
            let tx = self.tx.clone();
            self.scheduler
                .add(Job::named(&id.to_string(), cron, move || {
                    alarm_job(tx.clone())
                }));
        }
        Ok(AlarmId(id))
    }

    pub fn remove_alarm(&mut self, id: AlarmId) -> Result<()> {
        self.db.delete_cron(id.0)?;
        self.scheduler.cancel_by_name(&id.0.to_string());
        Ok(())
    }

    pub fn update_alarm(
        &mut self,
        id: AlarmId,
        is_enabled: bool,
        new_hours: u8,
        new_minutes: u8,
        new_days: HashSet<u8>,
    ) -> Result<()> {
        let cron = cron::create_cron(new_hours, new_minutes, new_days.into_iter().collect())?;
        self.db.update_cron(id.0, &cron, is_enabled)?;
        self.scheduler.cancel_by_name(&id.0.to_string());
        if is_enabled {
            let tx = self.tx.clone();
            self.scheduler
                .add(Job::named(&id.0.to_string(), cron, move || {
                    alarm_job(tx.clone())
                }));
        }
        Ok(())
    }

    pub fn stop_alarm(&self) {
        self.tx.send(AlarmMessage::Stop).unwrap();
    }
}

async fn alarm_job(tx: Sender<AlarmMessage>) {
    tx.send(AlarmMessage::Start).unwrap();
}
