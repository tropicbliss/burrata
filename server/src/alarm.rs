use crate::{
    db::{Db, DbEntry},
    scheduler::{Scheduler, SchedulerEntry},
};
use anyhow::Result;
use jiff::civil::Weekday;
use rodio::{Decoder, OutputStream, Sink, Source};
use serde::{de::Visitor, Deserialize, Deserializer, Serialize, Serializer};
use std::{
    collections::HashSet,
    io::Cursor,
    sync::mpsc::{self, Sender},
    time::Duration,
};

#[derive(Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, Debug)]
pub struct AlarmId(pub i64);

impl From<AlarmId> for i64 {
    fn from(value: AlarmId) -> Self {
        value.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SerdeWeekday(Weekday);

impl Serialize for SerdeWeekday {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_i8(self.0.to_monday_one_offset())
    }
}

impl<'de> Deserialize<'de> for SerdeWeekday {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct SerdeWeekdayVisitor;

        impl<'de> Visitor<'de> for SerdeWeekdayVisitor {
            type Value = SerdeWeekday;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("an integer")
            }

            fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Ok(SerdeWeekday(
                    Weekday::from_monday_one_offset(v as i8)
                        .map_err(|_| E::custom("an integer between 1 and 7"))?,
                ))
            }
        }

        deserializer.deserialize_u64(SerdeWeekdayVisitor)
    }
}

impl From<SerdeWeekday> for Weekday {
    fn from(value: SerdeWeekday) -> Self {
        value.0
    }
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AlarmEntry {
    pub hours: u8,
    pub minutes: u8,
    pub days: HashSet<SerdeWeekday>,
    pub is_enabled: bool,
}

impl From<AlarmEntry> for SchedulerEntry {
    fn from(value: AlarmEntry) -> Self {
        SchedulerEntry {
            days: value.days.into_iter().map(|entry| entry.into()).collect(),
            hours: value.hours,
            minutes: value.minutes,
        }
    }
}

enum AlarmMessage {
    Start,
    Stop,
}

#[derive(Clone)]
pub struct Alarm {
    db: Db<AlarmEntry>,
    scheduler: Scheduler,
    tx: Sender<AlarmMessage>,
}

impl Alarm {
    pub fn initialise() -> Result<Self> {
        let mut scheduler = Scheduler::new();
        let db: Db<AlarmEntry> = Db::initialise("alarms.db")?;
        let db_clone = db.clone();
        scheduler.add_loop_done_callback(move |id| {
            let db = &db_clone;
            let mut entry = db.get(id.0).unwrap();
            entry.is_enabled = false;
            db.update(DbEntry {
                id: id.0,
                value: entry,
            })
            .unwrap();
        });
        let initial = db.get_all()?;
        let (tx, rx) = mpsc::channel();
        for alarm_entry in initial {
            let tx = tx.clone();
            scheduler.add_schedule(
                AlarmId(alarm_entry.id),
                alarm_entry.value.into(),
                move || alarm_job(tx.clone()),
            )?;
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

    pub fn get_all_alarms(&self) -> Result<Vec<DbEntry<AlarmEntry>>> {
        Ok(self.db.get_all()?)
    }

    pub fn add_alarm(&mut self, entry: AlarmEntry) -> Result<AlarmId> {
        let id = AlarmId(self.db.insert(&entry)?);
        if entry.is_enabled {
            let tx = self.tx.clone();
            self.scheduler
                .add_schedule(id, entry.into(), move || alarm_job(tx.clone()))?;
        }
        Ok(id)
    }

    pub fn remove_alarm(&mut self, id: AlarmId) -> Result<()> {
        self.db.delete(id.into())?;
        self.scheduler.cancel_schedule(id);
        Ok(())
    }

    pub fn update_alarm(&mut self, new_entry: DbEntry<AlarmEntry>) -> Result<()> {
        self.db.update(new_entry.clone())?;
        let id = AlarmId(new_entry.id);
        self.scheduler.cancel_schedule(id);
        if new_entry.value.is_enabled {
            let tx = self.tx.clone();
            self.scheduler
                .add_schedule(id, new_entry.value.into(), move || alarm_job(tx.clone()))?;
        }
        Ok(())
    }

    pub fn stop_alarm(&self) {
        self.tx.send(AlarmMessage::Stop).unwrap();
    }
}

fn alarm_job(tx: Sender<AlarmMessage>) {
    tx.send(AlarmMessage::Start).unwrap();
}
