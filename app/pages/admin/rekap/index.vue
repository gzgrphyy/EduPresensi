<script setup lang="ts">
interface RekapItem {
  kelasId: number
  kelas: string
  totalSiswa: number
  totalSesi?: number
  hadir: number
  sakit: number
  izin: number
  alpha: number
  pending: number
  persentase: number
}

interface DetailSiswaItem {
  siswaId: number
  nama: string
  nisn: string
  foto: string | null
  hadir: number
  sakit: number
  izin: number
  alpha: number
  pending: number
  totalSesi: number
  persentase: number
  pelajaran?: Record<string, {
    hadir: number
    sakit: number
    izin: number
    alpha: number
    pending: number
    totalSesi: number
    persentase: number
  }>
}

interface DetailSesiItem {
  id: number
  tanggal: string
  hari: string
  mapel: string
  jamMulai: string
  jamSelesai: string
  ruangan: string
  guru: string
  status: string
  totalSiswa: number
  hadir: number
  sakit: number
  izin: number
  alpha: number
  pending: number
  persentase: number
}

interface DetailKelasResponse {
  kelas: {
    id: number
    nama: string
    waliKelas: { id: number; nama: string; nip: string | null; jenisKelamin: string | null } | null
    semester: { id: number; nama: string; kodeAngka: number | null; pakaiRomawi: boolean; tahunAjaran: { id: number; nama: string } }
    totalMurid: number
  }
  summary: {
    totalSesi: number
    totalHadir: number
    totalSakit: number
    totalIzin: number
    totalAlpha: number
    totalPending: number
  }
  daftarMapel: string[]
  siswa: DetailSiswaItem[]
  sesi: DetailSesiItem[]
}

const { t } = useI18n()

const currentBulan = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const selectedBulan = ref(currentBulan())
const selectedSemester = ref<number | ''>('')
const selectedKelas = ref<number | ''>('')

const appliedBulan = ref(currentBulan())
const appliedSemester = ref<number | ''>('')
const appliedKelas = ref<number | ''>('')

// State modal detail kelas
const detailKelas = ref<{ id: number; nama: string } | null>(null)
const activeTab = ref<'murid' | 'sesi'>('murid')
const searchMurid = ref('')
const searchSesi = ref('')
const selectedDetailMapel = ref('')
const selectedDetailTanggal = ref('')

const detailQueryParams = computed(() => ({
  ...(appliedSemester.value ? { semesterId: appliedSemester.value } : {}),
  ...(selectedDetailTanggal.value ? { tanggal: selectedDetailTanggal.value } : {})
}))

const { data: detailData, pending: detailPending, refresh: refreshDetail } = useFetch<DetailKelasResponse>(
  () => detailKelas.value ? `/api/admin/rekap/detail/${detailKelas.value.id}` : '',
  {
    query: detailQueryParams,
    immediate: false,
    watch: false
  }
)

function formatStatusSesi(status: string) {
  if (status === 'AKTIF') return t('admin.rekapSesi.sesiAktif') || 'Aktif'
  if (status === 'SELESAI') return t('admin.rekapSesi.sesiSelesai') || 'Selesai'
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function openDetailModal(item: RekapItem) {
  detailKelas.value = { id: item.kelasId, nama: item.kelas }
  activeTab.value = 'murid'
  searchMurid.value = ''
  searchSesi.value = ''
  selectedDetailMapel.value = ''
  selectedDetailTanggal.value = ''
  refreshDetail()
}

watch(selectedDetailTanggal, () => {
  if (detailKelas.value) refreshDetail()
})

function closeDetailModal() {
  detailKelas.value = null
}

const filteredDetailSiswa = computed(() => {
  const q = searchMurid.value.trim().toLowerCase()
  const mapel = selectedDetailMapel.value
  const list = detailData.value?.siswa || []

  return list
    .filter(s => !q || s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q))
    .map(s => {
      if (!mapel || !s.pelajaran || !s.pelajaran[mapel]) {
        return {
          siswaId: s.siswaId,
          nama: s.nama,
          nisn: s.nisn,
          hadir: s.hadir,
          sakit: s.sakit,
          izin: s.izin,
          alpha: s.alpha,
          pending: s.pending,
          totalSesi: s.totalSesi,
          persentase: s.persentase
        }
      }
      const pel = s.pelajaran[mapel]
      return {
        siswaId: s.siswaId,
        nama: s.nama,
        nisn: s.nisn,
        hadir: pel.hadir,
        sakit: pel.sakit,
        izin: pel.izin,
        alpha: pel.alpha,
        pending: pel.pending,
        totalSesi: pel.totalSesi,
        persentase: pel.persentase
      }
    })
})

const activeSummary = computed(() => {
  if (!selectedDetailMapel.value || !detailData.value) {
    return detailData.value?.summary || {
      totalSesi: 0,
      totalHadir: 0,
      totalSakit: 0,
      totalIzin: 0,
      totalAlpha: 0,
      totalPending: 0
    }
  }

  const mapel = selectedDetailMapel.value
  const sesiMapel = (detailData.value.sesi || []).filter(s => s.mapel === mapel)
  const siswaList = filteredDetailSiswa.value

  return {
    totalSesi: sesiMapel.length,
    totalHadir: siswaList.reduce((acc, s) => acc + s.hadir, 0),
    totalSakit: siswaList.reduce((acc, s) => acc + s.sakit, 0),
    totalIzin: siswaList.reduce((acc, s) => acc + s.izin, 0),
    totalAlpha: siswaList.reduce((acc, s) => acc + s.alpha, 0),
    totalPending: siswaList.reduce((acc, s) => acc + s.pending, 0)
  }
})

const filteredDetailSesi = computed(() => {
  const q = searchSesi.value.trim().toLowerCase()
  const mapel = selectedDetailMapel.value
  const list = detailData.value?.sesi || []

  return list.filter(s => {
    const matchMapel = !mapel || s.mapel === mapel
    const matchSearch = !q || (
      s.mapel.toLowerCase().includes(q) ||
      s.guru.toLowerCase().includes(q) ||
      s.ruangan.toLowerCase().includes(q) ||
      s.tanggal.includes(q)
    )
    return matchMapel && matchSearch
  })
})

const { data: semesterList } = useFetch<{ id: number; nama: string; kodeAngka: number | null; pakaiRomawi: boolean; isActive: boolean; tahunAjaran: { id: number; nama: string } }[]>('/api/admin/semester', { immediate: true })

function activeSemesterId() {
  return semesterList.value?.find(s => s.isActive)?.id ?? ''
}

// Default semester = semester yang aktif (isActive).
// Kelas default-nya nanti dipilih lewat watcher kelasList.
watch(
  semesterList,
  (list) => {
    if (!list?.some(s => s.isActive)) return
    if (appliedSemester.value !== '') return
    selectedSemester.value = activeSemesterId()
    appliedSemester.value = activeSemesterId()
    selectedKelas.value = ''
    appliedKelas.value = ''
  },
  { immediate: true }
)

const kelasQuery = computed(() => ({
  ...(selectedSemester.value ? { semesterId: selectedSemester.value } : {})
}))

const { data: kelasList, refresh: refreshKelas } = useFetch<{ id: number; nama: string; semesterId: number }[]>('/api/admin/kelas', {
  query: kelasQuery,
  immediate: true
})

// Default kelas = kelas pertama dari daftar yang sedang aktif.
// Saat semester berubah, draft kelas ikut di-reset ke kelas pertama daftar barunya.
watch(
  kelasList,
  (list) => {
    if (!list?.length) return
    selectedKelas.value = list[0].id
    // Terapkan default kelas hanya jika daftar ini sesuai semester yang dipakai
    if (!appliedKelas.value && (!appliedSemester.value || list[0].semesterId === appliedSemester.value)) {
      appliedKelas.value = list[0].id
    }
  },
  { immediate: true }
)

const queryParams = computed(() => ({
  ...(appliedBulan.value ? { bulan: appliedBulan.value } : {}),
  ...(appliedSemester.value ? { semesterId: appliedSemester.value } : {}),
  ...(appliedKelas.value ? { kelasId: appliedKelas.value } : {}),
}))

const { data, pending } = useFetch<RekapItem[]>('/api/admin/rekap', {
  query: queryParams,
  immediate: true,
  transform: (res: any) => Array.isArray(res) ? res : []
})

// Terapkan filter: salin nilai draft ke nilai applied (useFetch otomatis refetch)
function applyFilter() {
  appliedBulan.value = selectedBulan.value
  appliedSemester.value = selectedSemester.value
  appliedKelas.value = selectedKelas.value
}

// Atur Ulang: kembalikan ke default (semester aktif, bulan berjalan, kelas pertama) lalu terapkan langsung
// refreshKelas() memastikan watcher kelasList dijalankan dan kelas pertama dipakai sebagai default.
async function resetFilter() {
  const defaultSemester = activeSemesterId()
  selectedBulan.value = currentBulan()
  selectedSemester.value = defaultSemester
  selectedKelas.value = ''
  appliedBulan.value = currentBulan()
  appliedSemester.value = defaultSemester
  appliedKelas.value = ''

  await refreshKelas()
}

const page = ref(1)
const pageSize = 10

const displayData = computed(() => (Array.isArray(data.value) ? data.value : []))

const totalPages = computed(() => Math.max(1, Math.ceil(displayData.value.length / pageSize)))

const pageNumbers = computed<(number | '...')[]>(() => {
  const total = totalPages.value
  const current = page.value
  const set = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = [...set].filter(n => n >= 1 && n <= total).sort((a, b) => a - b)
  const result: (number | '...')[] = []
  let prev = 0
  for (const n of sorted) {
    if (n - prev > 1) result.push('...')
    result.push(n)
    prev = n
  }
  return result
})

const visibleData = computed(() => {
  const start = (page.value - 1) * pageSize
  return displayData.value.slice(start, start + pageSize)
})

watch([appliedBulan, appliedSemester, appliedKelas], () => {
  page.value = 1
})

watch(() => displayData.value.length, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

const bulanOptions = computed(() => {
  const options = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })
    options.push({ value, label })
  }
  return options
})

const totalHadir = computed(() => displayData.value.reduce((a, b) => a + b.hadir, 0))
const totalSiswa = computed(() => displayData.value.reduce((a, b) => a + b.totalSiswa, 0))
const totalSakit = computed(() => displayData.value.reduce((a, b) => a + b.sakit, 0))
const totalIzin = computed(() => displayData.value.reduce((a, b) => a + b.izin, 0))
const totalAlpha = computed(() => displayData.value.reduce((a, b) => a + b.alpha, 0))
const totalPending = computed(() => displayData.value.reduce((a, b) => a + b.pending, 0))
const rataPersentase = computed(() => {
  if (!displayData.value.length) return 0
  const sumPersentase = displayData.value.reduce((a, b) => a + b.persentase, 0)
  return (sumPersentase / displayData.value.length).toFixed(1)
})
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.rekap.title')" :description="t('admin.rekap.desc')" />

    <div class="flex flex-wrap items-end gap-3 mb-5">
      <!-- Filter: Semester -->
      <div class="flex flex-col gap-1 min-w-[180px]">
        <label class="text-xs text-gray-500">{{ t('admin.rekap.labelSemester') }}</label>
        <select v-model="selectedSemester"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
          <option :value="''">{{ t('admin.rekap.semuaSemester') }}</option>
          <option v-for="s in semesterList" :key="s.id" :value="s.id">{{ s.tahunAjaran.nama }} ({{ semesterFullLabel(s, t) }})</option>
        </select>
      </div>

      <!-- Filter: Kelas -->
      <div class="flex flex-col gap-1 min-w-[160px]">
        <label class="text-xs text-gray-500">{{ t('admin.rekap.labelKelas') }}</label>
        <select v-model="selectedKelas"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
          <option :value="''">{{ t('admin.jadwal.semuaKelas') }}</option>
          <option v-for="k in kelasList" :key="k.id" :value="k.id">{{ k.nama }}</option>
        </select>
      </div>

      <!-- Filter: Periode Bulan -->
      <div class="flex flex-col gap-1 min-w-[180px]">
        <label class="text-xs text-gray-500">{{ t('admin.rekap.labelPeriode') }}</label>
        <select v-model="selectedBulan"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600">
          <option value="">{{ t('admin.rekap.semuaPeriode') }}</option>
          <option v-for="o in bulanOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>

      <!-- Tombol Terapkan -->
      <button @click="applyFilter()"
        class="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md border border-blue-600 transition-colors">
        {{ t('common.terapkan') }}
      </button>

      <!-- Tombol Reset -->
      <button @click="resetFilter()"
        class="px-3 py-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md border admin-accent-border transition-colors">
        {{ t('common.aturUlang') }}
      </button>
    </div>

    <LoadingSkeleton v-if="pending" type="table" :rows="6" :columns="8" />

    <template v-else>
      <!-- 3 Summary Containers -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-3">
        <!-- Container 1: Total Murid -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border admin-accent-border p-4">
          <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">{{ t('admin.rekap.statTotalMurid') }}</p>
          <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{{ totalSiswa }}</p>
        </div>

        <!-- Container 2: Rata-rata Kehadiran -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border admin-accent-border p-4">
          <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">{{ t('admin.rekap.statRata') }}</p>
          <p class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{{ rataPersentase }}%</p>
        </div>

        <!-- Container 3: Menunggu Persetujuan -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border admin-accent-border p-4">
          <div class="flex items-center justify-between">
            <p class="text-xs text-gray-500 dark:text-gray-400 font-medium">{{ t('admin.rekap.statPending') }}</p>
            <span v-if="totalPending > 0" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
              Perlu Review
            </span>
          </div>
          <p class="text-xl font-bold mt-1" :class="totalPending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'">
            {{ totalPending }}
          </p>
        </div>
      </div>

      <!-- Breakdown Text Only -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-5 px-1">
        <span>{{ t('admin.rekap.statHadir') }} <strong class="font-semibold text-gray-800 dark:text-gray-200">{{ totalHadir }}</strong></span>
        <span class="text-gray-300 dark:text-slate-600">·</span>
        <span>{{ t('admin.rekap.statSakit') }} <strong class="font-semibold text-gray-800 dark:text-gray-200">{{ totalSakit }}</strong></span>
        <span class="text-gray-300 dark:text-slate-600">·</span>
        <span>{{ t('admin.rekap.statIzin') }} <strong class="font-semibold text-gray-800 dark:text-gray-200">{{ totalIzin }}</strong></span>
        <span class="text-gray-300 dark:text-slate-600">·</span>
        <span>{{ t('admin.rekap.statAlpha') }} <strong class="font-semibold" :class="totalAlpha > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'">{{ totalAlpha }}</strong></span>
      </div>

      <BaseCard>
        <div class="overflow-x-auto scrollbar-thin">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th class="text-left px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colKelas') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colTotalMurid') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colHadir') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colSakit') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colIzin') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colAlpha') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colPersentase') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.rekap.colAksi') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="item in visibleData" :key="item.kelas" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{{ item.kelas }}</td>
                <td class="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{{ item.totalSiswa }}</td>
                <td class="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">{{ item.hadir }}</td>
                <td class="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{{ item.sakit }}</td>
                <td class="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{{ item.izin }}</td>
                <td class="px-4 py-3 text-center" :class="item.alpha > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-gray-300'">
                  {{ item.alpha }}
                </td>
                <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-semibold">{{ item.persentase }}%</td>
                <td class="px-4 py-3 text-center">
                  <button
                    @click="openDetailModal(item)"
                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                    :title="t('admin.rekap.lihatDetail')"
                  >
                    <svg class="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {{ t('admin.rekap.lihatDetail') }}
                  </button>
                </td>
              </tr>
              <tr v-if="displayData.length === 0">
                <td colspan="8" class="px-4 py-16 text-center text-gray-400 dark:text-gray-500">
                  {{ t('admin.rekap.belumAdaData') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls -->
        <div
          v-if="displayData.length > pageSize"
          class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3"
        >
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ t('common.menampilkan', {
              from: ((page - 1) * pageSize) + 1,
              to: Math.min(page * pageSize, displayData.length),
              total: displayData.length,
              unit: t('admin.kelas.unitKelas') || 'kelas'
            }) }}
          </p>
          <div class="ml-auto flex items-center gap-2">
            <button
              @click="page--"
              :disabled="page <= 1"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              {{ t('common.sebelumnya') }}
            </button>
            <div class="flex items-center gap-1">
              <template v-for="(n, i) in pageNumbers" :key="i">
                <button
                  v-if="n !== '...'"
                  @click="page = n"
                  :disabled="n === page"
                  :class="n === page
                    ? 'w-7 h-7 rounded-md text-xs text-white bg-primary-600 ring-1 ring-primary-600 cursor-default'
                    : 'w-7 h-7 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors'"
                >
                  {{ n }}
                </button>
                <span v-else class="px-0.5 text-xs text-gray-400 dark:text-gray-500 select-none">&hellip;</span>
              </template>
            </div>
            <button
              @click="page++"
              :disabled="page >= totalPages"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {{ t('common.selanjutnya') }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </BaseCard>
    </template>

    <!-- Modal Detail Rekap Kelas -->
    <BaseModal
      :show="!!detailKelas"
      :title="t('admin.rekap.detailModalTitle') + (detailKelas ? ' — ' + detailKelas.nama : '')"
      maxWidth="max-w-4xl"
      @close="closeDetailModal()"
    >
      <div v-if="detailPending" class="py-12">
        <LoadingSkeleton type="table" :rows="5" :columns="6" />
      </div>

      <div v-else-if="detailData" class="space-y-4">
        <!-- Header Info Card -->
        <div class="bg-gray-50 dark:bg-slate-700/40 rounded-xl border admin-accent-border overflow-hidden">
          <div class="p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ detailData.kelas.nama }}</h3>
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    ({{ detailData.kelas.semester.tahunAjaran.nama }} - {{ semesterFullLabel(detailData.kelas.semester, t) }})
                  </span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ t('admin.kelas.colWali') }}: <span class="font-medium text-gray-700 dark:text-gray-200">{{ detailData.kelas.waliKelas?.nama || '-' }}</span>
                  • <span class="font-medium text-gray-700 dark:text-gray-200">{{ detailData.kelas.totalMurid }} {{ t('admin.siswa.unitMurid') }}</span>
                  • <span class="font-medium text-gray-700 dark:text-gray-200">{{ activeSummary.totalSesi }} {{ t('admin.rekap.totalSesi') }}</span>
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <NuxtLink
                :to="`/admin/kelas/${detailData.kelas.id}`"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors shadow-sm"
              >
                {{ t('admin.rekap.bukaHalamanKelas') }}
              </NuxtLink>
            </div>
          </div>

          <!-- Filter Indicator (integrated into header card) -->
          <div class="px-4 py-2 border-t border-gray-200/60 dark:border-slate-600/60 flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <svg class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span v-if="selectedDetailMapel && selectedDetailTanggal">
                {{ t('admin.rekap.sedangMelihatMapel') }} <strong class="font-bold text-gray-900 dark:text-gray-100">{{ selectedDetailMapel }}</strong> pada <strong class="font-bold text-gray-900 dark:text-gray-100">{{ new Date(selectedDetailTanggal + 'T00:00:00').toLocaleDateString('id-ID') }}</strong>
              </span>
              <span v-else-if="selectedDetailMapel">
                {{ t('admin.rekap.sedangMelihatMapel') }} <strong class="font-bold text-gray-900 dark:text-gray-100">{{ selectedDetailMapel }}</strong>
              </span>
              <span v-else-if="selectedDetailTanggal">
                Sedang melihat tanggal <strong class="font-bold text-gray-900 dark:text-gray-100">{{ new Date(selectedDetailTanggal + 'T00:00:00').toLocaleDateString('id-ID') }}</strong>
              </span>
              <span v-else>
                {{ t('admin.rekap.sedangMelihatSemua') }}
              </span>
            </div>
            <button
              v-if="selectedDetailMapel || selectedDetailTanggal"
              @click="selectedDetailMapel = ''; selectedDetailTanggal = ''"
              class="text-[11px] font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
            >
              Reset filter
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <!-- Ringkasan Status (inline, netral kecuali Alpha) -->
        <div class="flex flex-wrap items-end gap-x-5 gap-y-2 px-1">
          <div class="text-center">
            <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('admin.rekap.statHadir') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ activeSummary.totalHadir }}</p>
          </div>
          <div class="text-center">
            <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('admin.rekap.statSakit') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ activeSummary.totalSakit }}</p>
          </div>
          <div class="text-center">
            <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('admin.rekap.statIzin') }}</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ activeSummary.totalIzin }}</p>
          </div>
          <div class="text-center">
            <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ t('admin.rekap.statAlpha') }}</p>
            <p class="text-2xl font-bold" :class="activeSummary.totalAlpha > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'">
              {{ activeSummary.totalAlpha }}
            </p>
          </div>
        </div>

        <!-- Tab Nav & Filter Search -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b admin-accent-border pb-2 pt-1">
          <!-- Segmented Control Pill Container -->
          <div class="p-1 bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 inline-flex items-center">
            <button
              @click="activeTab = 'murid'"
              class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all"
              :class="activeTab === 'murid'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-sm font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
            >
              {{ t('admin.rekap.tabMurid') }}
              <span class="px-1.5 py-0.2 rounded-full text-[10px]" :class="activeTab === 'murid' ? 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-200' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'">
                {{ detailData.siswa.length }}
              </span>
            </button>
            <button
              @click="activeTab = 'sesi'"
              class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-all"
              :class="activeTab === 'sesi'
                ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-sm font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'"
            >
              {{ t('admin.rekap.tabSesi') }}
              <span class="px-1.5 py-0.2 rounded-full text-[10px]" :class="activeTab === 'sesi' ? 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-200' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'">
                {{ filteredDetailSesi.length }}
              </span>
            </button>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Filter Dropdown Mapel with Modern Focus & Radius -->
             <select
               v-if="detailData.daftarMapel?.length"
               v-model="selectedDetailMapel"
               class="px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-sm transition-shadow"
             >
              <option value="">{{ t('admin.rekap.semuaMapel') }}</option>
              <option v-for="m in detailData.daftarMapel" :key="m" :value="m">{{ m }}</option>
            </select>

            <!-- Filter Tanggal -->
            <input
              v-model="selectedDetailTanggal"
              type="date"
              class="px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-sm transition-shadow"
            />

            <!-- Search with Magnifier Icon -->
            <div class="relative w-full sm:w-56">
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
               <input
                 v-if="activeTab === 'murid'"
                 v-model="searchMurid"
                 type="text"
                 :placeholder="t('admin.rekap.cariMurid')"
                 class="w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-sm"
               />
               <input
                 v-else
                 v-model="searchSesi"
                 type="text"
                 :placeholder="t('admin.rekap.cariSesi')"
                 class="w-full pl-8 pr-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-sm"
               />
            </div>
          </div>
        </div>

        <!-- Tab Content 1: Rekap per Murid -->
        <div v-if="activeTab === 'murid'" class="overflow-x-auto scrollbar-thin border admin-accent-border rounded-lg max-h-96">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-gray-50 dark:bg-slate-700 z-10">
              <tr class="border-b admin-accent-border">
                <th class="text-left px-3.5 py-2.5 text-gray-600 dark:text-gray-300 font-semibold w-10">No</th>
                <th class="text-left px-3.5 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">Nama Murid</th>
                <th class="text-center px-3.5 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">{{ t('admin.rekap.statHadir') }}</th>
                <th class="text-center px-3.5 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">{{ t('admin.rekap.statSakit') }}</th>
                <th class="text-center px-3.5 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">{{ t('admin.rekap.statIzin') }}</th>
                <th class="text-center px-3.5 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">{{ t('admin.rekap.statAlpha') }}</th>
                <th class="text-left px-4 py-2.5 text-gray-600 dark:text-gray-300 font-semibold w-36">% Kehadiran</th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="(s, idx) in filteredDetailSiswa" :key="s.siswaId"
                class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                :class="s.alpha > 0 ? 'bg-red-50/40 dark:bg-red-950/15' : ''"
              >
                <td class="px-3.5 py-2.5 text-gray-400 dark:text-gray-500">{{ idx + 1 }}</td>
                <td class="px-3.5 py-2.5">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ s.nama }}</span>
                  <span class="block text-[10px] text-gray-400 dark:text-gray-500">{{ s.nisn }}</span>
                </td>
                <td class="px-3.5 py-2.5 text-center text-gray-700 dark:text-gray-300">{{ s.hadir }}</td>
                <td class="px-3.5 py-2.5 text-center text-gray-700 dark:text-gray-300">{{ s.sakit }}</td>
                <td class="px-3.5 py-2.5 text-center text-gray-700 dark:text-gray-300">{{ s.izin }}</td>
                <td class="px-3.5 py-2.5 text-center" :class="s.alpha > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-300'">{{ s.alpha }}</td>
                <td class="px-4 py-2.5">
                  <span class="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {{ s.persentase }}%
                  </span>
                </td>
              </tr>
              <tr v-if="filteredDetailSiswa.length === 0">
                <td colspan="7" class="px-3 py-8 text-center text-gray-400 dark:text-gray-500">
                  {{ t('admin.rekap.emptyMurid') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tab Content 2: Riwayat Sesi Pelajaran -->
        <div v-else class="overflow-x-auto scrollbar-thin border admin-accent-border rounded-lg max-h-96">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-gray-50 dark:bg-slate-700 z-10">
              <tr class="border-b admin-accent-border">
                <th class="text-left px-3 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">Tanggal & Jam</th>
                <th class="text-left px-3 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">Mata Pelajaran</th>
                <th class="text-left px-3 py-2.5 text-gray-600 dark:text-gray-300 font-semibold hidden sm:table-cell">Guru</th>
                <th class="text-left px-3 py-2.5 text-gray-600 dark:text-gray-300 font-semibold hidden md:table-cell">Ruangan</th>
                <th class="text-center px-3 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">Kehadiran</th>
                <th class="text-center px-3 py-2.5 text-gray-600 dark:text-gray-300 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="sesi in filteredDetailSesi" :key="sesi.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ new Date(sesi.tanggal).toLocaleDateString('id-ID') }}</span>
                  <span class="block text-[11px] text-gray-500 dark:text-gray-400">{{ sesi.jamMulai }} - {{ sesi.jamSelesai }}</span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ sesi.mapel }}</span>
                  <span class="block text-[10px] text-gray-400 sm:hidden">{{ sesi.guru }}</span>
                </td>
                <td class="px-3 py-2.5 text-gray-600 dark:text-gray-300 hidden sm:table-cell">{{ sesi.guru }}</td>
                <td class="px-3 py-2.5 text-gray-600 dark:text-gray-300 hidden md:table-cell">{{ sesi.ruangan }}</td>
                <td class="px-3 py-2.5 text-center">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ sesi.hadir }}</span> / {{ sesi.totalSiswa }}
                  <span class="text-[11px] text-gray-500 dark:text-gray-400 block">
                    ({{ sesi.persentase }}%)
                  </span>
                </td>
                <td class="px-3 py-2.5 text-center">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="sesi.status === 'AKTIF' ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ formatStatusSesi(sesi.status) }}</span>
                  </span>
                </td>
              </tr>
              <tr v-if="filteredDetailSesi.length === 0">
                <td colspan="6" class="px-3 py-8 text-center text-gray-400 dark:text-gray-500">
                  {{ t('admin.rekap.emptySesi') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <button
          @click="closeDetailModal()"
          class="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md border admin-accent-border transition-colors"
        >
          {{ t('common.tutup') }}
        </button>
      </template>
    </BaseModal>
  </AppLayout>
</template>

