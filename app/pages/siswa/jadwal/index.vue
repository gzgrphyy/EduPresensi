<script setup lang="ts">
interface JadwalItem {
  id: number
  mapel: string
  hari: string
  jamMulai: string
  jamSelesai: string
  ruangan: { id: number; nama: string }
  guru: { id: number; nama: string }
}

interface JadwalData {
  kelas: { id: number; nama: string }
  hariOrder: string[]
  grouped: Record<string, JadwalItem[]>
}

const { data, pending } = useFetch<JadwalData>('/api/siswa/jadwal', { immediate: true })

const hariLabel: Record<string, string> = {
  SENIN: 'Senin', SELASA: 'Selasa', RABU: 'Rabu',
  KAMIS: 'Kamis', JUMAT: 'Jumat', SABTU: 'Sabtu', MINGGU: 'Minggu'
}

const todayHari = computed(() => {
  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
  return days[new Date().getDay()]
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

const selectedDay = ref('')

const availableDays = computed(() =>
  data.value ? data.value.hariOrder.filter(h => data.value!.grouped[h]) : []
)

const selectedItems = computed(() =>
  data.value?.grouped[selectedDay.value] || []
)

onMounted(() => {
  if (data.value?.grouped) {
    if (data.value.grouped[todayHari.value]) {
      selectedDay.value = todayHari.value
    } else {
      selectedDay.value = data.value.hariOrder.find(h => data.value!.grouped[h]) || ''
    }
  }
})
</script>

<template>
  <StudentLayout>
    <PageHeader title="Jadwal Pelajaran" :description="data?.kelas?.nama ? `Kelas ${data.kelas.nama}` : undefined" :show-back="false" />

    <LoadingSkeleton v-if="pending" type="text" :rows="8" />

    <template v-else-if="data && Object.keys(data.grouped).length > 0">
      <div class="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-full px-3 py-1 mb-3">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Hari ini &middot; {{ todayLabel }}
      </div>

      <div class="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[#FEFEFE]/95 dark:bg-slate-900/95 backdrop-blur">
        <div class="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            v-for="hari in availableDays"
            :key="hari"
            @click="selectedDay = hari"
            class="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors"
            :class="selectedDay === hari
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'"
          >
            <span v-if="hari === todayHari && selectedDay !== hari" class="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
            {{ hariLabel[hari] || hari }}
          </button>
        </div>
      </div>

      <div v-if="selectedItems.length > 0" class="space-y-2.5 mt-2">
        <div
          v-for="item in selectedItems"
          :key="item.id"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden flex transition-colors"
          :class="{ 'ring-1 ring-primary-400 dark:ring-primary-500': selectedDay === todayHari }"
        >
          <div class="w-1.5 flex-shrink-0 bg-primary-500"></div>
          <div class="flex-1 min-w-0 px-4 py-3.5 flex items-start gap-4">
            <div class="text-center flex-shrink-0 w-14 pt-0.5">
              <p class="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{{ item.jamMulai }}</p>
              <p class="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{{ item.jamSelesai }}</p>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ item.mapel }}</p>
              <div class="flex items-center gap-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span class="truncate">{{ item.ruangan.nama }}</span>
                <span class="text-gray-300 dark:text-gray-600">&middot;</span>
                <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="truncate">{{ item.guru.nama }}</span>
              </div>
            </div>
            <BaseBadge variant="primary" size="sm" class="flex-shrink-0 ml-1 mt-0.5">{{ item.ruangan.nama }}</BaseBadge>
          </div>
        </div>
      </div>

      <div v-else class="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 mt-2">
        <div class="flex flex-col items-center py-10 px-4">
          <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">Tidak ada jadwal {{ hariLabel[selectedDay] || '' }}</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Pilih hari lain di atas</p>
        </div>
      </div>
    </template>

    <div v-else class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 shadow-card dark:shadow-dark-card">
      <div class="flex flex-col items-center py-16 px-4">
        <svg class="w-12 h-12 text-gray-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p class="text-gray-500 dark:text-gray-400 font-medium">Belum ada jadwal pelajaran</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Hubungi admin untuk mengatur jadwal kelas</p>
      </div>
    </div>
  </StudentLayout>
</template>
