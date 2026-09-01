<script setup lang="ts">
import { statusLabels, statusDotColor } from '~/utils/absensi'

interface TodayStatus {
  state: 'PRESENT' | 'PENDING' | 'ALPHA' | 'NOT_YET' | 'NO_SESSION'
  status?: string
  scannedAt?: string
  mapel?: string
  kelas?: string
  ruangan?: string
  jamMulai?: string
  jamSelesai?: string
  isGuruBerhalangan?: boolean
  petugasPiketNama?: string | null
}

interface DashboardData {
  siswa: { id: number; nama: string; kelas: { id: number; nama: string } }
  todayStatus: TodayStatus
  monthStats: { hadir: number; sakit: number; izin: number; alpha: number }
  recentHistory: {
    id: number
    tanggal: string
    mapel: string
    kelas: string
    status: string
    keterangan: string | null
    scannedAt: string
    isGuruBerhalangan: boolean
    petugasPiketNama: string | null
  }[]
}

const { user } = useUserSession()

const { data, pending, error, refresh } = useFetch<DashboardData>('/api/siswa/dashboard')

interface KabarTarget {
  jadwalId: number
  mapel: string
  guru: string
  jamMulai: string
  ruangan: string
}

interface KabarStatus {
  belumSelesai: {
    bisa: boolean
    sudah: boolean
    mapelBerjalan: { mapel: string; guru: string; jamMulai: string; jamSelesai: string; ruangan: string } | null
    target: KabarTarget | null
  }
  sudahBeres: {
    bisa: boolean
    sudah: boolean
    target: KabarTarget | null
  }
}

const { data: kabar, refresh: refreshKabar } = useFetch<KabarStatus>('/api/siswa/kabar-status')

const kabarSending = ref<'BELUM_SELESAI' | 'SUDAH_BERES' | null>(null)
const kabarTerkirim = ref<Record<string, boolean>>({})

const showStatusCard = ref(true)
const confirmHideStatus = ref(false)

function hideStatusCard() {
  showStatusCard.value = false
  confirmHideStatus.value = false
}

async function kirimKabar(jenis: 'BELUM_SELESAI' | 'SUDAH_BERES') {
  const grup = jenis === 'BELUM_SELESAI' ? kabar.value?.belumSelesai : kabar.value?.sudahBeres
  if (!grup?.target || kabarSending.value) return
  kabarSending.value = jenis
  try {
    await $fetch('/api/siswa/kabar', {
      method: 'POST',
      body: { jadwalId: grup.target.jadwalId, jenis }
    })
    kabarTerkirim.value = { ...kabarTerkirim.value, [jenis]: true }
    await refreshKabar()
  } catch {
    // diamkan; tombol tetap bisa dicoba lagi
  } finally {
    kabarSending.value = null
  }
}

const tampilKabarCard = computed(() => {
  const k = kabar.value
  if (!k) return false
  const belumAktif = k.belumSelesai.bisa && !k.belumSelesai.sudah && !kabarTerkirim.value['BELUM_SELESAI']
  const beresAktif = k.sudahBeres.bisa && !k.sudahBeres.sudah && !kabarTerkirim.value['SUDAH_BERES']
  return belumAktif || beresAktif
})

interface JadwalMingguanItem {
  id: number
  mapel: string
  hari: string
  jamMulai: string
  jamSelesai: string
  ruangan: { id: number; nama: string }
  guru: { id: number; nama: string }
}

const { data: jadwalMingguan } = useFetch<{ hariOrder: string[]; grouped: Record<string, JadwalMingguanItem[]> }>('/api/siswa/jadwal', { immediate: true })

const totalJadwalMinggu = computed(() =>
  Object.values(jadwalMingguan.value?.grouped || {}).reduce((a, arr) => a + arr.length, 0)
)
const jumlahHariMinggu = computed(() =>
  Object.keys(jadwalMingguan.value?.grouped || {}).length
)

const { data: ratingsData } = useFetch<{ sessions: { sesiId: number; tanggal: string; mapel: string; kelas: string; guru: string; rating: { rating: number } | null }[]; stats: { totalDirate: number; totalHadir: number; rataRata: number | null } }>('/api/siswa/ratings', { immediate: true })


const greeting = computed(() => {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Selamat pagi'
  if (h >= 12 && h < 15) return 'Selamat siang'
  if (h >= 15 && h < 18) return 'Selamat sore'
  return 'Selamat malam'
})

const todayLabel = computed(() =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

function formatJam(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatTanggal(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

const errorMessage = computed(() => {
  const e = error.value as { data?: { statusMessage?: string } } | null
  return e?.data?.statusMessage || 'Gagal memuat data'
})

onMounted(() => {
  refresh()
  const { refresh: refreshSesiHariIni } = useSesiHariIni()
  const interval = setInterval(() => {
    refresh()
    refreshKabar()
    refreshSesiHariIni()
  }, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <StudentLayout>
    <!-- Greeting -->
    <header class="mb-5">
      <p class="text-xs text-gray-400 dark:text-gray-500 capitalize">{{ todayLabel }}</p>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
        {{ greeting }}, {{ user?.nama || 'Murid' }}
      </h1>
      <p v-if="data" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Kelas {{ data.siswa.kelas.nama }}</p>
    </header>

    <Notification
      type="error"
      :message="errorMessage"
      :show="!!error"
      @dismiss="refresh()"
    />

    <!-- ===== Loading skeleton ===== -->
    <template v-if="pending && !data">
      <div class="h-32 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-5 animate-pulse">
        <div class="h-4 bg-gray-100 dark:bg-slate-700 rounded w-1/3 mb-3"></div>
        <div class="h-6 bg-gray-100 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
        <div class="h-3 bg-gray-100 dark:bg-slate-700 rounded w-2/3"></div>
      </div>
      <div class="h-12 rounded-xl bg-gray-100 dark:bg-slate-700 animate-pulse mt-4"></div>
      <div class="h-48 rounded-2xl bg-gray-100 dark:bg-slate-700 animate-pulse mt-4"></div>
    </template>

    <!-- ===== Data loaded ===== -->
    <template v-else-if="data">
      <!-- Status card -->
      <section
        v-if="showStatusCard"
        class="rounded-2xl border p-5 shadow-card dark:shadow-dark-card"
        :class="{
          'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-900/20 border-green-200 dark:border-green-800': data.todayStatus.state === 'PRESENT',
          'bg-gradient-to-br from-accent-50 to-accent-100 dark:from-amber-900/40 dark:to-amber-900/20 border-accent-200 dark:border-amber-800': data.todayStatus.state === 'PENDING' || data.todayStatus.state === 'NOT_YET',
          'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-900/20 border-red-200 dark:border-red-800': data.todayStatus.state === 'ALPHA',
          'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700': data.todayStatus.state === 'NO_SESSION'
        }"
      >
        <!-- PRESENT (Hadir / Izin / Sakit) -->
        <template v-if="data.todayStatus.state === 'PRESENT'">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 flex-shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-green-800 dark:text-green-200">Status hari ini</p>
              <p class="text-xl font-bold text-green-900 dark:text-green-100">{{ statusLabels[data.todayStatus.status || ''] || data.todayStatus.status }}</p>
            </div>
            <button
              @click="confirmHideStatus = true"
              class="p-1.5 rounded-lg text-green-600/60 dark:text-green-400/60 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
              title="Sembunyikan"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <dl class="space-y-1.5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-green-700/80 dark:text-green-300/80">Jam absen</dt>
              <dd class="font-semibold text-green-900 dark:text-green-100">{{ formatJam(data.todayStatus.scannedAt || '') }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-green-700/80 dark:text-green-300/80">Kelas</dt>
              <dd class="font-semibold text-green-900 dark:text-green-100">{{ data.todayStatus.kelas || data.siswa.kelas.nama }}</dd>
            </div>
            <div v-if="data.todayStatus.ruangan" class="flex items-center justify-between gap-3">
              <dt class="text-green-700/80 dark:text-green-300/80">Ruangan</dt>
              <dd class="font-semibold text-green-900 dark:text-green-100">{{ data.todayStatus.ruangan }}</dd>
            </div>
            <div v-if="data.todayStatus.mapel" class="flex items-center justify-between gap-3">
              <dt class="text-green-700/80 dark:text-green-300/80">Mata pelajaran</dt>
              <dd class="font-semibold text-green-900 dark:text-green-100 truncate">{{ data.todayStatus.mapel }}</dd>
            </div>
          </dl>
        </template>

        <!-- PENDING -->
        <template v-else-if="data.todayStatus.state === 'PENDING'">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2.5 rounded-full bg-accent-200 dark:bg-amber-900/50 text-primary-800 dark:text-amber-200 flex-shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
                {{ data.todayStatus.isGuruBerhalangan ? 'Guru berhalangan hadir' : 'Menunggu konfirmasi guru' }}
              </p>
              <p v-if="data.todayStatus.scannedAt" class="text-xs text-amber-700/80 dark:text-amber-300/80">Absen pukul {{ formatJam(data.todayStatus.scannedAt) }}</p>
            </div>
            <button
              @click="confirmHideStatus = true"
              class="p-1.5 rounded-lg text-amber-600/60 dark:text-amber-400/60 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
              title="Sembunyikan"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p class="text-sm text-amber-800 dark:text-amber-200">
            {{ data.todayStatus.mapel }} — {{ data.todayStatus.kelas }}{{ data.todayStatus.ruangan ? ` · ${data.todayStatus.ruangan}` : '' }} {{ data.todayStatus.jamMulai ? `(${data.todayStatus.jamMulai}-${data.todayStatus.jamSelesai})` : '' }}
          </p>
          <!-- Info guru berhalangan -->
          <div v-if="data.todayStatus.isGuruBerhalangan" class="mt-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p class="text-xs font-medium text-amber-800 dark:text-amber-200">Guru pengajar berhalangan hadir</p>
                <p v-if="data.todayStatus.petugasPiketNama" class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Ditangani oleh: <span class="font-semibold">{{ data.todayStatus.petugasPiketNama }}</span> (Petugas Piket)
                </p>
                <p v-else class="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Menunggu petugas piket menangani sesi ini
                </p>
              </div>
            </div>
          </div>
        </template>

        <!-- ALPHA -->
        <template v-else-if="data.todayStatus.state === 'ALPHA'">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex-shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-red-800 dark:text-red-200">Status hari ini</p>
              <p class="text-xl font-bold text-red-900 dark:text-red-100">Tidak hadir (Alpha)</p>
            </div>
          </div>
          <p class="text-sm text-red-700 dark:text-red-300">Kamu tidak tercatat absen hari ini. Hubungi guru wali kelas jika ada kendala.</p>
        </template>

        <!-- NOT_YET -->
        <template v-else-if="data.todayStatus.state === 'NOT_YET'">
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2.5 rounded-full bg-accent-200 dark:bg-amber-900/50 text-primary-800 dark:text-amber-200 flex-shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <p class="text-xl font-bold text-primary-900 dark:text-amber-100">Kamu belum absen hari ini</p>
              <p class="text-sm text-amber-800/80 dark:text-amber-200/80">Scan QR di ruangan kelas untuk absen</p>
            </div>
          </div>
        </template>

        <!-- NO_SESSION -->
        <template v-else>
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 flex-shrink-0">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="font-semibold text-gray-800 dark:text-gray-200">Tidak ada sesi absensi hari ini</p>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Istirahat dulu, scan QR hanya saat ada sesi kelas</p>
            </div>
          </div>
        </template>
      </section>

      <!-- Kabar untuk Guru -->
      <section
        v-if="tampilKabarCard"
        class="mt-4 rounded-2xl border p-5 shadow-card dark:shadow-dark-card bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700"
      >
        <div class="flex items-baseline justify-between gap-3 mb-4">
          <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Kabar untuk Guru</h2>
          <span class="text-xs text-slate-400 dark:text-slate-500">Pilih sesuai kondisi kelas</span>
        </div>

        <div v-if="kabar" class="divide-y divide-slate-100 dark:divide-slate-700 -mx-1">
          <!-- Belum Selesai (lebih mendesak — border kiri aksen amber) -->
          <div
            v-if="kabar.belumSelesai.bisa && !kabar.belumSelesai.sudah && !kabarTerkirim['BELUM_SELESAI']"
            class="relative pl-3 pr-2 py-3"
          >
            <span class="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-amber-400 dark:bg-amber-500"></span>
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 mt-0.5 text-slate-500 dark:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  <span class="font-medium">{{ kabar.belumSelesai.mapelBerjalan?.mapel }}</span>
                  <span class="mx-1">·</span>
                  {{ kabar.belumSelesai.target?.ruangan }}
                </p>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                  Belum selesai
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Guru berikutnya: <span class="font-medium text-slate-700 dark:text-slate-300">{{ kabar.belumSelesai.target?.guru }}</span>
                </p>
                <button
                  type="button"
                  :disabled="kabarSending !== null"
                  class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors"
                  @click="kirimKabar('BELUM_SELESAI')"
                >
                  Kabari {{ kabar.belumSelesai.target?.guru }}
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Sudah Selesai -->
          <div
            v-if="kabar.sudahBeres.bisa && !kabar.sudahBeres.sudah && !kabarTerkirim['SUDAH_BERES']"
            class="relative pl-3 pr-2 py-3"
          >
            <span class="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-emerald-400 dark:bg-emerald-500"></span>
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 mt-0.5 text-slate-500 dark:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-slate-400 dark:text-slate-500">
                  <span class="font-medium">{{ kabar.sudahBeres.target?.mapel }}</span>
                  <span class="mx-1">·</span>
                  {{ kabar.sudahBeres.target?.ruangan }}
                </p>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                  Sudah Selesai
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Guru berikutnya: <span class="font-medium text-slate-700 dark:text-slate-300">{{ kabar.sudahBeres.target?.guru }}</span>
                </p>
                <button
                  type="button"
                  :disabled="kabarSending !== null"
                  class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-colors"
                  @click="kirimKabar('SUDAH_BERES')"
                >
                  Kabari {{ kabar.sudahBeres.target?.guru }}
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Already sent state -->
          <div
            v-if="kabarTerkirim['BELUM_SELESAI'] || kabarTerkirim['SUDAH_BERES']"
            class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1 py-2"
          >
            <svg class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Sudah dikabari — guru sudah tahu kondisinya.</span>
          </div>
        </div>
      </section>

      <!-- Scan CTA -->
      <NuxtLink
        v-if="data.todayStatus.state !== 'NO_SESSION'"
        to="/siswa/scan"
        class="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-semibold py-3.5 px-4 shadow-md shadow-primary-500/30 transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        Scan QR Absen
      </NuxtLink>

      <div
        v-else
        aria-disabled="true"
        class="w-full mt-4 flex items-center justify-center gap-2 rounded-xl bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400 font-semibold py-3.5 px-4 cursor-not-allowed select-none"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        Belum ada sesi
      </div>

      <!-- Jadwal Minggu Ini -->
      <NuxtLink
        to="/siswa/jadwal"
        class="mt-4 group flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-700"
      >
        <div class="relative flex-shrink-0">
          <svg class="w-6 h-6 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-gray-900 dark:text-gray-100">Jadwal Minggu Ini</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ totalJadwalMinggu > 0 ? `${totalJadwalMinggu} sesi · ${jumlahHariMinggu} hari` : 'Belum ada jadwal' }}
          </p>
        </div>
        <svg class="w-4 h-4 text-gray-300 dark:text-slate-500 flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </NuxtLink>

      <!-- Ulasan -->
      <NuxtLink
        to="/siswa/ratings"
        class="mt-4 group flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-700"
      >
        <div class="relative flex-shrink-0">
          <svg class="w-6 h-6 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-gray-900 dark:text-gray-100">Ulasan Saya</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Beri rating dan ulasan untuk sesi pelajaran yang sudah kamu ikuti</p>
        </div>
        <svg class="w-4 h-4 text-gray-300 dark:text-slate-500 flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </NuxtLink>

      <!-- Recent history -->
      <section class="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden">
        <header class="px-5 pt-4 pb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Riwayat Terakhir</h3>
          <NuxtLink to="/siswa/riwayat" class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300">
            Lihat Semua
          </NuxtLink>
        </header>

        <div v-if="data.recentHistory.length > 0" class="divide-y divide-gray-50 dark:divide-slate-700/60">
          <NuxtLink
            v-for="item in data.recentHistory"
            :key="item.id"
            to="/siswa/riwayat"
            class="flex items-center gap-3 px-5 py-3 active:bg-gray-50 dark:active:bg-slate-700/40 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ item.mapel }}</p>
                <span v-if="item.isGuruBerhalangan" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex-shrink-0">
                  <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Berhalangan
                </span>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatTanggal(item.tanggal) }} — {{ item.kelas }}</p>
              <p v-if="item.isGuruBerhalangan && item.petugasPiketNama" class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                Petugas Piket: {{ item.petugasPiketNama }}
              </p>
            </div>
            <span class="inline-flex items-center gap-1.5 flex-shrink-0">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :class="statusDotColor[item.status] || 'bg-gray-400'"></span>
              <span class="text-xs text-gray-600 dark:text-gray-400">{{ statusLabels[item.status] || item.status }}</span>
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

    <ConfirmDialog
      :show="confirmHideStatus"
      title="Sembunyikan Status"
      message="Status kehadiran akan disembunyikan dari beranda. Data absensi tetap tersimpan."
      variant="warning"
      confirm-label="Ya, Sembunyikan"
      @confirm="hideStatusCard"
      @cancel="confirmHideStatus = false"
    />
  </StudentLayout>
</template>
