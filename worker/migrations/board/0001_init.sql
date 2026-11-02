CREATE TABLE `device` (
    `id_device`        INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    `token_hash`       BLOB     NOT NULL,
    `nickname`         TEXT     NOT NULL,
    `streak_current`   INTEGER  NOT NULL DEFAULT 0,
    `streak_best`      INTEGER  NOT NULL DEFAULT 0,
    `streak_last_day`  INTEGER  NULL,
    `created_at`       INTEGER  NOT NULL,
    `last_seen_at`     INTEGER  NOT NULL
);
CREATE UNIQUE INDEX `device_token_hash` ON `device` (`token_hash`);
CREATE INDEX `device_streak_best` ON `device` (`streak_best`);
CREATE INDEX `device_last_seen_at` ON `device` (`last_seen_at`);

CREATE TABLE `board_entry` (
    `kind`         TEXT     NOT NULL,  -- 'speed' | 'score' | 'daily'
    `map`          TEXT     NOT NULL,
    `day`          INTEGER  NOT NULL DEFAULT 0,  -- day number; 0 unless kind = 'daily'
    `sim_version`  INTEGER  NOT NULL,
    `id_device`    INTEGER  NOT NULL,
    `ticks`        INTEGER  NULL,
    `score`        INTEGER  NULL,
    `money`        INTEGER  NULL,
    `play_time`    INTEGER  NULL,
    `updated_at`   INTEGER  NOT NULL,
    PRIMARY KEY (`kind`, `map`, `day`, `sim_version`, `id_device`)
);
CREATE INDEX `board_entry_ticks` ON `board_entry` (`kind`, `map`, `day`, `sim_version`, `ticks`);
CREATE INDEX `board_entry_score` ON `board_entry` (`kind`, `map`, `day`, `sim_version`, `score`);
CREATE INDEX `board_entry_device` ON `board_entry` (`id_device`);

CREATE TABLE `quota` (
    `day`    INTEGER  NOT NULL PRIMARY KEY,  -- UTC day number
    `count`  INTEGER  NOT NULL
);
