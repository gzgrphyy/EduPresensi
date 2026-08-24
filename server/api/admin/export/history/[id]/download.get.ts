export default defineEventHandler(async (event) => {
  const id = parseInt(event.context.params!.id, 10)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'ID riwayat tidak valid' })
  }

  const record = await prisma.exportHistory.findUnique({
    where: { id }
  })

  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Riwayat ekspor tidak ditemukan' })
  }

  let filters = {}
  try {
    filters = JSON.parse(record.filterJson)
  } catch {}

  // Forward internal call to generate endpoint logic
  return await $fetch('/api/admin/export/generate', {
    method: 'POST',
    body: {
      jenis: record.jenis,
      format: record.format,
      filters
    },
    headers: getRequestHeaders(event) as any
  })
})
