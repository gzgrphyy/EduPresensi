export default defineEventHandler(async (event) => {
  const type = event.context.params!.type
  const { bulan, kelasId } = getQuery(event)

  const exportTypeMap: Record<string, { label: string; description: string }> = {
    'rekap-harian': { label: 'Rekap Harian', description: 'Data absensi harian semua kelas' },
    'rekap-bulanan': { label: 'Rekap Bulanan', description: 'Rekapitulasi bulanan per siswa' },
    'rekap-kelas': { label: 'Rekap Kelas', description: 'Data kehadiran per kelas' },
    'data-siswa': { label: 'Data Siswa', description: 'Export data master siswa' },
    'data-guru': { label: 'Data Guru', description: 'Export data master guru' },
  }

  if (!exportTypeMap[type]) {
    throw createError({ statusCode: 400, statusMessage: `Tipe export "${type}" tidak dikenal` })
  }

  switch (type) {
    case 'rekap-harian': {
      const today = new Date(new Date().toISOString().split('T')[0])

      // Include all sessions for today (active and completed)
      const sesiList = await prisma.sesiAbsensi.findMany({
        where: {
          tanggal: today
        },
        include: {
          jadwal: {
            include: {
              kelas: { select: { nama: true } },
              guru: { select: { nama: true } },
              ruangan: { select: { nama: true } }
            }
          },
          requests: {
            select: {
              status: true,
              siswa: { select: { nisn: true, nama: true } }
            }
          }
        }
      })

      const rows: string[] = ['Tanggal,Kelas,Mata Pelajaran,Guru,Ruangan,NISN,Nama Siswa,Status']
      for (const sesi of sesiList) {
        for (const req of sesi.requests) {
          rows.push([
            sesi.tanggal.toISOString().split('T')[0],
            `"${sesi.jadwal.kelas.nama}"`,
            `"${sesi.jadwal.mapel}"`,
            `"${sesi.jadwal.guru.nama}"`,
            `"${sesi.jadwal.ruangan.nama}"`,
            req.siswa.nisn,
            `"${req.siswa.nama}"`,
            req.status
          ].join(','))
        }
      }

      setResponseHeader(event, 'Content-Type', 'text/csv')
      setResponseHeader(event, 'Content-Disposition', `attachment; filename=rekap-harian-${today.toISOString().split('T')[0]}.csv`)
      return rows.join('\n')
    }

    case 'rekap-bulanan': {
      const bulanStr = (bulan as string) || new Date().toISOString().slice(0, 7)
      const [year, month] = bulanStr.split('-').map(Number)
      const startDate = new Date(Date.UTC(year, month - 1, 1))
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

      const sesi = await prisma.sesiAbsensi.findMany({
        where: {
          tanggal: { gte: startDate, lte: endDate },
          status: 'SELESAI'
        },
        include: {
          jadwal: {
            include: {
              kelas: { select: { nama: true } },
              guru: { select: { nama: true } },
              ruangan: { select: { nama: true } }
            }
          },
          requests: {
            include: {
              siswa: { select: { nisn: true, nama: true } }
            }
          }
        },
        orderBy: { tanggal: 'asc' }
      })

      const rows: string[] = ['Tanggal,Kelas,Mata Pelajaran,Guru,Ruangan,NISN,Nama Siswa,Status']
      for (const s of sesi) {
        for (const req of s.requests) {
          rows.push([
            s.tanggal.toISOString().split('T')[0],
            `"${s.jadwal.kelas.nama}"`,
            `"${s.jadwal.mapel}"`,
            `"${s.jadwal.guru.nama}"`,
            `"${s.jadwal.ruangan.nama}"`,
            req.siswa.nisn,
            `"${req.siswa.nama}"`,
            req.status
          ].join(','))
        }
      }

      setResponseHeader(event, 'Content-Type', 'text/csv')
      setResponseHeader(event, 'Content-Disposition', `attachment; filename=rekap-bulanan-${bulanStr}.csv`)
      return rows.join('\n')
    }

    case 'rekap-kelas': {
      const bulanStr = (bulan as string) || new Date().toISOString().slice(0, 7)
      const [year, month] = bulanStr.split('-').map(Number)
      const startDate = new Date(Date.UTC(year, month - 1, 1))
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

      // Get aggregated attendance data per kelas for the selected period
      const sesi = await prisma.sesiAbsensi.findMany({
        where: {
          tanggal: { gte: startDate, lte: endDate },
          status: 'SELESAI'
        },
        include: {
          jadwal: {
            include: {
              kelas: {
                include: {
                  _count: { select: { siswa: true } },
                  waliKelas: { select: { nama: true } }
                }
              },
              guru: { select: { nama: true } }
            }
          },
          requests: {
            select: { status: true }
          }
        },
        orderBy: { tanggal: 'asc' }
      })

      // Aggregate by kelas
      const kelasMap = new Map<string, {
        nama: string
        waliKelas: string
        totalSiswa: number
        hadir: number
        sakit: number
        izin: number
        alpha: number
        totalSesi: number
      }>()

      for (const s of sesi) {
        const nama = s.jadwal.kelas.nama
        if (!kelasMap.has(nama)) {
          kelasMap.set(nama, {
            nama,
            waliKelas: s.jadwal.kelas.waliKelas?.nama || '-',
            totalSiswa: s.jadwal.kelas._count.siswa,
            hadir: 0,
            sakit: 0,
            izin: 0,
            alpha: 0,
            totalSesi: 0
          })
        }
        const entry = kelasMap.get(nama)!
        entry.totalSesi++
        entry.hadir += s.requests.filter(r => r.status === 'HADIR').length
        entry.sakit += s.requests.filter(r => r.status === 'SAKIT').length
        entry.izin += s.requests.filter(r => r.status === 'IZIN').length
        entry.alpha += s.requests.filter(r => r.status === 'ALPHA').length
      }

      const rows: string[] = ['Kelas,Wali Kelas,Total Siswa,Total Sesi,Hadir,Sakit,Izin,Alpha,Persentase Kehadiran']
      for (const k of kelasMap.values()) {
        const totalExpected = k.totalSiswa * k.totalSesi
        const persentase = totalExpected > 0
          ? ((k.hadir / totalExpected) * 100).toFixed(1) + '%'
          : '0%'
        rows.push([
          `"${k.nama}"`,
          `"${k.waliKelas}"`,
          k.totalSiswa.toString(),
          k.totalSesi.toString(),
          k.hadir.toString(),
          k.sakit.toString(),
          k.izin.toString(),
          k.alpha.toString(),
          persentase
        ].join(','))
      }

      setResponseHeader(event, 'Content-Type', 'text/csv')
      setResponseHeader(event, 'Content-Disposition', `attachment; filename=rekap-kelas-${bulanStr}.csv`)
      return rows.join('\n')
    }

    case 'data-siswa': {
      const siswa = await prisma.siswa.findMany({
        include: {
          kelas: { select: { nama: true } },
          user: { select: { email: true } }
        },
        orderBy: { nama: 'asc' }
      })

      const rows: string[] = ['NISN,Nama,Kelas,Email,Nama Wali,Kontak Wali']
      for (const s of siswa) {
        rows.push([
          s.nisn,
          `"${s.nama}"`,
          `"${s.kelas.nama}"`,
          `"${s.user?.email || ''}"`,
          `"${s.namaWali || ''}"`,
          `"${s.kontakWali || ''}"`
        ].join(','))
      }

      setResponseHeader(event, 'Content-Type', 'text/csv')
      setResponseHeader(event, 'Content-Disposition', `attachment; filename=data-siswa.csv`)
      return rows.join('\n')
    }

    case 'data-guru': {
      const guru = await prisma.user.findMany({
        where: { role: 'GURU' },
        select: {
          nama: true,
          nip: true,
          email: true,
          isActive: true,
          kelasWali: { select: { nama: true } }
        },
        orderBy: { nama: 'asc' }
      })

      const rows: string[] = ['Nama,NIP,Email,Aktif,Wali Kelas']
      for (const g of guru) {
        rows.push([
          `"${g.nama}"`,
          `"${g.nip || ''}"`,
          `"${g.email}"`,
          g.isActive ? 'Aktif' : 'Nonaktif',
          `"${g.kelasWali.map(k => k.nama).join(', ')}"`
        ].join(','))
      }

      setResponseHeader(event, 'Content-Type', 'text/csv')
      setResponseHeader(event, 'Content-Disposition', `attachment; filename=data-guru.csv`)
      return rows.join('\n')
    }

    default:
      throw createError({ statusCode: 400, statusMessage: `Tipe export "${type}" tidak dikenal` })
  }
})
