<script setup lang="ts">
interface MingguanJadwal {
  id: number
  hari: string
  mapel: string
  jamMulai: string
  jamSelesai: string
  kelas: { id: number; nama: string }
  ruangan: { id: number; nama: string }
}

const { data: jadwalMingguan, pending } = useFetch<{ hariOrder: string[]; grouped: Record<string, MingguanJadwal[]> }>('/api/absensi/jadwal-mingguan', {
  immediate: true
})

const route = useRoute()

watch(pending, (p) => {
  if (!p && route.hash === '#jadwal-minggu') {
    nextTick(() => {
      document.getElementById('jadwal-minggu')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
})

const hariLabels: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu', KAMIS: 'Kamis', JUMAT: 'Jumat', SABTU: 'Sabtu', MINGGU: 'Minggu'
}
const dayNames = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
const todayName = dayNames[new Date().getDay()]

const todayLabel = computed(() =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

const hariOrder = computed(() => jadwalMingguan.value?.hariOrder || [])
const hasWeeklyJadwal = computed(() =>
  Object.values(jadwalMingguan.value?.grouped || {}).some(arr => arr.length > 0)
)
const groupedJadwal = computed(() => jadwalMingguan.value?.grouped || {})

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
    <PageHeader title="Jadwal Mengajar" description="Jadwal pelajaran minggu ini" :show-back="false" />

    <LoadingSkeleton v-if="pending" type="text" :rows="8" />

    <div v-else id="jadwal-minggu" class="scroll-mt-24">
      <div class="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-full px-3 py-1 mb-3">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Hari ini &middot; {{ todayLabel }}
      </div>

      <div v-if="!hasWeeklyJadwal" class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-card dark:shadow-dark-card">
        <div class="flex flex-col items-center py-16 px-4">
          <svg class="w-12 h-12 text-gray-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-gray-500 dark:text-gray-400 font-medium">Belum ada jadwal untuk minggu ini.</p>
        </div>
      </div>

      <template v-else>
      <div class="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[#FEFEFE]/95 dark:bg-slate-900/95 backdrop-blur">
        <div class="flex gap-2 overflow-x-auto scrollbar-hide">
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
      </div>

      <div v-if="selectedJadwal.length > 0" class="space-y-2.5 mt-2">
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
              <span class="text-xs font-medium text-primary-600 dark:text-primary-400 flex-shrink-0 ml-1 mt-0.5 hidden sm:block">{{ ij.kelas.nama }}</span>
            </div>
          </div>
        </div>

        <div v-else class="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 mt-2">
          <div class="flex flex-col items-center py-10 px-4">
            <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Tidak ada jadwal {{ hariLabels[selectedHari] || '' }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Pilih hari lain di atas</p>
          </div>
        </div>
      </template>
    </div>
  </PTKLayout>
</template>
