use anyhow::Result;
use rusqlite::params;
use rusqlite::Connection;
use std::sync::Arc;
use std::sync::Mutex;

#[derive(Debug)]
pub struct CronEntry {
    pub id: i64,
    pub value: String,
    pub is_enabled: bool,
}

#[derive(Clone)]
pub struct Db {
    conn: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn initialise() -> Result<Self> {
        let conn = Connection::open("cron.db")?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS crons (
            id INTEGER PRIMARY KEY,
            value TEXT NOT NULL,
            is_enabled INTEGER NOT NULL
        )",
            [],
        )?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn get_all_crons(&self) -> Result<Vec<CronEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, value, is_enabled FROM crons")?;
        let crons: Result<_, _> = stmt
            .query_map([], |row| {
                Ok(CronEntry {
                    id: row.get(0)?,
                    value: row.get(1)?,
                    is_enabled: row.get(2)?,
                })
            })?
            .collect();
        Ok(crons?)
    }

    pub fn insert_cron(&self, cron: &str, is_enabled: bool) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO crons (value, is_enabled) VALUES (?1, ?2)",
            params![cron, is_enabled],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete_cron(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM crons WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_cron(&self, id: i64, new_value: &str, is_enabled: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE crons SET value = ?1, is_enabled = ?2 WHERE id = ?3",
            params![new_value, is_enabled, id],
        )?;
        Ok(())
    }
}
