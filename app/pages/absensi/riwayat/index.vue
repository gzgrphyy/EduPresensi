<script setup lang="ts">
interface RiwayatItem {
  id: number
  tanggal: string
  mapel: string
  kelas: string
  ruangan: string
  totalSiswa: number
  hadir: number
  sakit: number
  izin: number
  alpha: number
  persentase: number
}

const { data, pending } = useFetch<RiwayatItem[]>('/api/absensi/rekap', {
  immediate: true,
  transform: (res: any) => res || []
})

const displayData = computed(() => data.value || [])

const totalMurid = computed(() => displayData.value.reduce((a, b) => a + b.totalSiswa, 0))

const rataPersentase = computed(() =>
  displayData.value.length
    ? (displayData.value.reduce((a, b) => a + b.persentase, 0) / displayData.value.length).toFixed(1)
    : '0'
)

function persentaseColor(p: number) {
  if (p >= 90) return 'text-green-600 dark:text-green-400'
  if (p >= 75) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

const showExportModal = ref(false)
const exporting = ref(false)
const exportBulan = ref<number | ''>(new Date().getMonth() + 1)
const exportTahun = ref<number | ''>(new Date().getFullYear())

const tahunOptions = computed(() => {
  const years = new Set<number>()
  for (const r of displayData.value) years.add(new Date(r.tanggal).getFullYear())
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
    if (exportTahun.value !== '') params.tahun = exportTahun.value
    if (exportTahun.value !== '' && exportBulan.value !== '') params.bulan = exportBulan.value
    const blob = await $fetch<Blob>('/api/absensi/riwayat/export', { responseType: 'blob', params })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Riwayat-Absensi-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showExportModal.value = false
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <PTKLayout>
    <PageHeader title="Riwayat Absensi" description="Riwayat sesi absensi yang telah selesai" :show-back="false">
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

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="5" />

    <template v-else>
      <div class="grid grid-cols-2 gap-4 mb-5">
        <StatCard label="Total Murid" :value="totalMurid" variant="blue" />
        <StatCard label="Rata-rata %" :value="rataPersentase + '%'" variant="green" />
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden">
      <div class="overflow-x-auto scrollbar-thin">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Tanggal</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Mapel</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Kelas</th>
              <th class="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Persentase</th>
              <th class="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs">Detail</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
            <tr v-for="item in displayData" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
              <td class="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ new Date(item.tanggal).toLocaleDateString('id-ID') }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 truncate max-w-[10rem]">{{ item.mapel }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[6rem]">{{ item.kelas }}</td>
              <td class="px-4 py-3 text-center font-semibold" :class="persentaseColor(item.persentase)">{{ item.persentase }}%</td>
              <td class="px-4 py-3 text-center">
                <NuxtLink :to="`/absensi/detail/${item.id}`"
                  class="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
                  Lihat
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </NuxtLink>
              </td>
            </tr>
            <tr v-if="displayData.length === 0">
              <td colspan="5" class="px-4 py-16 text-center">
                <p class="text-gray-500 dark:text-gray-400 font-medium">Belum ada riwayat absensi</p>
              </td>
            </tr>
          </tbody>
        </table>
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
  </PTKLayout>
</template>
