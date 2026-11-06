module.exports.up = db => {
  const columns = new Set(db.prepare('PRAGMA table_info(code_submissions)').all().map(column => column.name))
  if (!columns.has('grade')) db.exec('ALTER TABLE code_submissions ADD COLUMN grade REAL')
  if (!columns.has('feedback')) db.exec("ALTER TABLE code_submissions ADD COLUMN feedback TEXT NOT NULL DEFAULT ''")
  if (!columns.has('status')) db.exec("ALTER TABLE code_submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted'")
  if (!columns.has('graded_by')) db.exec('ALTER TABLE code_submissions ADD COLUMN graded_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL')
  if (!columns.has('graded_at')) db.exec('ALTER TABLE code_submissions ADD COLUMN graded_at DATETIME')
}
