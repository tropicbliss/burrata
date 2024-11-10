use anyhow::Result;
use bincode::ErrorKind;
use rusqlite::{params, Connection};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    marker::PhantomData,
    path::Path,
    sync::{Arc, Mutex},
};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DbEntry<T> {
    pub id: i64,
    #[serde(flatten)]
    pub value: T,
}

pub struct DbEntryInner {
    pub id: i64,
    pub value: Vec<u8>,
}

impl<T> TryFrom<DbEntryInner> for DbEntry<T>
where
    T: DeserializeOwned,
{
    type Error = Box<ErrorKind>;

    fn try_from(value: DbEntryInner) -> std::result::Result<Self, Self::Error> {
        Ok(DbEntry {
            id: value.id,
            value: bincode::deserialize(&value.value)?,
        })
    }
}

#[derive(Clone)]
pub struct Db<T> {
    conn: Arc<Mutex<Connection>>,
    _marker: PhantomData<T>,
}

impl<T> Db<T> {
    pub fn initialise<P>(path: P) -> Result<Self>
    where
        P: AsRef<Path>,
    {
        let conn = Connection::open(path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY,
            value BLOB NOT NULL
        )",
            [],
        )?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            _marker: PhantomData,
        })
    }

    pub fn delete(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM documents WHERE id = ?1", [id])?;
        Ok(())
    }
}

impl<T> Db<T>
where
    T: DeserializeOwned,
{
    pub fn get_all(&self) -> Result<Vec<DbEntry<T>>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, value FROM documents ORDER BY id")?;
        let data: Result<Vec<DbEntryInner>, _> = stmt
            .query_map([], |row| {
                Ok(DbEntryInner {
                    id: row.get(0)?,
                    value: row.get(1)?,
                })
            })?
            .collect();
        Ok(data?
            .into_iter()
            .map(|raw_entry| raw_entry.try_into())
            .collect::<Result<_, _>>()?)
    }
}

impl<T> Db<T>
where
    T: Serialize,
{
    pub fn insert(&self, value: &T) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let binary = bincode::serialize(value)?;
        conn.execute("INSERT INTO documents (value) VALUES (?1)", [binary])?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update(&self, new_entry: DbEntry<T>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let binary = bincode::serialize(&new_entry.value)?;
        conn.execute(
            "UPDATE documents SET value = ?1 WHERE id = ?2",
            params![binary, new_entry.id],
        )?;
        Ok(())
    }
}
