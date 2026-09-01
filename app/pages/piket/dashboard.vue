<script setup lang="ts">
const { user } = useUserSession()

// --- Date State ---
const selectedDate = ref(localDateStr(new Date()))

function isToday() {
  return selectedDate.value === localDateStr(new Date())
}
function goToToday() {
  selectedDate.value = localDateStr(new Date())
}

// --- Filter & Search State ---
const searchQuery = ref('')
const statusFilter = ref<'all' | 'pending' | 'approved'>('all')

// --- Fetch Data ---
const { data: dashboardData, pending, refresh } = useFetch('/api/piket/pending-sessions', {
  query: computed(() => ({
    tanggal: selectedDate.value,
    mapel: searchQuery.value || undefined
  })),
  watch: [selectedDate, searchQuery]
})

// --- Stats ---
const menungguCount = computed(() => {
  if (!dashboardData.value) return 0
  return dashboardData.value.dikonfirmasiBerhalangan.filter((s: any) => !s.approvedByRole).length
})
const approvedCount = computed(() => {
  if (!dashboardData.value) return 0
  return dashboardData.value.dikonfirmasiBerhalangan.filter((s: any) => s.approvedByRole).length
})

// --- Filtered & Grouped Sessions ---
const filteredSesi = computed(() => {
  if (!dashboardData.value) return []
  let list = dashboardData.value.dikonfirmasiBerhalangan.map((s: any) => ({ ...s, _type: 'berhalangan' }))
  if (statusFilter.value === 'pending') list = list.filter((s: any) => !s.approvedByRole)
  if (statusFilter.value === 'approved') list = list.filter((s: any) => s.approvedByRole)
  return list.sort((a: any, b: any) => {
    if (a.approvedByRole && !b.approvedByRole) return 1
    if (!a.approvedByRole && b.approvedByRole) return -1
    return (a.jadwal?.jamMulai || '').localeCompare(b.jadwal?.jamMulai || '')
  })
})

interface TimeGroup { label: string; items: any[] }
const groupedSessions = computed<TimeGroup[]>(() => {
  const groups: Record<string, any[]> = { Pagi: [], Siang: [], Sore: [] }
  for (const s of filteredSesi.value) {
    const hour = parseInt((s.jadwal?.jamMulai || '00:00').split(':')[0], 10)
    if (hour < 12) groups.Pagi.push(s)
    else if (hour < 18) groups.Siang.push(s)
    else groups.Sore.push(s)
  }
  return [
    { label: 'Pagi', items: groups.Pagi },
    { label: 'Siang', items: groups.Siang },
    { label: 'Sore', items: groups.Sore },
  ].filter(g => g.items.length > 0)
})

// --- Avatar ---
const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500'
]
function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// --- Swipe to Approve ---
const swipingId = ref<number | null>(null)
const swipeOffset = ref(0)
let touchStartX = 0
let touchStartY = 0
let isHorizontalSwipe = false
const SWIPE_THRESHOLD = 0.4

function onTouchStart(e: TouchEvent, sesi: any) {
  if (sesi.approvedByRole) return
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  isHorizontalSwipe = false
  swipingId.value = sesi.id
  swipeOffset.value = 0
}
function onTouchMove(e: TouchEvent, el: HTMLElement) {
  if (swipingId.value === null) return
  const dx = e.touches[0].clientX - touchStartX
  const dy = e.touches[0].clientY - touchStartY
  if (!isHorizontalSwipe && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
    swipingId.value = null
    swipeOffset.value = 0
    return
  }
  isHorizontalSwipe = true
  if (dx > 0) {
    swipeOffset.value = Math.min(dx, el.offsetWidth * 0.6)
  }
}
function onTouchEnd(e: TouchEvent, sesi: any) {
  if (swipingId.value === null) return
  const el = e.currentTarget as HTMLElement
  const width = el?.offsetWidth || 300
  if (swipeOffset.value > width * SWIPE_THRESHOLD) {
    swipeOffset.value = width * 0.6
    setTimeout(() => {
      openApproveModal(sesi)
      swipeOffset.value = 0
      swipingId.value = null
    }, 200)
  } else {
    swipeOffset.value = 0
    swipingId.value = null
  }
}

// --- Pull to Refresh ---
const pullStartY = ref(0)
const pullDistance = ref(0)
const isPulling = ref(false)
const isRefreshing = ref(false)
const PULL_THRESHOLD = 80

function onContentTouchStart(e: TouchEvent) {
  const mainEl = document.querySelector('.piket-scroll-main')
  if (mainEl && mainEl.scrollTop <= 0) {
    pullStartY.value = e.touches[0].clientY
    isPulling.value = true
  }
}
function onContentTouchMove(e: TouchEvent) {
  if (!isPulling.value) return
  const dy = e.touches[0].clientY - pullStartY.value
  if (dy > 0) {
    pullDistance.value = Math.min(dy * 0.5, 120)
  }
}
function onContentTouchEnd() {
  if (!isPulling.value) return
  if (pullDistance.value >= PULL_THRESHOLD && !isRefreshing.value) {
    isRefreshing.value = true
    pullDistance.value = 60
    refresh().finally(() => {
      setTimeout(() => {
        isRefreshing.value = false
        pullDistance.value = 0
        isPulling.value = false
      }, 500)
    })
  } else {
    pullDistance.value = 0
    isPulling.value = false
  }
}

// --- Keterangan Expand ---
const expandedKet = ref<Set<number>>(new Set())
function toggleKet(id: number) {
  if (expandedKet.value.has(id)) expandedKet.value.delete(id)
  else expandedKet.value.add(id)
}

// --- Approve Modal ---
const approvingSesi = ref<any | null>(null)
const petugasNama = ref('')
const loadingApprove = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const studentEntries = ref<Record<number, { status: string; keterangan: string }>>({})

function openApproveModal(sesi: any) {
  approvingSesi.value = sesi
  petugasNama.value = user.value?.nama || ''
  errorMessage.value = ''
  const entries: Record<number, { status: string; keterangan: string }> = {}
  if (sesi.jadwal?.kelas?.siswa) {
    for (const s of sesi.jadwal.kelas.siswa) {
      const existingReq = sesi.requests?.find((r: any) => r.siswaId === s.id)
      entries[s.id] = {
        status: existingReq ? (existingReq.status === 'PENDING' ? 'HADIR' : existingReq.status) : 'ALPHA',
        keterangan: existingReq?.keterangan || ''
      }
    }
  }
  studentEntries.value = entries
}

async function submitApprove() {
  if (!petugasNama.value.trim()) { errorMessage.value = 'Nama Petugas Piket wajib diisi'; return }
  if (!approvingSesi.value) return
  loadingApprove.value = true
  errorMessage.value = ''
  try {
    const entries = Object.entries(studentEntries.value).map(([siswaId, val]) => ({
      siswaId: parseInt(siswaId), status: val.status as any, keterangan: val.keterangan || null
    }))
    const res: any = await $fetch('/api/piket/approve', {
      method: 'POST',
      body: { sesiId: approvingSesi.value.id, petugasPiketNama: petugasNama.value.trim(), entries }
    })
    if (res.success) {
      successMessage.value = 'Sesi berhasil disetujui'
      approvingSesi.value = null
      refresh()
      setTimeout(() => { successMessage.value = '' }, 3000)
    }
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Gagal menyetujui sesi'
  } finally {
    loadingApprove.value = false
  }
}
</script>

<template>
  <PiketLayout>
    <!-- Pull to Refresh Indicator -->
    <div
      class="overflow-hidden transition-all duration-300 ease-out"
      :style="{ height: (pullDistance > 0 || isRefreshing ? pullDistance || 60 : 0) + 'px' }"
    >
      <div class="flex items-center justify-center h-full">
        <svg
          v-if="isRefreshing"
          class="w-5 h-5 text-primary-500 animate-spin"
          fill="none" viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg
          v-else
          class="w-5 h-5 transition-transform"
          :class="pullDistance >= PULL_THRESHOLD ? 'text-primary-500 rotate-180' : 'text-gray-400'"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </div>

    <!-- Success Toast -->
    <Transition name="fade">
      <div v-if="successMessage" class="mb-3 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 shadow-sm">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
        {{ successMessage }}
      </div>
    </Transition>

    <!-- Page Title -->
    <div class="mb-4">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">Dashboard Piket</h1>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pantau dan approve sesi absensi</p>
    </div>

    <!-- === STAT GRID === -->
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200/80 dark:border-slate-700/80 border-l-[3px] border-l-gray-200 dark:border-l-gray-600 px-4 py-3.5">
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Menunggu</span>
        <div class="mt-1.5 flex items-baseline gap-1.5">
          <span class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{{ menungguCount }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">sesi</span>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200/80 dark:border-slate-700/80 border-l-[3px] border-l-gray-200 dark:border-l-gray-600 px-4 py-3.5">
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Disetujui</span>
        <div class="mt-1.5 flex items-baseline gap-1.5">
          <span class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{{ approvedCount }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">sesi</span>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200/80 dark:border-slate-700/80 border-l-[3px] border-l-gray-200 dark:border-l-gray-600 px-4 py-3.5">
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Total</span>
        <div class="mt-1.5 flex items-baseline gap-1.5">
          <span class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{{ dashboardData?.total || 0 }}</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">sesi</span>
        </div>
      </div>
    </div>

    <!-- === CALENDAR DATE SELECTOR === -->
    <div class="flex items-center gap-2 mb-3">
      <BaseCalendar v-model="selectedDate" />
      <button
        v-if="!isToday()"
        type="button"
        @click="goToToday"
        class="px-2.5 py-2 text-[11px] font-semibold rounded-xl bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border border-gray-200/80 dark:border-slate-700/80 hover:border-gray-300 dark:hover:border-slate-600 transition-all flex-shrink-0 cursor-pointer select-none"
      >
        Hari Ini
      </button>
    </div>

    <!-- === SEARCH + FILTER === -->
    <div class="mb-4 space-y-2.5">
      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari mapel atau PTK..."
          class="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-gray-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all shadow-sm"
        />
      </div>
      <!-- Filter Chips -->
      <div class="flex items-center gap-2">
        <button
          @click="statusFilter = 'all'"
          :class="[
            'px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all',
            statusFilter === 'all'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200/80 dark:border-slate-700/80 hover:border-gray-300 dark:hover:border-slate-600'
          ]"
        >Semua</button>
        <button
          @click="statusFilter = 'pending'"
          :class="[
            'px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all',
            statusFilter === 'pending'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200/80 dark:border-slate-700/80 hover:border-gray-300 dark:hover:border-slate-600'
          ]"
        >Menunggu</button>
        <button
          @click="statusFilter = 'approved'"
          :class="[
            'px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all',
            statusFilter === 'approved'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200/80 dark:border-slate-700/80 hover:border-gray-300 dark:hover:border-slate-600'
          ]"
        >Selesai</button>
      </div>
    </div>

    <!-- === SKELETON LOADING === -->
    <div v-if="pending" class="space-y-6">
      <!-- Stat skeleton -->
      <div class="grid grid-cols-3 gap-3">
        <div v-for="i in 3" :key="i" class="bg-white dark:bg-slate-800 rounded-lg border border-gray-200/80 dark:border-slate-700/80 border-l-[3px] border-l-gray-200 dark:border-l-gray-600 px-4 py-3.5 animate-pulse">
          <div class="h-2.5 bg-gray-200 dark:bg-slate-700 rounded w-14 mb-3" />
          <div class="flex items-baseline gap-1.5">
            <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-8" />
            <div class="h-2.5 bg-gray-200 dark:bg-slate-700 rounded w-7" />
          </div>
        </div>
      </div>
      <!-- Card skeletons -->
      <div v-for="i in 3" :key="i" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200/80 dark:border-slate-700/80 px-4 py-3.5 animate-pulse">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-lg bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="flex justify-between">
              <div class="h-2.5 bg-gray-200 dark:bg-slate-700 rounded w-20" />
              <div class="h-5 bg-gray-200 dark:bg-slate-700 rounded-full w-16" />
            </div>
            <div class="h-3.5 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
            <div class="h-2.5 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
          </div>
        </div>
      </div>
    </div>

    <!-- === CONTENT === -->
    <template v-else-if="dashboardData">
      <!-- Empty State -->
      <div v-if="filteredSesi.length === 0" class="text-center py-16">
        <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
          <svg class="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <p class="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">Tidak ada sesi untuk tanggal ini</p>
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {{ statusFilter !== 'all' ? 'Tidak ada sesi dengan filter ini' : 'Semua PTK sudah hadir atau belum ada jadwal berhalangan' }}
        </p>
      </div>

      <!-- Grouped Session List -->
      <div v-else class="space-y-6">
        <div v-for="group in groupedSessions" :key="group.label">
          <!-- Time Group Label -->
          <div class="flex items-center gap-3 mb-3">
            <div class="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
            <span class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider whitespace-nowrap">{{ group.label }}</span>
            <div class="flex-1 h-px bg-gray-200 dark:bg-slate-700" />
          </div>

          <!-- Cards in Group -->
          <div class="space-y-3">
            <div
              v-for="sesi in group.items"
              :key="sesi.id"
              class="relative overflow-hidden rounded-xl shadow-sm"
              :class="[
                sesi.approvedByRole
                  ? 'border border-emerald-200/80 dark:border-emerald-900/50 bg-white dark:bg-slate-800'
                  : 'border border-amber-200/80 dark:border-amber-900/50 bg-white dark:bg-slate-800'
              ]"
              :style="{ borderLeft: sesi.approvedByRole ? '3px solid rgb(16, 185, 129)' : '3px solid rgb(245, 158, 11)' }"
              @touchstart="onTouchStart($event, sesi)"
              @touchmove="onTouchMove($event, $el)"
              @touchend="onTouchEnd($event, sesi)"
            >
              <!-- Swipe Background -->
              <div
                v-if="!sesi.approvedByRole"
                class="absolute inset-0 flex items-center justify-end pr-5 bg-emerald-500 rounded-xl"
              >
                <div class="flex items-center gap-1.5 text-white">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <span class="text-xs font-semibold">Approve</span>
                </div>
              </div>

              <!-- Card Content -->
              <div
                class="relative bg-white dark:bg-slate-800 px-4 py-3.5 transition-transform"
                :style="{
                  transform: swipingId === sesi.id ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                  transition: swipingId === sesi.id ? 'none' : 'transform 0.2s ease-out'
                }"
              >
                <div class="flex items-start gap-3">

                  <div class="flex-1 min-w-0">
                    <!-- Top row: Time + Badge -->
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <p class="text-xs font-bold text-gray-900 dark:text-gray-100 tabular-nums">{{ sesi.jadwal?.jamMulai }} - {{ sesi.jadwal?.jamSelesai }}</p>
                      <span
                        v-if="sesi.approvedByRole"
                        class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                        Disetujui
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {{ sesi.guruBerhalangan?.alasan || 'Berhalangan' }}
                      </span>
                    </div>

                    <!-- Mapel + Kelas -->
                    <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">{{ sesi.jadwal?.mapel }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ sesi.jadwal?.guru?.nama }} · {{ sesi.jadwal?.kelas?.nama }}</p>

                    <!-- Keterangan (truncate) -->
                    <div v-if="sesi.guruBerhalangan?.keterangan" class="mt-1.5">
                      <p
                        class="text-[11px] text-amber-600/80 dark:text-amber-400/70 leading-relaxed"
                        :class="expandedKet.has(sesi.id) ? '' : 'line-clamp-1'"
                      >
                        {{ sesi.guruBerhalangan.keterangan }}
                      </p>
                      <button
                        v-if="sesi.guruBerhalangan.keterangan.length > 60"
                        @click="toggleKet(sesi.id)"
                        class="text-[10px] text-primary-500 dark:text-primary-400 font-medium hover:underline mt-0.5"
                      >
                        {{ expandedKet.has(sesi.id) ? 'Sembunyikan' : 'Lihat selengkapnya' }}
                      </button>
                    </div>

                    <!-- Bottom: Ruangan + Action -->
                    <div class="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700/80 flex items-center justify-between">
                      <span class="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                        <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {{ sesi.jadwal?.ruangan?.nama }}
                      </span>
                      <button
                        v-if="!sesi.approvedByRole"
                        @click="openApproveModal(sesi)"
                        class="px-3.5 py-1.5 text-[11px] font-semibold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-lg transition-colors shadow-sm shadow-primary-600/20"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- === APPROVE MODAL === -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="approvingSesi" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" @click.self="approvingSesi = null">
          <div class="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col">
            <!-- Header -->
            <div class="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">Approve Sesi</h3>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{{ approvingSesi.jadwal?.mapel }} - {{ approvingSesi.jadwal?.kelas?.nama }}</p>
              </div>
              <button @click="approvingSesi = null" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <!-- Body -->
            <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div v-if="errorMessage" class="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
                {{ errorMessage }}
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Petugas Piket</label>
                <input
                  v-model="petugasNama"
                  type="text"
                  class="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                />
              </div>
              <div>
                <div class="flex items-center justify-between mb-2">
                  <p class="text-xs font-medium text-gray-600 dark:text-gray-400">Daftar Siswa</p>
                  <p class="text-[10px] text-gray-400 dark:text-gray-500">{{ Object.keys(studentEntries).length }} siswa</p>
                </div>
                <div class="border border-gray-200 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-700 max-h-52 overflow-y-auto">
                  <div
                    v-for="s in approvingSesi.jadwal?.kelas?.siswa"
                    :key="s.id"
                    class="flex items-center justify-between gap-2 px-3.5 py-2.5"
                  >
                    <p class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate min-w-0 flex-1">{{ s.nama }}</p>
                    <select
                      v-model="studentEntries[s.id].status"
                      class="px-2 py-1 text-[11px] rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 focus:outline-none flex-shrink-0"
                    >
                      <option value="HADIR">Hadir</option>
                      <option value="SAKIT">Sakit</option>
                      <option value="IZIN">Izin</option>
                      <option value="ALPHA">Alpha</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-2.5 flex-shrink-0">
              <button @click="approvingSesi = null" class="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Batal</button>
              <button
                @click="submitApprove"
                :disabled="loadingApprove"
                class="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-50 shadow-sm shadow-primary-600/20"
              >
                {{ loadingApprove ? 'Menyimpan...' : 'Konfirmasi' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </PiketLayout>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-enter-active {
  transition: all 0.25s ease-out;
}
.modal-leave-active {
  transition: all 0.15s ease-in;
}
.modal-enter-from {
  opacity: 0;
}
.modal-enter-from > div {
  transform: translateY(20px) scale(0.97);
}
.modal-leave-to {
  opacity: 0;
}
.modal-leave-to > div {
  transform: translateY(20px) scale(0.97);
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
