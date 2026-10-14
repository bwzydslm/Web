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
