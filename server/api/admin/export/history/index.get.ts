export default defineEventHandler(async () => {
  const list = await prisma.exportHistory.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { id: true, nama: true, email: true }
      }
    }
  })

  return list.map(item => ({
    id: item.id,
    jenis: item.jenis,
    judul: item.judul,
    filterJson: item.filterJson,
    filterLabel: item.filterLabel,
    format: item.format,
    fileName: item.fileName,
    fileSize: item.fileSize,
    createdAt: item.createdAt,
    userName: item.user.nama
  }))
})
