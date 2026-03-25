// データベースの初期化と接続を管理するファイル
// better-sqlite3を使ってSQLiteに接続します

import Database from 'better-sqlite3';
import path from 'path';

// データベースファイルのパス（プロジェクトルートに保存）
const DB_PATH = path.join(process.cwd(), 'recipe.db');

// データベース接続を作成（ファイルがなければ自動作成）
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    // パフォーマンス向上のための設定
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // テーブルの初期化
    initDb(db);
  }
  return db;
}

// テーブルを作成する関数
function initDb(db: Database.Database) {
  // 元レシピのURL情報を保存するテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      raw_html TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // レシピのメイン情報（最新版へのポインタ）
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES sources(id),
      current_version_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // レシピの各版（編集するたびに新しい行が追加される）
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipeVersions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id),
      version_number INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      image_url TEXT,
      memo TEXT,
      change_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // 版ごとの材料リスト
  db.exec(`
    CREATE TABLE IF NOT EXISTS versionIngredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL REFERENCES recipeVersions(id),
      ingredient_group TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      amount TEXT
    )
  `);

  // 既存DBにingredient_groupカラムがなければ追加
  try {
    db.exec(`ALTER TABLE versionIngredients ADD COLUMN ingredient_group TEXT`);
  } catch {
    // カラムが既に存在する場合は無視
  }

  // 版ごとの手順リスト
  db.exec(`
    CREATE TABLE IF NOT EXISTS versionSteps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL REFERENCES recipeVersions(id),
      step_number INTEGER NOT NULL,
      description TEXT NOT NULL
    )
  `);

  // タグのマスターテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // レシピとタグの中間テーブル（多対多の関係）
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipeTags (
      recipe_id INTEGER NOT NULL REFERENCES recipes(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (recipe_id, tag_id)
    )
  `);
}
