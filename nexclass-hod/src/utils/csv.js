export function toCSV(headers, rows) {
  const escapeCell = (value) => {
    let text = String(value ?? '')
    if (/^[=+\-@\t]/.test(text)) text = `'${text}`
    return /[",\r\n]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text
  }
  return [headers.map(escapeCell).join(','), ...rows.map(row => headers.map(header => escapeCell(row[header])).join(','))].join('\r\n')
}
