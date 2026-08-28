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
    kelas: { id: number; nama: string; waliKelasId?: number | null }
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

interface KabarItem {
  jadwalId: number
  jenis: string
  mapel: string
  jamMulai: string
  jamSelesai: string
  kelas: string
  ruangan: string
  jumlahPelapor: number
  pelapor: string[]
  terakhirPada: string
}

const activeSesiList = ref<ActiveSesi[]>([])
const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')
const closingSesi = ref<number | null>(null)
const confirmClose = ref<ActiveSesi | null>(null)
const pendingIzinCount = ref(0)
const kabarBelumSelesai = ref<KabarItem[]>([])
const kabarSudahBeres = ref<KabarItem[]>([])

const { data: riwayatData } = useFetch<RiwayatSesi[]>('/api/absensi/riwayat', {
  immediate: true
})

const { data: waliKelasData } = useFetch<{ isWaliKelas: boolean }>('/api/absensi/wali-kelas/kelas-saya', {
  immediate: true,
  transform: (res: any) => ({ isWaliKelas: !!res?.isWaliKelas })
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

async function fetchKabar() {
  try {
    const res = await $fetch<{ belumSelesai: KabarItem[]; sudahBeres: KabarItem[] }>('/api/absensi/kabar')
    kabarBelumSelesai.value = res.belumSelesai
    kabarSudahBeres.value = res.sudahBeres
  } catch {
    kabarBelumSelesai.value = []
    kabarSudahBeres.value = []
  }
}

const confirmDismiss = ref<KabarItem | null>(null)
const deletingKabar = ref(false)

// Group kabar by session (jadwalId) instead of by jenis
interface KabarSessionGroup {
  jadwalId: number
  mapel: string
  jamMulai: string
  jamSelesai: string
  kelas: string
  ruangan: string
  belumSelesai: KabarItem | null
  sudahBeres: KabarItem | null
}

const kabarSessions = computed<KabarSessionGroup[]>(() => {
  const map = new Map<number, KabarSessionGroup>()
  
  for (const k of kabarBelumSelesai.value) {
    if (!map.has(k.jadwalId)) {
      map.set(k.jadwalId, {
        jadwalId: k.jadwalId,
        mapel: k.mapel,
        jamMulai: k.jamMulai,
        jamSelesai: k.jamSelesai,
        kelas: k.kelas,
        ruangan: k.ruangan,
        belumSelesai: null,
        sudahBeres: null
      })
    }
    map.get(k.jadwalId)!.belumSelesai = k
  }
  
  for (const k of kabarSudahBeres.value) {
    if (!map.has(k.jadwalId)) {
      map.set(k.jadwalId, {
        jadwalId: k.jadwalId,
        mapel: k.mapel,
        jamMulai: k.jamMulai,
        jamSelesai: k.jamSelesai,
        kelas: k.kelas,
        ruangan: k.ruangan,
        belumSelesai: null,
        sudahBeres: null
      })
    }
    map.get(k.jadwalId)!.sudahBeres = k
  }
  
  return [...map.values()].sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
})

const totalKabarAktif = computed(() => kabarBelumSelesai.value.length + kabarSudahBeres.value.length)

function formatRelatif(iso: string) {
  const mnt = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000)
  if (mnt < 1) return 'Baru saja'
  if (mnt < 60) return `${mnt} mnt lalu`
  return `${Math.floor(mnt / 60)} jam lalu`
}

async function dismissKabar(k: KabarItem) {
  deletingKabar.value = true
  errorMsg.value = ''
  try {
    await $fetch(`/api/absensi/kabar/${k.jadwalId}`, {
      method: 'DELETE',
      query: { jenis: k.jenis }
    })
    confirmDismiss.value = null
    await fetchKabar()
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal menandai selesai')
  } finally {
    deletingKabar.value = false
  }
}

function getTotalPelapor(session: KabarSessionGroup): number {
  return (session.belumSelesai?.jumlahPelapor || 0) + (session.sudahBeres?.jumlahPelapor || 0)
}

function getAllPelapor(session: KabarSessionGroup): string[] {
  const names: string[] = []
  if (session.belumSelesai?.pelapor) names.push(...session.belumSelesai.pelapor)
  if (session.sudahBeres?.pelapor) names.push(...session.sudahBeres.pelapor)
  return names
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
  fetchKabar()
  const interval = setInterval(() => {
    fetchData()
    fetchPendingIzin()
    fetchKabar()
  }, 30000)
  onUnmounted(() => clearInterval(interval))
})

const totalSiswaScan = computed(() => activeSesiList.value.reduce((sum, s) => sum + s._count.requests, 0))

const waliKelasSesi = computed(() =>
  activeSesiList.value.filter(s => s.jadwal.kelas.waliKelasId === user.value?.id)
)
const showWaliKelasLink = computed(() => !!waliKelasData.value?.isWaliKelas)
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

    <!-- Catat Pengecualian (wali kelas) -->
    <NuxtLink
      v-if="showWaliKelasLink"
      to="/absensi/wali-kelas/kehadiran"
      class="mb-4 group flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-700"
    >
      <div class="relative flex-shrink-0">
        <svg class="w-6 h-6 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-gray-900 dark:text-gray-100">Catat Pengecualian Kehadiran</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tandai murid tidak hadir (sakit/izin/alpha) untuk kelas yang Anda wali</p>
      </div>
      <svg class="w-4 h-4 text-gray-300 dark:text-slate-500 flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </NuxtLink>

    <!-- Pengajuan Izin (dihapus/disembunyikan sesuai permintaan) -->

    <!-- Kabar Masuk -->
    <section
      v-if="totalKabarAktif > 0"
      class="mb-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4"
    >
      <div class="flex items-center gap-3">
        <div class="relative flex-shrink-0">
          <svg class="w-6 h-6 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-slate-800">
            {{ totalKabarAktif }}
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-gray-900 dark:text-gray-100">Kabar Masuk</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ kabarSessions.length }} kelas · {{ totalKabarAktif }} kabar</p>
        </div>
      </div>

      <div class="space-y-3 mt-3">
        <div
          v-for="session in kabarSessions"
          :key="session.jadwalId"
          class="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/30 p-3.5"
        >
          <!-- Session header -->
          <div class="flex items-start justify-between gap-3 mb-2.5">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ session.mapel }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Kelas {{ session.kelas }} · {{ session.ruangan }} · {{ session.jamMulai }}–{{ session.jamSelesai }}
              </p>
            </div>
            <span class="flex-shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
              {{ getTotalPelapor(session) }} murid
            </span>
          </div>

          <!-- Kabar items for this session -->
          <div class="space-y-2">
            <!-- Belum Selesai -->
            <div
              v-if="session.belumSelesai"
              class="relative rounded-lg border border-slate-200 dark:border-slate-700 pl-3 pr-3 py-3"
            >
              <span class="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-amber-400 dark:bg-amber-500"></span>
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Belum selesai</p>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {{ session.belumSelesai.pelapor.slice(0, 3).join(', ') }}<template v-if="session.belumSelesai.pelapor.length > 3"> +{{ session.belumSelesai.pelapor.length - 3 }} lainnya</template>
                    </p>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1 flex-shrink-0">
                  <button
                    type="button"
                    title="Hapus kabar"
                    class="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 dark:text-red-400 transition-colors"
                    @click="confirmDismiss = session.belumSelesai!"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                    </svg>
                    Hapus
                  </button>
                  <span class="text-[11px] text-gray-400 dark:text-gray-500">{{ formatRelatif(session.belumSelesai!.terakhirPada) }}</span>
                </div>
              </div>
            </div>

            <!-- Sudah Beres -->
            <div
              v-if="session.sudahBeres"
              class="relative rounded-lg border border-slate-200 dark:border-slate-700 pl-3 pr-3 py-3"
            >
              <span class="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-emerald-400 dark:bg-emerald-500"></span>
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <div class="min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Sudah selesai</p>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {{ session.sudahBeres.pelapor.slice(0, 3).join(', ') }}<template v-if="session.sudahBeres.pelapor.length > 3"> +{{ session.sudahBeres.pelapor.length - 3 }} lainnya</template>
                    </p>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1 flex-shrink-0">
                  <button
                    type="button"
                    title="Hapus kabar"
                    class="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 dark:text-red-400 transition-colors"
                    @click="confirmDismiss = session.sudahBeres!"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                    </svg>
                    Hapus
                  </button>
                  <span class="text-[11px] text-gray-400 dark:text-gray-500">{{ formatRelatif(session.sudahBeres!.terakhirPada) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

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
      <!-- Active session untuk kelas yang di-wali-kan -->
      <template v-if="waliKelasSesi.length > 0">
        <section
          v-for="sesi in waliKelasSesi"
          :key="`wali-${sesi.id}`"
          class="rounded-2xl border border-gray-200 dark:border-slate-700 border-l-4 border-l-amber-500 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-5 mb-3"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                Sesi kelas Anda
              </span>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 truncate mt-1">{{ sesi.jadwal.mapel }}</h2>
            </div>
            <span class="flex-shrink-0 px-2.5 py-1 text-[11px] font-semibold rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800">
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
              class="flex-1 text-center px-3 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-600 active:bg-amber-700 transition-colors shadow-md shadow-amber-500/30"
            >
              Konfirmasi Kehadiran
            </NuxtLink>
          </div>
        </section>
      </template>

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

    <!-- Modal Confirm Dismiss Kabar -->
    <ConfirmDialog
      :show="!!confirmDismiss"
      title="Tandai Selesai"
      :message="`Tandai kabar '${confirmDismiss?.jenis === 'BELUM_SELESAI' ? 'Belum selesai' : 'Sudah selesai'}' dari ${confirmDismiss?.jumlahPelapor} siswa (${confirmDismiss?.mapel}) sebagai sudah dibaca? Murid bisa mengirim ulang setelah ini.`"
      variant="warning"
      confirm-label="Ya, Tandai Selesai"
      :loading="deletingKabar"
      @confirm="confirmDismiss && dismissKabar(confirmDismiss)"
      @cancel="confirmDismiss = null"
    />
  </PTKLayout>
</template>