<script setup lang="ts">
interface RiwayatItem {
  id: number
  tanggal: string
  mapel: string
  jamMulai: string
  jamSelesai: string
  kelas: string
  guru: string
  ruangan: string
  petugasPiket: string
  totalSiswa: number
  hadir: number
  sakit: number
  izin: number
  alpha: number
  alasan: string | null
}

const selectedDate = ref(new Date().toISOString().split('T')[0])

const alasanLabels: Record<string, string> = {
  SAKIT: 'Sakit',
  IZIN: 'Izin',
  DINAS_LUAR: 'Dinas Luar',
  LAINNYA: 'Lainnya'
}

const { data: riwayat, pending } = useFetch<RiwayatItem[]>('/api/piket/riwayat', {
  query: computed(() => ({ tanggal: selectedDate.value })),
  watch: [selectedDate]
})

const displayData = computed(() => riwayat.value || [])

const totalSesi = computed(() => displayData.value.length)

const totalSiswa = computed(() => displayData.value.reduce((a, b) => a + b.totalSiswa, 0))

const totalHadir = computed(() => displayData.value.reduce((a, b) => a + b.hadir, 0))

function persentase(hadir: number, total: number) {
  if (total === 0) return 0
  return Math.round((hadir / total) * 100)
}

function persentaseColor(p: number) {
  if (p >= 90) return 'text-green-600 dark:text-green-400'
  if (p >= 75) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<template>
  <PiketLayout>
    <!-- Page Title -->
    <div class="mb-4">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">Riwayat Piket</h1>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sesi absensi yang sudah disetujui</p>
    </div>

    <!-- Date Picker -->
    <div class="flex items-center gap-2 mb-4">
      <label class="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Tanggal</label>
      <input v-model="selectedDate" type="date" class="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" />
    </div>

    <!-- Loading -->
    <div v-if="pending" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-20 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 animate-pulse" />
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-center">
          <p class="text-lg font-bold text-primary-600 dark:text-primary-400 leading-tight">{{ totalSesi }}</p>
          <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Total Sesi</p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-center">
          <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-tight">{{ totalHadir }}</p>
          <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Hadir</p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-center">
          <p class="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{{ totalSiswa }}</p>
          <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Total Siswa</p>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="displayData.length === 0" class="text-center py-12">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
          <svg class="w-7 h-7 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Belum ada riwayat</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">untuk tanggal yang dipilih</p>
      </div>

      <!-- Session List -->
      <div v-else class="space-y-2">
        <div
          v-for="item in displayData"
          :key="item.id"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-3"
        >
          <!-- Top: Time + Persentase -->
          <div class="flex items-center justify-between mb-1.5">
            <p class="text-xs font-bold text-gray-900 dark:text-gray-100">{{ item.jamMulai }} - {{ item.jamSelesai }}</p>
            <span class="text-xs font-semibold" :class="persentaseColor(persentase(item.hadir, item.totalSiswa))">
              {{ persentase(item.hadir, item.totalSiswa) }}%
            </span>
          </div>

          <!-- Mapel + Kelas -->
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{{ item.mapel }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ item.guru }} · {{ item.kelas }}</p>
          <p v-if="item.alasan" class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">PTK Berhalangan: {{ alasanLabels[item.alasan] || item.alasan }}</p>

          <!-- Attendance Summary -->
          <div class="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
            <span class="flex items-center gap-1 text-[11px]">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span class="text-emerald-600 dark:text-emerald-400 font-medium">{{ item.hadir }}</span>
              <span class="text-gray-400">Hadir</span>
            </span>
            <span class="flex items-center gap-1 text-[11px]">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <span class="text-amber-600 dark:text-amber-400 font-medium">{{ item.sakit }}</span>
              <span class="text-gray-400">Sakit</span>
            </span>
            <span class="flex items-center gap-1 text-[11px]">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              <span class="text-blue-600 dark:text-blue-400 font-medium">{{ item.izin }}</span>
              <span class="text-gray-400">Izin</span>
            </span>
            <span class="flex items-center gap-1 text-[11px]">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              <span class="text-red-600 dark:text-red-400 font-medium">{{ item.alpha }}</span>
              <span class="text-gray-400">Alpha</span>
            </span>
            <span class="ml-auto text-[11px] text-gray-400">{{ item.ruangan }}</span>
          </div>

          <!-- Detail Link -->
          <div class="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 flex justify-end">
            <NuxtLink :to="`/piket/sesi/${item.id}`" class="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
              Lihat Detail
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </PiketLayout>
</template>
