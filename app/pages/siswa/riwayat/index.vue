<script setup lang="ts">
import { statusLabels, statusDotColor } from '~/utils/absensi'

interface RiwayatItem {
  id: number
  sesiId: number
  tanggal: string
  mapel: string
  kelas: string
  status: string
  keterangan: string | null
  scannedAt: string
  guru: string
  rating: {
    id: number
    rating: number
    tags: string | null
    komentar: string | null
  } | null
}

const { data: riwayat, pending, refresh } = useFetch<RiwayatItem[]>('/api/siswa/riwayat', { immediate: true })

const searchQuery = ref('')
const filterStatus = ref('')
const page = ref(1)
const pageSize = 10

const statusOptions = ['HADIR', 'SAKIT', 'IZIN', 'ALPHA', 'PENDING']

const filteredData = computed(() => {
  const rows = riwayat.value || []
  const q = searchQuery.value.trim().toLowerCase()
  return rows.filter(r => {
    if (filterStatus.value && r.status !== filterStatus.value) return false
    if (!q) return true
    const tanggal = new Date(r.tanggal).toLocaleDateString('id-ID').toLowerCase()
    const status = (statusLabels[r.status] || r.status).toLowerCase()
    return r.mapel.toLowerCase().includes(q) || r.kelas.toLowerCase().includes(q) || status.includes(q) || tanggal.includes(q)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize)))
const visibleData = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredData.value.slice(start, start + pageSize)
})

watch([searchQuery, filterStatus], () => { page.value = 1 })

const showExportModal = ref(false)
const exporting = ref(false)
const exportBulan = ref<number | ''>(new Date().getMonth() + 1)
const exportTahun = ref<number | ''>(new Date().getFullYear())

const tahunOptions = computed(() => {
  const years = new Set<number>()
  for (const r of riwayat.value || []) years.add(new Date(r.tanggal).getFullYear())
  if (years.size === 0) years.add(new Date().getFullYear())
  return [...years].sort((a, b) => b - a)
})

const bulanOptions = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const bulanSelectOptions = [
  { label: 'Semua Bulan', value: '' as const },
  ...bulanOptions.map((b, i) => ({ label: b, value: i + 1 }))
]

const tahunSelectOptions = computed(() =>
  tahunOptions.value.map(t => ({ label: String(t), value: t }))
)

async function downloadExport() {
  exporting.value = true
  try {
    const params: Record<string, string | number> = {}
    if (filterStatus.value) params.status = filterStatus.value
    if (exportTahun.value !== '') params.tahun = exportTahun.value
    if (exportTahun.value !== '' && exportBulan.value !== '') params.bulan = exportBulan.value
    const blob = await $fetch<Blob>('/api/siswa/riwayat/export', { responseType: 'blob', params })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Riwayat-Absensi-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <StudentLayout>
    <PageHeader title="Riwayat Absensi" description="Riwayat absensi pribadi" :show-back="false">
      <template #actions>
        <button
          type="button"
          @click="showExportModal = true"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 active:bg-primary-700 transition-colors shadow-md shadow-primary-500/30"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="4" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <div class="relative max-w-xs flex-1 min-w-[180px]">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" placeholder="Cari..."
            class="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </div>
        <select v-model="filterStatus"
          class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
          <option value="">Semua Status</option>
          <option v-for="s in statusOptions" :key="s" :value="s">{{ statusLabels[s] || s }}</option>
        </select>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden">
        <div class="overflow-x-auto scrollbar-thin">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Tanggal</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Mata Pelajaran</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Kelas</th>
                <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Jam</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Status</th>
                <th class="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Ulasan / Rating</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
              <tr v-for="item in visibleData" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300">{{ new Date(item.tanggal).toLocaleDateString('id-ID') }}</td>
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{{ item.mapel }}</td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{{ item.kelas }}</td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {{ item.scannedAt ? new Date(item.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-' }}
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full flex-shrink-0" :class="statusDotColor[item.status] || 'bg-gray-400'"></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ statusLabels[item.status] || item.status }}</span>
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span v-if="item.status === 'HADIR' && item.rating" class="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    ★ {{ item.rating.rating }}/5
                  </span>
                  <span v-else-if="item.status === 'HADIR'" class="text-xs text-gray-400">-</span>
                  <span v-else class="text-xs text-gray-400">-</span>
                </td>
              </tr>
              <tr v-if="filteredData.length === 0">
                <td colspan="6" class="px-4 py-16 text-center">
                  <p class="text-gray-500 dark:text-gray-400 font-medium">{{ searchQuery || filterStatus ? 'Tidak ada hasil yang cocok' : 'Belum ada riwayat absensi' }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="filteredData.length > pageSize" class="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            Menampilkan {{ ((page - 1) * pageSize) + 1 }}-{{ Math.min(page * pageSize, filteredData.length) }} dari {{ filteredData.length }}
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
            <span class="text-xs text-gray-400 dark:text-gray-500">Halaman {{ page }} dari {{ totalPages }}</span>
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

    <BaseModal :show="showExportModal" title="Export Riwayat" max-w="max-w-sm" @close="!exporting && (showExportModal = false)">
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Bulan</label>
          <BaseSelect v-model="exportBulan" :options="bulanSelectOptions" placeholder="Semua Bulan" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Tahun</label>
          <BaseSelect v-model="exportTahun" :options="tahunSelectOptions" placeholder="Pilih Tahun" />
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {{ filterStatus ? `Filter status "${statusLabels[filterStatus] || filterStatus}" ikut diterapkan.` : 'Seluruh status akan diexport.' }}
        </p>
      </div>
      <template #footer>
        <button
          type="button"
          :disabled="exporting"
          @click="showExportModal = false"
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Batal
        </button>
        <button
          type="button"
          :disabled="exporting"
          @click="downloadExport"
          class="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 active:bg-primary-700 rounded-xl transition-colors shadow-md shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg v-if="exporting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {{ exporting ? 'Mengunduh...' : 'Unduh Excel' }}
        </button>
      </template>
    </BaseModal>
  </StudentLayout>
</template>
