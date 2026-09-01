<script setup lang="ts">
import { statusLabels, statusDotColor } from '~/utils/absensi'

interface SiswaItem {
  id: number
  nisn: string
  nama: string
  request: {
    id: number
    status: string
    scannedAt: string
    keterangan: string | null
    approvedByRole: string | null
  } | null
}

interface GuruBerhalangan {
  id: number
  alasan: string
  keterangan: string | null
  guru: { id: number; nama: string }
}

interface SesiDetail {
  id: number
  status: string
  tanggal: string
  ditutupPada: string | null
  approvedByRole: string | null
  petugasPiketNama: string | null
  jadwal: {
    mapel: string
    jamMulai: string
    jamSelesai: string
    kelas: { id: number; nama: string; siswa: { id: number; nisn: string; nama: string }[] }
    ruangan: { id: number; nama: string }
    guru: { id: number; nama: string }
  }
  guruBerhalangan: GuruBerhalangan | null
  allSiswa: SiswaItem[]
}

const alasanLabels: Record<string, string> = {
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  DINAS_LUAR: 'Dinas Luar',
  LAINNYA: 'Lainnya'
}

const sessionStatusLabels: Record<string, string> = {
  SELESAI: 'Selesai',
  DITUNGGU: 'Menunggu',
  DIBATALKAN: 'Dibatalkan'
}

function fmtStatus(s: string) {
  return sessionStatusLabels[s] || s.charAt(0) + s.slice(1).toLowerCase()
}

const route = useRoute()
const sesiId = computed(() => parseInt(route.params.id as string))

const { data: sesi, pending, error } = useFetch<SesiDetail>(`/api/piket/sesi/${sesiId.value}`, {
  immediate: true
})

function statusOf(s: SiswaItem): string {
  return s.request?.status || 'BELUM'
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const statusCount = computed(() => {
  const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0, PENDING: 0, BELUM: 0 }
  for (const s of sesi.value?.allSiswa || []) {
    counts[statusOf(s)] = (counts[statusOf(s)] || 0) + 1
  }
  return counts
})

const totalSiswa = computed(() => sesi.value?.allSiswa.length || 0)
const persentaseHadir = computed(() =>
  totalSiswa.value ? Math.round((statusCount.value.HADIR / totalSiswa.value) * 100) : 0
)

const searchQuery = ref('')
const statusFilter = ref('')
const displaySiswa = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const all = sesi.value?.allSiswa || []
  let filtered = !q
    ? all
    : all.filter(s => s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q))
  if (statusFilter.value) {
    filtered = filtered.filter(s => statusOf(s) === statusFilter.value)
  }
  return [...filtered].sort((a, b) => a.nama.localeCompare(b.nama))
})

const page = ref(1)
const pageSize = 10
const totalPages = computed(() => Math.max(1, Math.ceil(displaySiswa.value.length / pageSize)))
const visibleSiswa = computed(() => {
  const start = (page.value - 1) * pageSize
  return displaySiswa.value.slice(start, start + pageSize)
})

watch([searchQuery, statusFilter], () => { page.value = 1 })
watch(totalPages, () => { if (page.value > totalPages.value) page.value = totalPages.value })
</script>

<template>
  <PiketLayout>
    <!-- Back Button -->
    <div class="mb-4">
      <NuxtLink to="/piket/riwayat" class="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Riwayat
      </NuxtLink>
    </div>

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="5" />

    <div
      v-else-if="error"
      class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-16 text-center"
    >
      <p class="text-gray-500 dark:text-gray-400 font-medium">Gagal memuat detail sesi</p>
    </div>

    <template v-else-if="sesi">
      <!-- Session Info -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.mapel }}</p>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="sesi.status === 'SELESAI' ? 'bg-emerald-500' : 'bg-gray-400'"></span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ fmtStatus(sesi.status) }}</span>
          </span>
        </div>

        <dl class="space-y-1.5 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">PTK Pengajar</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.guru.nama }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Kelas</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.kelas.nama }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Ruangan</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.ruangan.nama }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Waktu</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.jamMulai }} - {{ sesi.jadwal.jamSelesai }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Tanggal</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ fmtDate(sesi.tanggal) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Total Siswa</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ totalSiswa }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">Persentase Hadir</dt>
            <dd class="font-semibold" :class="persentaseHadir >= 90 ? 'text-emerald-600 dark:text-emerald-400' : persentaseHadir >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'">{{ persentaseHadir }}%</dd>
          </div>
        </dl>
      </div>

      <!-- Guru Berhalangan Info -->
      <div v-if="sesi.guruBerhalangan" class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200/80 dark:border-slate-700/80 px-4 py-3 mb-4">
        <p class="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1.5">PTK Berhalangan</p>
        <dl class="space-y-1 text-xs">
          <div class="flex items-center gap-2">
            <dt class="text-gray-500 dark:text-gray-400">Alasan:</dt>
            <dd class="font-medium text-gray-900 dark:text-gray-100">{{ alasanLabels[sesi.guruBerhalangan.alasan] || sesi.guruBerhalangan.alasan }}</dd>
          </div>
          <div v-if="sesi.guruBerhalangan.keterangan" class="flex items-center gap-2">
            <dt class="text-gray-500 dark:text-gray-400">Keterangan:</dt>
            <dd class="text-gray-900 dark:text-gray-100">{{ sesi.guruBerhalangan.keterangan }}</dd>
          </div>
        </dl>
      </div>

      <!-- Petugas Piket Info -->
      <div v-if="sesi.petugasPiketNama" class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200/80 dark:border-slate-700/80 px-4 py-3 mb-4">
        <p class="text-xs text-gray-500 dark:text-gray-400">Disetujui oleh: <span class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.petugasPiketNama }}</span></p>
      </div>

      <!-- Search & Filter -->
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <div class="relative max-w-xs flex-1 min-w-[180px]">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" placeholder="Cari nama atau NISN..."
            class="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </div>
        <select v-model="statusFilter"
          class="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
          <option value="">Semua Status</option>
          <option value="HADIR">Hadir</option>
          <option value="SAKIT">Sakit</option>
          <option value="IZIN">Izin</option>
          <option value="ALPHA">Alpha</option>
          <option value="PENDING">Menunggu</option>
          <option value="BELUM">Belum Absen</option>
        </select>
      </div>

      <!-- Siswa Table -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <th class="text-left px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Nama</th>
                <th class="text-left px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs hidden sm:table-cell">NISN</th>
                <th class="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Status</th>
                <th class="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs hidden md:table-cell">Keterangan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
              <tr v-if="displaySiswa.length === 0">
                <td colspan="4" class="px-3 py-12 text-center text-sm text-gray-400 dark:text-gray-500">Tidak ada siswa ditemukan</td>
              </tr>
              <tr v-for="s in visibleSiswa" :key="s.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="px-3 py-3">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ s.nama }}</span>
                </td>
                <td class="px-3 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{{ s.nisn }}</td>
                <td class="px-3 py-3 text-center">
                  <span v-if="statusOf(s) === 'HADIR'" class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <span class="w-2 h-2 rounded-full bg-green-500"></span>
                    Hadir
                  </span>
                  <span v-else-if="statusOf(s) === 'BELUM'" class="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    <span class="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                    Belum absen
                  </span>
                  <span v-else class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <span :class="['w-2 h-2 rounded-full', statusDotColor[statusOf(s)] || 'bg-gray-400']" />
                    {{ statusLabels[statusOf(s)] || statusOf(s) }}
                  </span>
                </td>
                <td class="px-3 py-3 text-center hidden md:table-cell">
                  <span class="text-xs text-gray-400 dark:text-gray-500">{{ s.request?.keterangan || '-' }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="displaySiswa.length > pageSize" class="px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Menampilkan {{ ((page - 1) * pageSize) + 1 }}-{{ Math.min(page * pageSize, displaySiswa.length) }} dari {{ displaySiswa.length }}
          </p>
          <div class="ml-auto flex items-center gap-2">
            <button
              @click="page--"
              :disabled="page <= 1"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              Sebelumnya
            </button>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ page }}/{{ totalPages }}</span>
            <button
              @click="page++"
              :disabled="page >= totalPages"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Selanjutnya
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </PiketLayout>
</template>
