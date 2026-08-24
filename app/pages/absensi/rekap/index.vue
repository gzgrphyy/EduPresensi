<script setup lang="ts">
interface RekapItem {
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

interface MingguanJadwal {
  id: number
  hari: string
  mapel: string
  jamMulai: string
  jamSelesai: string
  kelas: { id: number; nama: string }
  ruangan: { id: number; nama: string }
}

const { data, pending } = useFetch<RekapItem[]>('/api/absensi/rekap', {
  immediate: true,
  transform: (res: any) => res || []
})

const { data: jadwalMingguan, pending: pendingMingguan } = useFetch<{ hariOrder: string[]; grouped: Record<string, MingguanJadwal[]> }>('/api/absensi/jadwal-mingguan', {
  immediate: true
})

const route = useRoute()

watch([pending, pendingMingguan], ([p1, p2]) => {
  if (!p1 && !p2 && route.hash === '#jadwal-minggu') {
    nextTick(() => {
      document.getElementById('jadwal-minggu')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
})

const displayData = computed(() => data.value || [])

const hariLabels: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis', JUMAT: 'Jumat', SABTU: 'Sabtu', MINGGU: 'Minggu'
}
const dayNames = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
const todayName = dayNames[new Date().getDay()]

const hariOrder = computed(() => jadwalMingguan.value?.hariOrder || [])
const hasWeeklyJadwal = computed(() =>
  Object.values(jadwalMingguan.value?.grouped || {}).some(arr => arr.length > 0)
)
const groupedJadwal = computed(() => jadwalMingguan.value?.grouped || {})

const totalHadir = computed(() => displayData.value.reduce((a, b) => a + b.hadir, 0))
const totalSiswa = computed(() => displayData.value.reduce((a, b) => a + b.totalSiswa, 0))
const rataPersentase = computed(() =>
  displayData.value.length ? (displayData.value.reduce((a, b) => a + b.persentase, 0) / displayData.value.length).toFixed(1) : '0'
)

const selectedHari = ref('')

const availableHari = computed(() =>
  hariOrder.value.filter(h => (groupedJadwal.value[h] || []).length > 0)
)

const selectedJadwal = computed(() =>
  groupedJadwal.value[selectedHari.value] || []
)

watch(availableHari, (days) => {
  if (days.length && !selectedHari.value) {
    selectedHari.value = days.includes(todayName) ? todayName : days[0]
  }
}, { immediate: true })
</script>

<template>
  <PTKLayout>
    <PageHeader title="Rekap Absensi" description="Rekapitulasi kehadiran berdasarkan jadwal" :show-back="false">
      <template #actions>
        <NuxtLink
          to="/absensi/export"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 active:bg-primary-700 transition-colors shadow-md shadow-primary-500/30"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </NuxtLink>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="pending" type="table" :rows="4" :columns="5" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Total Sesi" :value="displayData.length" variant="blue" />
        <StatCard label="Total Hadir" :value="totalHadir" variant="green" />
        <StatCard label="Rata-rata %" :value="rataPersentase + '%'" variant="green" />
      </div>

      <BaseCard>
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs tracking-wider">Tanggal</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs tracking-wider">Mata Pelajaran</th>
              <th class="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs tracking-wider">Kelas</th>
              <th class="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs tracking-wider">Persentase</th>
              <th class="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs tracking-wider">Detail</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
            <tr v-for="item in displayData" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
              <td class="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ new Date(item.tanggal).toLocaleDateString('id-ID') }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 truncate max-w-[10rem]">{{ item.mapel }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300 truncate max-w-[6rem]">{{ item.kelas }}</td>
              <td class="px-4 py-3 text-center font-semibold" :class="item.persentase >= 90 ? 'text-green-600' : item.persentase >= 75 ? 'text-amber-600' : 'text-red-600'">{{ item.persentase }}%</td>
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
                <p class="text-gray-500 dark:text-gray-400 font-medium">Belum ada data rekap</p>
              </td>
            </tr>
          </tbody>
        </table>
      </BaseCard>

      <BaseCard id="jadwal-minggu" class="mt-5 scroll-mt-24">
        <div class="flex items-end justify-between mb-4">
          <h2 class="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">Jadwal Minggu Ini</h2>
        </div>

        <div v-if="!hasWeeklyJadwal" class="py-8 px-6 text-center">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Belum ada jadwal untuk minggu ini.</p>
        </div>

        <div v-else>
          <div class="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            <button
              v-for="h in availableHari"
              :key="h"
              @click="selectedHari = h"
              class="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors"
              :class="selectedHari === h
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'"
            >
              <span v-if="h === todayName && selectedHari !== h" class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
              {{ hariLabels[h] || h }}
            </button>
          </div>

          <div v-if="selectedJadwal.length > 0" class="space-y-2.5 mt-3">
            <div
              v-for="ij in selectedJadwal"
              :key="ij.id"
              class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden flex transition-colors"
              :class="{ 'ring-1 ring-primary-400 dark:ring-primary-500': selectedHari === todayName }"
            >
              <div class="w-1.5 flex-shrink-0 bg-primary-500"></div>
              <div class="flex-1 min-w-0 px-4 py-3.5 flex items-start gap-4">
                <div class="text-center flex-shrink-0 w-14 pt-0.5">
                  <p class="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{{ ij.jamMulai }}</p>
                  <p class="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{{ ij.jamSelesai }}</p>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ ij.mapel }}</p>
                  <div class="flex items-center gap-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span class="truncate">{{ ij.kelas.nama }}</span>
                    <span class="text-gray-300 dark:text-gray-600">&middot;</span>
                    <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span class="truncate">{{ ij.ruangan.nama }}</span>
                  </div>
                </div>
                <BaseBadge variant="primary" size="sm" class="flex-shrink-0 ml-1 mt-0.5 hidden sm:block">{{ ij.kelas.nama }}</BaseBadge>
              </div>
            </div>
          </div>

          <div v-else class="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-600">
            <div class="flex flex-col items-center py-10 px-4">
              <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Tidak ada jadwal {{ hariLabels[selectedHari] || '' }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Pilih hari lain di atas</p>
            </div>
          </div>
        </div>
      </BaseCard>
    </template>
  </PTKLayout>
</template>
