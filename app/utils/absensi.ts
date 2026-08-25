export const statusLabels: Record<string, string> = {
  PENDING: 'Menunggu',
  BELUM: 'Belum Absen',
  HADIR: 'Hadir',
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  ALPHA: 'Alpha'
}

export const statusBadgeVariant: Record<string, string> = {
  PENDING: 'amber',
  BELUM: 'gray',
  HADIR: 'green',
  SAKIT: 'amber',
  IZIN: 'blue',
  ALPHA: 'red'
}

export const statusDotColor: Record<string, string> = {
  PENDING: 'bg-amber-400',
  BELUM: 'bg-gray-400',
  HADIR: 'bg-green-500',
  SAKIT: 'bg-amber-500',
  IZIN: 'bg-blue-500',
  ALPHA: 'bg-red-500'
}

export const jenisIzinLabels: Record<string, string> = {
  SAKIT: 'Sakit',
  IZIN: 'Izin'
}

export const statusIzinLabels: Record<string, string> = {
  PENDING: 'Menunggu',
  DISETUJUI: 'Disetujui',
  DITOLAK: 'Ditolak'
}

export const statusIzinBadgeVariant: Record<string, string> = {
  PENDING: 'amber',
  DISETUJUI: 'green',
  DITOLAK: 'red'
}

export const statusIzinDotColor: Record<string, string> = {
  PENDING: 'bg-amber-400',
  DISETUJUI: 'bg-green-500',
  DITOLAK: 'bg-red-500'
}
