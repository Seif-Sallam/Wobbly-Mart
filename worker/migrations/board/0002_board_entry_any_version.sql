-- One row per Device per Board, whatever the sim version; `sim_version` only records which version set the row.
-- Keeps each Device's newest-version row where it has several.
CREATE TABLE `board_entry_new` (
    `kind`         TEXT     NOT NULL,  -- 'speed' | 'score' | 'daily'
    `map`          TEXT     NOT NULL,
    `day`          INTEGER  NOT NULL DEFAULT 0,  -- day number; 0 unless kind = 'daily'
    `sim_version`  INTEGER  NOT NULL,  -- the version that set this row; never filtered on
    `id_device`    INTEGER  NOT NULL,
    `ticks`        INTEGER  NULL,
    `score`        INTEGER  NULL,
    `money`        INTEGER  NULL,
    `play_time`    INTEGER  NULL,
    `updated_at`   INTEGER  NOT NULL,
    PRIMARY KEY (`kind`, `map`, `day`, `id_device`)
);
INSERT INTO `board_entry_new`
SELECT `kind`, `map`, `day`, `sim_version`, `id_device`, `ticks`, `score`, `money`, `play_time`, `updated_at`
FROM `board_entry` b
WHERE `sim_version` = (
    SELECT MAX(`sim_version`) FROM `board_entry`
    WHERE `kind` = b.`kind` AND `map` = b.`map` AND `day` = b.`day` AND `id_device` = b.`id_device`
);
DROP TABLE `board_entry`;
ALTER TABLE `board_entry_new` RENAME TO `board_entry`;
CREATE INDEX `board_entry_ticks` ON `board_entry` (`kind`, `map`, `day`, `ticks`);
CREATE INDEX `board_entry_score` ON `board_entry` (`kind`, `map`, `day`, `score`);
CREATE INDEX `board_entry_device` ON `board_entry` (`id_device`);
