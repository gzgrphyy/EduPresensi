import ExcelJS from 'exceljs'

export function createStyledWorkbook() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'EduPresensi'
  workbook.lastModifiedBy = 'EduPresensi Admin'
  workbook.created = new Date()
  workbook.modified = new Date()
  return workbook
}

export function applyHeaderStyle(row: ExcelJS.Row, bgHex = '0A66A0') {
  row.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.height = 24

  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: bgHex.replace('#', '') }
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'medium', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    }
  })
}

export function applyTitleBlock(worksheet: ExcelJS.Worksheet, title: string, subtitle?: string, lastColLetter = 'H') {
  worksheet.mergeCells(`A1:${lastColLetter}1`)
  const titleCell = worksheet.getCell('A1')
  titleCell.value = title.toUpperCase()
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E293B' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  worksheet.getRow(1).height = 25

  if (subtitle) {
    worksheet.mergeCells(`A2:${lastColLetter}2`)
    const subCell = worksheet.getCell('A2')
    subCell.value = subtitle
    subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } }
    subCell.alignment = { vertical: 'middle', horizontal: 'left' }
    worksheet.getRow(2).height = 18
  }

  worksheet.addRow([]) // blank separator row
}

export function autoFitColumns(worksheet: ExcelJS.Worksheet, minWidth = 12) {
  worksheet.columns.forEach((column) => {
    let maxLen = 0
    if (column.eachCell) {
      column.eachCell({ includeEmpty: false }, (cell) => {
        // Skip merged title rows
        if (Number(cell.row) <= 3) return
        const valStr = cell.value ? String(cell.value) : ''
        if (valStr.length > maxLen) maxLen = valStr.length
      })
    }
    column.width = Math.max(maxLen + 4, minWidth)
  })
}

export function applyDataRowStyle(row: ExcelJS.Row, isEven = false) {
  row.font = { name: 'Arial', size: 9, color: { argb: 'FF1F2937' } }
  row.alignment = { vertical: 'middle' }
  row.height = 20

  row.eachCell((cell) => {
    if (isEven) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' }
      }
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    }
  })
}
