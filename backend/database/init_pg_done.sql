-- It creates a marker table so the healthcheck knows all init scripts completed.

CREATE TABLE IF NOT EXISTS _init_complete (
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO _init_complete DEFAULT VALUES;
