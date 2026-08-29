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
const pageSize = 10

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
  return (sessions.value || []).filter(s => {
    const d = new Date(s.tanggal)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  }).length
})

const rataRataKeseluruhan = computed(() => {
  const rows = (sessions.value || []).filter(s => s.average !== null && s.count > 0)
  if (!rows.length) return null
  const totalWeighted = rows.reduce((sum, s) => sum + (s.average as number) * s.count, 0)
  const totalCount = rows.reduce((sum, s) => sum + s.count, 0)
  return totalCount ? totalWeighted / totalCount : null
})

const responseRate = computed(() => {
  const rows = sessions.value || []
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
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-card dark:shadow-dark-card">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center">
              <svg class="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Total Sesi (Bulan Ini)</p>
              <p class="text-2xl font-black text-gray-900 dark:text-gray-100">{{ totalSesiBulanIni }}</p>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-card dark:shadow-dark-card">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Rata-rata Rating</p>
              <p class="text-2xl font-black text-gray-900 dark:text-gray-100">
                {{ rataRataKeseluruhan !== null ? rataRataKeseluruhan.toFixed(1) : '–' }}
                <span class="text-sm font-normal text-gray-400">/ 5.0</span>
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 shadow-card dark:shadow-dark-card">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400">Response Rate</p>
              <p class="text-2xl font-black text-gray-900 dark:text-gray-100">
                {{ responseRate.toFixed(0) }}<span class="text-sm font-normal text-gray-400">%</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Search Bar & Filters -->
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <div class="relative max-w-sm flex-1 min-w-[220px]">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari mata pelajaran atau kelas..."
            class="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <select
          v-model="filterMapel"
          class="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option v-for="m in mapelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <select
          v-model="filterBulan"
          class="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option v-for="b in bulanOptions" :key="b.value" :value="b.value">{{ b.label }}</option>
        </select>
        <select
          v-model="filterTahun"
          class="px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option v-for="t in tahunOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
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

        <div v-if="filteredSessions.length > pageSize" class="flex items-center justify-between px-6 py-3 border-t border-gray-100 dark:border-slate-700">
          <button @click="page--" :disabled="page <= 1" class="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50">
            Sebelumnya
          </button>
          <span class="text-xs text-gray-500">Halaman {{ page }} dari {{ totalPages }}</span>
          <button @click="page++" :disabled="page >= totalPages" class="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50">
            Selanjutnya
          </button>
        </div>
      </div>
    </template>

    <!-- Detail Analytics Modal -->
    <BaseModal :show="showModal" :title="`Analisis Rating - ${selectedSession?.mapel || ''} (${selectedSession?.kelas || ''})`" max-w="max-w-2xl" @close="closeModal">
      <div v-if="selectedSession" class="space-y-6">
        <!-- Summary Cards -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">Rata-rata Bintang</p>
            <p class="text-2xl font-black text-amber-500 mt-1">★ {{ selectedSession.average !== null ? selectedSession.average.toFixed(1) : '–' }} <span class="text-sm font-normal text-gray-400">/ 5.0</span></p>
          </div>
          <div class="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-2xl border border-gray-100 dark:border-slate-700 text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">Tingkat Partisipasi</p>
            <p class="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">
              {{ selectedSession.count }} <span class="text-sm font-normal text-gray-400">/ {{ selectedSession.totalSiswa }} Siswa</span>
            </p>
          </div>
        </div>

        <!-- Star Distribution Breakdown -->
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Distribusi Rating</h4>
          <div class="space-y-2">
            <div v-for="star in [5, 4, 3, 2, 1]" :key="star" class="flex items-center gap-3 text-xs">
              <span class="w-10 font-medium text-gray-700 dark:text-gray-300">{{ star }} Bintang</span>
              <div class="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  class="h-full bg-amber-400 rounded-full transition-all"
                  :style="{ width: selectedSession.count ? `${(selectedSession.distribution[star] / selectedSession.count) * 100}%` : '0%' }"
                ></div>
              </div>
              <span class="w-12 text-right text-gray-500 dark:text-gray-400 font-medium">
                {{ selectedSession.distribution[star] }} ({{ selectedSession.count ? Math.round((selectedSession.distribution[star] / selectedSession.count) * 100) : 0 }}%)
              </span>
            </div>
          </div>
        </div>

        <!-- Student Responses Table -->
        <div>
          <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Daftar Respon Siswa</h4>
          <div class="max-h-60 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700 text-xs">
            <div v-for="stu in selectedSession.students" :key="stu.id" class="p-3 flex items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-slate-700/20">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-gray-900 dark:text-gray-100">{{ stu.nama }}</p>
                <p class="text-[11px] text-gray-400">NISN: {{ stu.nisn }} · Absen: {{ stu.attendanceStatus }}</p>
                <p v-if="stu.tags" class="text-[11px] text-primary-600 dark:text-primary-400 mt-0.5">🏷️ {{ stu.tags }}</p>
                <p v-if="stu.komentar" class="text-gray-600 dark:text-gray-300 italic mt-0.5">"{{ stu.komentar }}"</p>
              </div>
              <div class="flex-shrink-0 text-right">
                <span v-if="stu.rating" class="inline-flex items-center gap-1 font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                  ★ {{ stu.rating }}
                </span>
                <span v-else class="text-gray-400 italic">Belum merespons</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <button @click="closeModal" class="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
          Tutup
        </button>
      </template>
    </BaseModal>
  </PTKLayout>
</template>
