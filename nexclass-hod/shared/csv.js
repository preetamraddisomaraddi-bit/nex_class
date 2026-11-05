function toCSV(headers, rows) {
  const escape = value => {
    let text = String(value ?? '')
    if (/^[=+\-@\t]/.test(text)) text = `'${text}`
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [headers.map(escape).join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\r\n')
}

module.exports = { toCSV }
