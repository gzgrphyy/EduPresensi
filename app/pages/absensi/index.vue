<script setup lang="ts">
interface ActiveSesi {
  id: number
  status: string
  tanggal: string
  createdAt: string
  _count: { requests: number }
  jadwal: {
    mapel: string
    jamMulai: string
    jamSelesai: string
    kelas: { id: number; nama: string }
    ruangan: { id: number; nama: string }
  }
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

interface RiwayatSesi {
  id: number
  tanggal: string
  mapel: string
  kelas: string
  ruangan: string
  status: string
  totalSiswa: number
  hadir: number
}

const { user } = useUserSession()

const activeSesiList = ref<ActiveSesi[]>([])
const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')
const closingSesi = ref<number | null>(null)
const confirmClose = ref<ActiveSesi | null>(null)
const pendingIzinCount = ref(0)

const { data: riwayatData } = useFetch<RiwayatSesi[]>('/api/absensi/riwayat', {
  immediate: true
})

const riwayatTerakhir = computed(() => (riwayatData.value || []).slice(0, 5))

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

const { data: jadwalMingguan } = useFetch<{ hariOrder: string[]; grouped: Record<string, MingguanJadwal[]> }>('/api/absensi/jadwal-mingguan', {
  immediate: true
})

const totalJadwalMinggu = computed(() =>
  Object.values(jadwalMingguan.value?.grouped || {}).reduce((a, arr) => a + arr.length, 0)
)
const jumlahHariMinggu = computed(() =>
  Object.keys(jadwalMingguan.value?.grouped || {}).length
)

const todayLabel = computed(() =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Selamat pagi'
  if (h >= 12 && h < 15) return 'Selamat siang'
  if (h >= 15 && h < 18) return 'Selamat sore'
  return 'Selamat malam'
})

function showError(msg: string) {
  errorMsg.value = msg
  setTimeout(() => { errorMsg.value = '' }, 5000)
}

function showSuccess(msg: string) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}

async function fetchData() {
  try {
    activeSesiList.value = await $fetch<ActiveSesi[]>('/api/absensi/sesi/aktif')
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal memuat data')
  } finally {
    loading.value = false
  }
}

async function fetchPendingIzin() {
  try {
    const res = await $fetch<{ pendingCount: number }>('/api/absensi/izin')
    pendingIzinCount.value = res.pendingCount
  } catch {
    pendingIzinCount.value = 0
  }
}

async function tutupSesi(id: number) {
  closingSesi.value = id
  errorMsg.value = ''
  try {
    await $fetch(`/api/absensi/sesi/${id}/tutup`, { method: 'POST' })
    showSuccess('Sesi ditutup.')
    confirmClose.value = null
    await fetchData()
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal menutup sesi')
  } finally {
    closingSesi.value = null
  }
}

onMounted(() => {
  fetchData()
  fetchPendingIzin()
  const interval = setInterval(() => {
    fetchData()
    fetchPendingIzin()
  }, 30000)
  onUnmounted(() => clearInterval(interval))
})

const totalSiswaScan = computed(() => activeSesiList.value.reduce((sum, s) => sum + s._count.requests, 0))
</script>

<template>
  <PTKLayout>
    <!-- Greeting -->
    <header class="mb-5">
      <p class="text-xs font-medium text-gray-400 dark:text-gray-500">{{ todayLabel }}</p>
      <h1 class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
        {{ greeting }}, {{ user?.nama || 'Pak/Bu' }}
      </h1>
    </header>

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <!-- Pengajuan Izin -->
    <NuxtLink
      to="/absensi/izin"
      class="mb-4 group flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-700"
    >
      <div class="relative flex-shrink-0">
        <span class="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </span>
        <span v-if="pendingIzinCount > 0" class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
          {{ pendingIzinCount }}
        </span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-gray-900 dark:text-gray-100">Pengajuan Izin / Sakit</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ pendingIzinCount > 0 ? `Ada ${pendingIzinCount} pengajuan menunggu persetujuan` : 'Lihat riwayat izin/sakit murid' }}
        </p>
      </div>
      <svg class="w-4 h-4 text-gray-300 dark:text-slate-500 flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </NuxtLink>

    <!-- Scan QR Absen -->
    <NuxtLink
      to="/absensi/scan"
      class="w-full mb-4 flex items-center justify-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold py-3.5 px-4 shadow-md shadow-primary-500/30 transition-colors"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
      Scan QR Absen
    </NuxtLink>

    <!-- ===== Loading skeleton ===== -->
    <template v-if="loading">
      <div class="h-28 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 animate-pulse">
        <div class="h-3 bg-gray-100 dark:bg-slate-700 rounded w-16 mb-3"></div>
        <div class="h-5 bg-gray-100 dark:bg-slate-700 rounded w-2/3 mb-2"></div>
        <div class="h-4 bg-gray-100 dark:bg-slate-700 rounded w-1/2 mt-4"></div>
      </div>
      <div class="h-24 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 animate-pulse mt-3">
        <div class="h-4 bg-gray-100 dark:bg-slate-700 rounded w-24 mb-2"></div>
        <div class="h-8 bg-gray-100 dark:bg-slate-700 rounded w-16"></div>
      </div>
      <div class="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden animate-pulse mt-3">
        <div v-for="i in 2" :key="i" class="flex items-center gap-3 p-4">
          <div class="w-12 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg"></div>
          <div class="flex-1">
            <div class="h-4 bg-gray-100 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
            <div class="h-3 bg-gray-100 dark:bg-slate-700 rounded w-1/3"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- ===== Data loaded ===== -->
    <template v-else>
      <!-- Active session -->
      <template v-if="activeSesiList.length > 0">
        <section
          v-for="sesi in activeSesiList"
          :key="sesi.id"
          class="rounded-2xl border border-gray-200 dark:border-slate-700 border-l-4 border-l-primary-500 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-5 mb-3"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400">
                <span class="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                Sesi aktif
              </span>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 truncate mt-1">{{ sesi.jadwal.mapel }}</h2>
            </div>
            <span class="flex-shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 ring-1 ring-primary-200 dark:ring-primary-800">
              {{ sesi._count.requests }} scan
            </span>
          </div>

          <div class="flex items-center gap-3 text-sm mt-4">
            <span class="text-gray-600 dark:text-gray-300 truncate">Kelas <b class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.kelas.nama }}</b> · {{ sesi.jadwal.ruangan.nama }}</span>
          </div>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">{{ sesi.jadwal.jamMulai }} – {{ sesi.jadwal.jamSelesai }}</p>

          <div class="flex gap-2.5 mt-4">
            <NuxtLink
              :to="`/absensi/sesi/${sesi.id}`"
              class="flex-1 text-center px-3 py-2.5 text-sm font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 active:bg-primary-700 transition-colors shadow-md shadow-primary-500/30"
            >
              Konfirmasi Kehadiran
            </NuxtLink>
            <button
              @click="confirmClose = sesi"
              class="px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 border border-gray-200 dark:border-slate-700 rounded-xl transition-colors"
            >
              Tutup Sesi
            </button>
          </div>
        </section>
      </template>

      <!-- Stats & weekly schedule shortcut -->
      <div class="grid grid-cols-2 gap-3 mt-3">
        <div class="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4">
          <p class="text-xs font-medium text-gray-400 dark:text-gray-500">Scan Hari Ini</p>
          <p class="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-1 leading-none tracking-tight">{{ totalSiswaScan }}</p>
        </div>

        <div class="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4 flex flex-col">
          <p class="text-xs font-medium text-gray-400 dark:text-gray-500">Jadwal Minggu Ini</p>
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1 truncate">
            {{ totalJadwalMinggu > 0 ? `${totalJadwalMinggu} sesi · ${jumlahHariMinggu} hari` : 'Belum ada' }}
          </p>
          <NuxtLink
            to="/absensi/jadwal#jadwal-minggu"
            class="mt-2 self-start inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors"
          >
            Lihat
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </NuxtLink>
        </div>
      </div>

      <!-- Riwayat Terakhir -->
      <section class="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden">
        <header class="px-5 pt-4 pb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Riwayat Terakhir</h3>
          <NuxtLink to="/absensi/riwayat" class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300">
            Lihat Semua
          </NuxtLink>
        </header>

        <div v-if="riwayatTerakhir.length > 0" class="divide-y divide-gray-50 dark:divide-slate-700/60">
          <NuxtLink
            v-for="item in riwayatTerakhir"
            :key="item.id"
            to="/absensi/riwayat"
            class="flex items-center gap-3 px-5 py-3 active:bg-gray-50 dark:active:bg-slate-700/40 transition-colors"
          >
            <span class="w-2 h-2 rounded-full flex-shrink-0" :class="item.status === 'SELESAI' ? 'bg-green-500' : 'bg-primary-500'"></span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ item.mapel }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatTanggal(item.tanggal) }} — {{ item.kelas }} · {{ item.ruangan }}</p>
            </div>
            <span class="flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {{ item.hadir }}/{{ item.totalSiswa }} Hadir
            </span>
          </NuxtLink>
        </div>
        <div v-else class="py-10 px-5 text-center">
          <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Belum ada riwayat absensi</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Scan QR saat sesi kelas untuk memulai</p>
        </div>
      </section>
    </template>

    <!-- Modal Confirm Close -->
    <ConfirmDialog
      :show="!!confirmClose"
      title="Tutup Sesi"
      :message="`${confirmClose?.jadwal.mapel} — ${confirmClose?.jadwal.kelas.nama}. Murid yang belum scan tidak otomatis tercatat. Pastikan kehadiran sudah dikonfirmasi.`"
      variant="warning"
      confirm-label="Ya, Tutup Sesi"
      :loading="closingSesi === confirmClose?.id"
      @confirm="confirmClose && tutupSesi(confirmClose.id)"
      @cancel="confirmClose = null"
    />
  </PTKLayout>
</template>