<script setup lang="ts">
interface RatingItem {
  id: number
  rating: number
  tags: string | null
  komentar: string | null
}

interface SessionRating {
  sesiId: number
  tanggal: string
  mapel: string
  kelas: string
  guru: string
  rating: RatingItem | null
}

interface RatingsData {
  sessions: SessionRating[]
  stats: {
    totalDirate: number
    totalHadir: number
    rataRata: number | null
  }
}

const { data, pending, refresh } = useFetch<RatingsData>('/api/siswa/ratings')

const searchQuery = ref('')
const filterMapel = ref('')
const filterBulan = ref('')
const filterTahun = ref('')
const page = ref(1)
const pageSize = 5

const mapelOptions = computed(() => {
  const mapels = new Set<string>()
  for (const s of data.value?.sessions || []) {
    if (s.mapel) mapels.add(s.mapel)
  }
  return [
    { label: 'Semua Mapel', value: '' },
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
  for (const s of data.value?.sessions || []) {
    if (s.tanggal) {
      const d = new Date(s.tanggal)
      if (!isNaN(d.getTime())) years.add(d.getFullYear().toString())
    }
  }
  if (!years.size) years.add(new Date().getFullYear().toString())
  return [
    { label: 'Semua Tahun', value: '' },
    ...[...years].sort().reverse().map(y => ({ label: y, value: y }))
  ]
})

const filteredSessions = computed(() => {
  const rows = data.value?.sessions || []
  const q = searchQuery.value.trim().toLowerCase()
  return rows.filter(s => {
    if (filterMapel.value && s.mapel !== filterMapel.value) return false
    if (filterBulan.value) {
      const d = new Date(s.tanggal)
      if (isNaN(d.getTime()) || (d.getMonth() + 1).toString() !== filterBulan.value) return false
    }
    if (filterTahun.value) {
      const d = new Date(s.tanggal)
      if (isNaN(d.getTime()) || d.getFullYear().toString() !== filterTahun.value) return false
    }
    if (!q) return true
    const tanggal = (() => { const d = new Date(s.tanggal); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID').toLowerCase() })()
    return (
      s.mapel.toLowerCase().includes(q) ||
      s.kelas.toLowerCase().includes(q) ||
      s.guru.toLowerCase().includes(q) ||
      tanggal.includes(q)
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Rating modal
const showRatingModal = ref(false)
const selectedItem = ref<SessionRating | null>(null)
const currentRating = ref(5)
const currentTags = ref<string[]>([])
const currentKomentar = ref('')
const submittingRating = ref(false)

const availableTags = [
  'Materi Sangat Jelas',
  'Guru Ramah & Asik',
  'Suasana Kondusif',
  'Tepat Waktu',
  'Terlalu Cepat',
  'Kurang Jelas'
]

function openRatingModal(item: SessionRating) {
  selectedItem.value = item
  if (item.rating) {
    currentRating.value = item.rating.rating
    currentTags.value = item.rating.tags ? item.rating.tags.split(',') : []
    currentKomentar.value = item.rating.komentar || ''
  } else {
    currentRating.value = 5
    currentTags.value = []
    currentKomentar.value = ''
  }
  showRatingModal.value = true
}

function toggleTag(tag: string) {
  const idx = currentTags.value.indexOf(tag)
  if (idx > -1) {
    currentTags.value.splice(idx, 1)
  } else {
    currentTags.value.push(tag)
  }
}

async function submitRating() {
  if (!selectedItem.value) return
  submittingRating.value = true
  try {
    await $fetch('/api/siswa/rating', {
      method: 'POST',
      body: {
        sesiId: selectedItem.value.sesiId,
        rating: currentRating.value,
        tags: currentTags.value.join(','),
        komentar: currentKomentar.value
      }
    })
    showRatingModal.value = false
    await refresh()
  } catch (err: any) {
    alert(err?.data?.statusMessage || 'Gagal menyimpan ulasan')
  } finally {
    submittingRating.value = false
  }
}
</script>

<template>
  <StudentLayout>
    <PageHeader title="Ulasan Saya" description="Rating yang sudah kamu berikan ke pengajar" :show-back="false" />

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="4" />

    <div v-else-if="error" class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-8 text-center shadow-card dark:shadow-dark-card">
      <p class="text-gray-500 dark:text-gray-400 font-medium">Gagal memuat data ulasan</p>
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 text-center">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Total Sesi Dirate</p>
          <p class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
            {{ data?.stats.totalDirate || 0 }}
            <span class="text-sm font-normal text-gray-400">/ {{ data?.stats.totalHadir || 0 }}</span>
          </p>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 text-center">
          <div class="flex items-center justify-center gap-1.5 mb-1">
            <svg class="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Rata-rata Dikasih</p>
          </div>
          <p class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 mt-1">
            {{ data?.stats.rataRata !== null ? data!.stats.rataRata!.toFixed(1) : '–' }}
            <span class="text-sm font-normal text-gray-400">/ 5.0</span>
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
            placeholder="Cari mata pelajaran, kelas, atau guru..."
            class="w-full h-9 pl-9 pr-3 border border-gray-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </div>
        <div class="grid grid-cols-3 gap-2">
          <BaseSelect v-model="filterMapel" :options="mapelOptions" placeholder="Semua Mapel" wider />
          <BaseSelect v-model="filterBulan" :options="bulanOptions" placeholder="Semua Bulan" />
          <BaseSelect v-model="filterTahun" :options="tahunOptions" placeholder="Semua Tahun" />
        </div>
      </div>

      <!-- Sessions List -->
      <div class="space-y-3">
        <div v-if="!visible.length" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-8 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ searchQuery ? 'Tidak ada hasil yang cocok' : 'Belum ada sesi yang dihadiri' }}</p>
        </div>

        <div
          v-for="s in visible"
          :key="s.sesiId"
          class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ s.mapel }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ s.kelas }} · {{ s.guru }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ formatDate(s.tanggal) }}</p>

              <!-- Existing rating -->
              <div v-if="s.rating" class="mt-2.5 space-y-1.5">
                <div class="flex items-center gap-1">
                  <template v-for="star in 5" :key="star">
                    <svg class="w-3.5 h-3.5" :class="star <= s.rating.rating ? 'text-amber-400' : 'text-gray-200 dark:text-slate-700'" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </template>
                </div>
                <p v-if="s.rating.tags" class="text-[11px] text-primary-600 dark:text-primary-400">{{ s.rating.tags }}</p>
                <p v-if="s.rating.komentar" class="text-xs text-gray-600 dark:text-gray-300 italic">"{{ s.rating.komentar }}"</p>
              </div>
            </div>

            <button
              @click="openRatingModal(s)"
              class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors"
              :class="s.rating
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60'"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.690h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.690l1.07-3.292z" />
              </svg>
              {{ s.rating ? 'Ubah' : 'Beri Ulasan' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="filteredSessions.length > pageSize" class="mt-4 px-4 sm:px-6 py-3 flex items-center justify-center gap-2">
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
    </template>

    <!-- Rating Modal -->
    <BaseModal :show="showRatingModal" :title="`Beri Ulasan - ${selectedItem?.mapel || ''}`" max-w="max-w-md" @close="!submittingRating && (showRatingModal = false)">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Rating Kelas</label>
          <div class="flex items-center gap-2">
            <button
              v-for="star in 5"
              :key="star"
              type="button"
              @click="currentRating = star"
              class="p-1 focus:outline-none transition-transform hover:scale-110"
            >
              <svg
                class="w-8 h-8 transition-colors"
                :class="star <= currentRating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200 dark:fill-slate-700 dark:text-slate-700'"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.690h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.690l1.07-3.292z" />
              </svg>
            </button>
            <span class="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{{ currentRating }} dari 5</span>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Pilih Kesan / Tags</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="tag in availableTags"
              :key="tag"
              type="button"
              @click="toggleTag(tag)"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
              :class="currentTags.includes(tag) ? 'bg-primary-50 dark:bg-primary-950/50 border-primary-500 text-primary-600 dark:text-primary-400' : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'"
            >
              {{ tag }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Catatan / Komentar Tambahan (Opsional)</label>
          <textarea
            v-model="currentKomentar"
            rows="3"
            placeholder="Tuliskan masukan atau pesan untuk pengajar..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <button
          type="button"
          :disabled="submittingRating"
          @click="showRatingModal = false"
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="button"
          :disabled="submittingRating"
          @click="submitRating"
          class="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 active:bg-primary-700 rounded-xl transition-colors shadow-md shadow-primary-500/30 disabled:opacity-50"
        >
          <svg v-if="submittingRating" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ submittingRating ? 'Menyimpan...' : 'Kirim Ulasan' }}
        </button>
      </template>
    </BaseModal>
  </StudentLayout>
</template>
