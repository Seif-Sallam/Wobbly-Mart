CREATE TABLE `replay` (
    `day`        INTEGER  NOT NULL,
    `id_device`  INTEGER  NOT NULL,
    `ticks`      INTEGER  NOT NULL,
    `data`       BLOB     NOT NULL,  -- gzipped Replay, <= 64 KB
    PRIMARY KEY (`day`, `id_device`)
);
CREATE INDEX `replay_day_ticks` ON `replay` (`day`, `ticks`);
CREATE INDEX `replay_device` ON `replay` (`id_device`);
