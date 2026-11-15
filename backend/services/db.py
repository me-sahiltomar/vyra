"""
services/db.py
----------------
SQLite connection manager and schema initialization.

Connection strategy:
  - get_db()            → returns an open connection (caller must close)
  - db_connection()     → context manager (auto-closes on exit)
  - init_db()           → creates tables and seeds default data on first run

DB path is read from config.py which loads it from the .env file.
"""

import sqlite3
import logging
from contextlib import contextmanager
from config import DB_PATH

log = logging.getLogger("h2os.db")
log.debug(f"[DB] Using database at: {DB_PATH}")


def get_db() -> sqlite3.Connection:
    """
    Return an open, thread-safe SQLite connection.
    The caller is responsible for closing it.
    Use db_connection() if you want automatic cleanup.
    """
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db_connection():
    """
    Context manager for safe, auto-closing SQLite connections.

    Usage:
        with db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
            conn.commit()
    """
    conn = get_db()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """
    Create all tables and seed default data on first run.
    Safe to call multiple times — uses IF NOT EXISTS guards.
    """
    with db_connection() as conn:
        cursor = conn.cursor()

        # ── Meals ─────────────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS meals (
                id        TEXT PRIMARY KEY,
                name      TEXT NOT NULL,
                meal_type TEXT NOT NULL DEFAULT 'Snack',
                calories  REAL NOT NULL DEFAULT 0,
                protein   REAL NOT NULL DEFAULT 0,
                carbs     REAL NOT NULL DEFAULT 0,
                fats      REAL NOT NULL DEFAULT 0,
                fiber     REAL NOT NULL DEFAULT 0,
                timestamp TEXT NOT NULL
            )
        ''')

        # ── Habits ────────────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS habits (
                id       INTEGER PRIMARY KEY,
                name     TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'general',
                done     INTEGER NOT NULL DEFAULT 0,
                streak   INTEGER NOT NULL DEFAULT 0
            )
        ''')

        # ── Water Log ─────────────────────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS water_log (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                amount    REAL    NOT NULL,
                timestamp TEXT    NOT NULL,
                note      TEXT    NOT NULL DEFAULT ''
            )
        ''')

        # ── Users (for authentication) ───────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                email        TEXT    NOT NULL UNIQUE,
                password_hash TEXT   NOT NULL,
                created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_login   TEXT
            )
        ''')

        # ── Sleep State (single row) ───────────────────────────────────────────
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sleep_state (
                id      INTEGER PRIMARY KEY,
                hours   REAL    NOT NULL DEFAULT 0.0,
                quality INTEGER
            )
        ''')

        conn.commit()

        # ── Seed Habits if empty ───────────────────────────────────────────────
        cursor.execute("SELECT COUNT(*) FROM habits")
        if cursor.fetchone()[0] == 0:
            default_habits = [
                (0, "Morning Meditation",  "mindfulness", 1, 8),
                (1, "Drink 2.5L Water",    "hydration",   1, 14),
                (2, "No Sugar After 6pm",  "nutrition",   1, 5),
                (3, "10,000 Steps",        "fitness",     1, 3),
                (4, "No Phone Before Bed", "sleep",       0, 2),
                (5, "Morning Run",         "fitness",     0, 1),
            ]
            cursor.executemany(
                "INSERT INTO habits (id, name, category, done, streak) VALUES (?, ?, ?, ?, ?)",
                default_habits,
            )
            log.info("[DB] Seeded 6 default habits")

        # ── Seed Sleep State if empty ──────────────────────────────────────────
        cursor.execute("SELECT COUNT(*) FROM sleep_state")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO sleep_state (id, hours, quality) VALUES (1, 0.0, NULL)")
            log.info("[DB] Seeded default sleep_state row")

        conn.commit()
        
        # ── Create Performance Indexes ───────────────────────────────────────
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_water_log_timestamp ON water_log(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_habits_category ON habits(category)")
        
        log.info("[DB] Performance indexes created")
        conn.commit()
        log.info("[DB] Schema initialized successfully")


# Initialize on import
init_db()
