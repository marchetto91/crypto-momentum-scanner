CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL NOT NULL,
  score INTEGER NOT NULL,
  ch15 REAL,
  ch60 REAL,
  vol_rel REAL,
  spread REAL,
  resistance REAL,
  candidate INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id INTEGER,
  symbol TEXT NOT NULL,
  entry REAL NOT NULL,
  stop REAL NOT NULL,
  target REAL NOT NULL,
  size_eur REAL NOT NULL,
  fee_rate REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  exit REAL,
  pnl_eur REAL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  close_reason TEXT,
  FOREIGN KEY(signal_id) REFERENCES signals(id)
);
CREATE TABLE IF NOT EXISTS bot_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO bot_state(key,value) VALUES
 ('starting_eur','150'),('last_scan',''),('last_error',''),('scan_count','0');
