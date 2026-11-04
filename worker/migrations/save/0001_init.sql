CREATE TABLE `device_save` (
    `id_device`  INTEGER  NOT NULL PRIMARY KEY,
    `save_code`  BLOB     NOT NULL,  -- gzipped by the client
    `save_at`    INTEGER  NOT NULL
);
