-- ============================================================================
--  D1 数据库结构（在 Cloudflare 面板的 D1 控制台里粘贴执行一次即可）
--  或者在本地装了 Node 后执行：npx wrangler d1 execute <库名> --remote --file=./schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS images (
  id          TEXT    PRIMARY KEY,              -- 随机 UUID
  r2_key      TEXT    NOT NULL UNIQUE,          -- R2 里的对象路径，例如 2026/05/xxx.jpg
  name        TEXT    NOT NULL DEFAULT '',      -- 标题
  description TEXT    NOT NULL DEFAULT '',      -- 描述
  tags        TEXT    NOT NULL DEFAULT '',      -- 标签，英文逗号分隔，如 日常,风景
  album       TEXT    NOT NULL DEFAULT '未分类', -- 相册 / 分类
  mime        TEXT    NOT NULL DEFAULT '',      -- image/jpeg
  size        INTEGER NOT NULL DEFAULT 0,       -- 字节
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  visibility  TEXT    NOT NULL DEFAULT 'public',-- public | private
  fav         INTEGER NOT NULL DEFAULT 0,       -- 1 = 收藏
  created_at  INTEGER NOT NULL,                 -- 毫秒时间戳
  updated_at  INTEGER NOT NULL
);

-- 常用查询加索引，能显著减少 D1 的「行读取」消耗
CREATE INDEX IF NOT EXISTS idx_images_created ON images (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_album   ON images (album);
CREATE INDEX IF NOT EXISTS idx_images_fav     ON images (fav);

-- 想确认建好了没有：
-- SELECT name FROM sqlite_master WHERE type = 'table';

-- ============================================================================
--  小文本板块：随手记 / 公告 ……（可以在网站上直接编辑的内容）
--  用 note_key 区分不同板块，例如 notice、about、links
-- ============================================================================

CREATE TABLE IF NOT EXISTS notes (
  note_key   TEXT    PRIMARY KEY,
  title      TEXT    NOT NULL DEFAULT '',
  body       TEXT    NOT NULL DEFAULT '',   -- 多段文字用 \n 分隔
  tags       TEXT    NOT NULL DEFAULT '',   -- 逗号分隔
  updated_at INTEGER NOT NULL
);

-- ============================================================================
--  音频：上传到 R2 的音源，音乐页从 /api/tracks 拉取
--  文件本身走 /api/file/<r2_key> 读取（支持 Range，所以进度条能拖动）
-- ============================================================================

CREATE TABLE IF NOT EXISTS tracks (
  id          TEXT    PRIMARY KEY,
  r2_key      TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL DEFAULT '',       -- 曲名
  artist      TEXT    NOT NULL DEFAULT '',       -- 歌手
  album       TEXT    NOT NULL DEFAULT '未分类',
  duration    REAL    NOT NULL DEFAULT 0,        -- 秒
  size        INTEGER NOT NULL DEFAULT 0,        -- 字节
  mime        TEXT    NOT NULL DEFAULT '',
  lyrics      TEXT    NOT NULL DEFAULT '',       -- 纯文本或 LRC
  visibility  TEXT    NOT NULL DEFAULT 'public',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks (created_at DESC);

-- ============================================================================
--  留言板：访客留言（匿名可写，其余写操作仍然需要口令）
--  ip_hash 存的是 IP + 盐的哈希，不存原始 IP，用于限流和溯源
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT    PRIMARY KEY,
  name       TEXT    NOT NULL DEFAULT '',
  content    TEXT    NOT NULL DEFAULT '',
  contact    TEXT    NOT NULL DEFAULT '',   -- 可选：邮箱 / 主页
  ip_hash    TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_ip      ON messages (ip_hash, created_at);
