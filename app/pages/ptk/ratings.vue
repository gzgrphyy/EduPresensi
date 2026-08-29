<script setup lang="ts">
interface RatingItem {
  id: number
  rating: number
  tags: string | null
  komentar: string | null
  createdAt: string
  siswa: { id: number; nama: string }
}

interface StudentRatingDetail {
  id: number
  nama: string
  nisn: string
  attendanceStatus: string
  rating: number | null
  tags: string | null
  komentar: string | null
}

interface SessionRating {
  id: number
  tanggal: string
  mapel: string
  kelas: string
  totalSiswa: number
  totalHadir: number
  average: number | null
  count: number
  distribution: Record<number, number>
  students: StudentRatingDetail[]
  ratings: RatingItem[]
}

const { data: sessions, pending, error } = useFetch<SessionRating[]>('/api/absensi/ratings', { immediate: true })

const searchQuery = ref('')
const filterMapel = ref('')
const filterBulan = ref('')
const filterTahun = ref('')
const page = ref(1)
const pageSize = 5

const mapelOptions = computed(() => {
  const mapels = new Set<string>()
  for (const s of sessions.value || []) {
    if (s.mapel) mapels.add(s.mapel)
  }
  return [
    { label: 'Semua Mata Pelajaran', value: '' },
    ...[...mapels].sort().map(m => ({ label: m, value: m }))
  ]
})

const bulanOptions = [
  { label: 'Semua Bulan', value: '' },
  { label: 'Januari', value: '1' },
  { label: 'Februari', value: '2' },
  { label: 'Maret', value: '3' },
  { label: 'April', value: '4' },
  { label: 'Mei', value: '5' },
  { label: 'Juni', value: '6' },
  { label: 'Juli', value: '7' },
  { label: 'Agustus', value: '8' },
  { label: 'September', value: '9' },
  { label: 'Oktober', value: '10' },
  { label: 'November', value: '11' },
  { label: 'Desember', value: '12' },
]

const tahunOptions = computed(() => {
  const years = new Set<string>()
  for (const s of sessions.value || []) {
    if (s.tanggal) years.add(new Date(s.tanggal).getFullYear().toString())
  }
  if (!years.size) years.add(new Date().getFullYear().toString())
  return [
    { label: 'Semua Tahun', value: '' },
    ...[...years].sort().reverse().map(y => ({ label: y, value: y }))
  ]
})

const filteredSessions = computed(() => {
  const rows = sessions.value || []
  const q = searchQuery.value.trim().toLowerCase()
  return rows.filter(s => {
    if (filterMapel.value && s.mapel !== filterMapel.value) return false
    if (filterBulan.value) {
      const d = new Date(s.tanggal)
      if ((d.getMonth() + 1).toString() !== filterBulan.value) return false
    }
    if (filterTahun.value) {
      const d = new Date(s.tanggal)
      if (d.getFullYear().toString() !== filterTahun.value) return false
    }
    if (!q) return true
    return (
      s.mapel.toLowerCase().includes(q) ||
      s.kelas.toLowerCase().includes(q) ||
      new Date(s.tanggal).toLocaleDateString('id-ID').toLowerCase().includes(q)
    )
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredSessions.value.length / pageSize)))

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

const visible = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredSessions.value.slice(start, start + pageSize)
})

watch([searchQuery, filterMapel, filterBulan, filterTahun], () => { page.value = 1 })

// Summary cards
const now = new Date()
const thisMonth = now.getMonth()
const thisYear = now.getFullYear()

const totalSesiBulanIni = computed(() => {
  return filteredSessions.value.length
})

const rataRataKeseluruhan = computed(() => {
  const rows = filteredSessions.value.filter(s => s.average !== null && s.count > 0)
  if (!rows.length) return null
  const totalWeighted = rows.reduce((sum, s) => sum + (s.average as number) * s.count, 0)
  const totalCount = rows.reduce((sum, s) => sum + s.count, 0)
  return totalCount ? totalWeighted / totalCount : null
})

const responseRate = computed(() => {
  const rows = filteredSessions.value
  const totalHadirSeharusnya = rows.reduce((sum, s) => sum + s.totalHadir, 0)
  const totalYangRating = rows.reduce((sum, s) => sum + s.count, 0)
  if (!totalHadirSeharusnya) return 0
  return (totalYangRating / totalHadirSeharusnya) * 100
})

// Modal state
const showModal = ref(false)
const selectedSession = ref<SessionRating | null>(null)

function openDetailModal(s: SessionRating) {
  selectedSession.value = s
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedSession.value = null
}
</script>

<template>
  <PTKLayout>
    <PageHeader title="Daftar Rating Kelas" description="Ringkasan rating dan ulasan tiap sesi pengajaran" />

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="5" />

    <div v-else-if="error" class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-8 text-center shadow-card dark:shadow-dark-card">
      <p class="text-gray-500 dark:text-gray-400 font-medium">Gagal memuat data rating</p>
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div class="col-span-2 sm:col-span-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <div class="flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Rata-rata Rating</p>
          </div>
          <p class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
            {{ rataRataKeseluruhan !== null ? rataRataKeseluruhan.toFixed(1) : '–' }}
            <span class="text-sm font-normal text-gray-400">/ 5.0</span>
          </p>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Sesi</p>
          <p class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mt-1">{{ totalSesiBulanIni }}</p>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Response Rate</p>
          <p class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
            {{ responseRate.toFixed(0) }}<span class="text-sm font-normal text-gray-400">%</span>
          </p>
        </div>
      </div>

      <!-- Search Bar & Filters -->
      <div class="mb-4 space-y-2">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari mata pelajaran atau kelas..."
            class="w-full h-9 pl-9 pr-3 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <BaseSelect v-model="filterMapel" :options="mapelOptions" placeholder="Semua Mapel" wider />
          <BaseSelect v-model="filterBulan" :options="bulanOptions" placeholder="Semua Bulan" />
          <BaseSelect v-model="filterTahun" :options="tahunOptions" placeholder="Semua Tahun" />
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden">
        <div class="overflow-x-auto scrollbar-thin">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs">Tanggal</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs">Mata Pelajaran</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 text-xs">Kelas</th>
                <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300 text-xs">Rata‑rata</th>
                <th class="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300 text-xs">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
              <tr v-if="!visible.length">
                <td colspan="5" class="px-4 py-16 text-center text-sm text-gray-400">
                  {{ searchQuery ? 'Tidak ada hasil yang cocok' : 'Belum ada data rating kelas' }}
                </td>
              </tr>
              <tr
                v-for="s in visible"
                :key="s.id"
                @click="openDetailModal(s)"
                class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer"
              >
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {{ new Date(s.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }}
                </td>
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ s.mapel }}</td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ s.kelas }}</td>
                <td class="px-4 py-3 text-center whitespace-nowrap">
                  <span
                    v-if="s.average !== null"
                    class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                  >
                    ★ {{ s.average.toFixed(1) }}
                  </span>
                  <span v-else class="text-sm text-gray-400 dark:text-gray-500">–</span>
                </td>
                <td class="px-4 py-3 text-center" @click.stop>
                  <button @click="openDetailModal(s)" class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors shadow-sm shadow-primary-500/20">
                    Detail
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="filteredSessions.length > pageSize" class="px-4 sm:px-6 py-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-center gap-2">
          <button
            @click="page--"
            :disabled="page <= 1"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Sebelumnya
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
            Selanjutnya
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </template>

    <!-- Detail Analytics Modal -->
    <BaseModal :show="showModal" :title="`Analisis Rating - ${selectedSession?.mapel || ''} (${selectedSession?.kelas || ''})`" max-w="max-w-2xl" @close="closeModal">
      <div v-if="selectedSession" class="space-y-5">
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 text-center">
            <div class="flex items-center justify-center gap-1.5 mb-1">
              <svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Rata-rata Bintang</p>
            </div>
            <p class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {{ selectedSession.average !== null ? selectedSession.average.toFixed(1) : '–' }}
              <span class="text-sm font-normal text-gray-400">/ 5.0</span>
            </p>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 text-center">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tingkat Partisipasi</p>
            <p class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {{ selectedSession.count }}
              <span class="text-sm font-normal text-gray-400">/ {{ selectedSession.totalSiswa }} Siswa</span>
            </p>
          </div>
        </div>

        <!-- Star Distribution Breakdown -->
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
          <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Distribusi Rating</h4>
          <div class="space-y-2.5">
            <div v-for="star in [5, 4, 3, 2, 1]" :key="star" class="flex items-center gap-2.5">
              <div class="flex items-center gap-1 w-16 shrink-0">
                <svg class="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ star }}</span>
              </div>
              <div class="flex-1 h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-amber-400 rounded-full transition-all"
                  :style="{ width: selectedSession.count ? `${(selectedSession.distribution[star] / selectedSession.count) * 100}%` : '0%' }"
                ></div>
              </div>
              <span class="w-14 text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {{ selectedSession.distribution[star] }}
                <span class="text-gray-400 dark:text-gray-500">({{ selectedSession.count ? Math.round((selectedSession.distribution[star] / selectedSession.count) * 100) : 0 }}%)</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Student Responses -->
        <div>
          <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Daftar Respon Siswa</h4>
          <div class="max-h-72 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
            <div v-for="stu in selectedSession.students" :key="stu.id" class="px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-colors">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ stu.nama }}</p>
                  <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">NISN {{ stu.nisn }} · {{ stu.attendanceStatus }}</p>
                  <p v-if="stu.komentar" class="text-xs text-gray-600 dark:text-gray-300 italic mt-1.5 leading-relaxed">"{{ stu.komentar }}"</p>
                  <p v-if="stu.tags" class="text-[11px] text-primary-600 dark:text-primary-400 mt-1">{{ stu.tags }}</p>
                </div>
                <span v-if="stu.rating" class="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                  ★ {{ stu.rating }}
                </span>
                <span v-else class="shrink-0 text-[11px] text-gray-400 dark:text-gray-500 italic">Belum merespons</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button @click="closeModal" class="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          Tutup
        </button>
      </template>
    </BaseModal>
  </PTKLayout>
</template>
