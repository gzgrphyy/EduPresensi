<script setup lang="ts">
const { user } = useUserSession()

const selectedDate = ref(new Date().toISOString().split('T')[0])
const searchMapel = ref('')

const { data: dashboardData, pending, refresh } = useFetch('/api/piket/pending-sessions', {
  query: computed(() => ({
    tanggal: selectedDate.value,
    mapel: searchMapel.value || undefined
  })),
  watch: [selectedDate, searchMapel]
})

const approvingSesi = ref<any | null>(null)
const petugasNama = ref('')
const loadingApprove = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const studentEntries = ref<Record<number, { status: string; keterangan: string }>>({})

const menungguCount = computed(() => {
  if (!dashboardData.value) return 0
  return dashboardData.value.dikonfirmasiBerhalangan.filter((s: any) => !s.approvedByRole).length
})

const approvedCount = computed(() => {
  if (!dashboardData.value) return 0
  return dashboardData.value.dikonfirmasiBerhalangan.filter((s: any) => s.approvedByRole).length
})

const allSesi = computed(() => {
  if (!dashboardData.value) return []
  const berhalangan = dashboardData.value.dikonfirmasiBerhalangan.map((s: any) => ({ ...s, _type: 'berhalangan' }))
  return [...berhalangan].sort((a: any, b: any) => {
    if (a.approvedByRole && !b.approvedByRole) return 1
    if (!a.approvedByRole && b.approvedByRole) return -1
    return (a.jadwal?.jamMulai || '').localeCompare(b.jadwal?.jamMulai || '')
  })
})

function setQuickDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  selectedDate.value = d.toISOString().split('T')[0]
}

function isToday() {
  return selectedDate.value === new Date().toISOString().split('T')[0]
}

function openApproveModal(sesi: any) {
  approvingSesi.value = sesi
  petugasNama.value = user.value?.nama || ''
  errorMessage.value = ''

  const entries: Record<number, { status: string; keterangan: string }> = {}
  if (sesi.jadwal?.kelas?.siswa) {
    for (const s of sesi.jadwal.kelas.siswa) {
      const existingReq = sesi.requests?.find((r: any) => r.siswaId === s.id)
      if (existingReq) {
        // Sudah scan: gunakan status yang ada (atau HADIR jika masih PENDING)
        entries[s.id] = {
          status: existingReq.status === 'PENDING' ? 'HADIR' : existingReq.status,
          keterangan: existingReq.keterangan || ''
        }
      } else {
        // Belum scan sama sekali: default ALPHA
        entries[s.id] = {
          status: 'ALPHA',
          keterangan: ''
        }
      }
    }
  }
  studentEntries.value = entries
}

async function submitApprove() {
  if (!petugasNama.value.trim()) {
    errorMessage.value = 'Nama Petugas Piket wajib diisi'
    return
  }
  if (!approvingSesi.value) return

  loadingApprove.value = true
  errorMessage.value = ''

  try {
    const entries = Object.entries(studentEntries.value).map(([siswaId, val]) => ({
      siswaId: parseInt(siswaId),
      status: val.status as any,
      keterangan: val.keterangan || null
    }))

    const res: any = await $fetch('/api/piket/approve', {
      method: 'POST',
      body: {
        sesiId: approvingSesi.value.id,
        petugasPiketNama: petugasNama.value.trim(),
        entries
      }
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
    <!-- Success Toast -->
    <div v-if="successMessage" class="mb-3 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
      {{ successMessage }}
    </div>

    <!-- Page Title -->
    <div class="mb-4">
      <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">Dashboard Piket</h1>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pantau dan approve sesi absensi</p>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-3 gap-2 mb-4">
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-center">
        <p class="text-lg font-bold text-amber-600 dark:text-amber-400 leading-tight">{{ menungguCount }}</p>
        <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Menunggu</p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-center">
        <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-tight">{{ approvedCount }}</p>
        <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Disetujui</p>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-center">
        <p class="text-lg font-bold text-gray-900 dark:text-gray-100 leading-tight">{{ dashboardData?.total || 0 }}</p>
        <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Total</p>
      </div>
    </div>

    <!-- Quick Date -->
    <div class="flex items-center gap-2 mb-3">
      <button @click="setQuickDate(0)" :class="['px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors', isToday() ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700']">Hari Ini</button>
      <input v-model="selectedDate" type="date" class="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500" />
    </div>

    <!-- Search -->
    <input
      v-model="searchMapel"
      type="text"
      placeholder="Cari mapel atau PTK..."
      class="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 mb-4"
    />

    <!-- Loading -->
    <div v-if="pending" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 animate-pulse" />
    </div>

    <!-- Content -->
    <template v-else-if="dashboardData">
      <!-- Empty State -->
      <div v-if="allSesi.length === 0" class="text-center py-12">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
          <svg class="w-7 h-7 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Belum ada sesi absensi</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">untuk tanggal yang dipilih</p>
      </div>

      <!-- Session List -->
      <div v-else class="space-y-2">
        <div
          v-for="sesi in allSesi"
          :key="sesi.id"
          :class="[
            'bg-white dark:bg-slate-800 rounded-xl border px-3 py-3 transition-colors',
            sesi.approvedByRole
              ? 'border-emerald-200 dark:border-emerald-900'
              : 'border-amber-200 dark:border-amber-900'
          ]"
        >
          <!-- Top: Time + Badge -->
          <div class="flex items-center justify-between mb-1.5">
            <p class="text-xs font-bold text-gray-900 dark:text-gray-100">{{ sesi.jadwal?.jamMulai }} - {{ sesi.jadwal?.jamSelesai }}</p>
            <span
              :class="[
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
                sesi.approvedByRole
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              ]"
            >
              {{ sesi.approvedByRole ? 'Selesai' : sesi.guruBerhalangan?.alasan || 'Berhalangan' }}
            </span>
          </div>

          <!-- Mapel -->
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{{ sesi.jadwal?.mapel }}</p>

          <!-- Info -->
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {{ sesi.jadwal?.guru?.nama }} · {{ sesi.jadwal?.kelas?.nama }}
          </p>
          <p v-if="sesi.guruBerhalangan?.keterangan" class="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Ket: {{ sesi.guruBerhalangan.keterangan }}
          </p>

          <!-- Action -->
          <div class="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ sesi.jadwal?.ruangan?.nama }}</span>
            <button
              v-if="!sesi.approvedByRole"
              @click="openApproveModal(sesi)"
              class="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-lg transition-colors"
            >
              Approve
            </button>
            <span v-else class="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              Disetujui
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- Approve Modal (Mobile-friendly) -->
    <Teleport to="body">
      <div v-if="approvingSesi" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" @click.self="approvingSesi = null">
        <div class="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[85vh] flex flex-col animate-slide-up">
          <!-- Modal Header -->
          <div class="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Approve Sesi</h3>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ approvingSesi.jadwal?.mapel }} - {{ approvingSesi.jadwal?.kelas?.nama }}</p>
            </div>
            <button @click="approvingSesi = null" class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <!-- Error -->
            <div v-if="errorMessage" class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium">
              {{ errorMessage }}
            </div>

            <!-- Petugas Nama -->
            <div>
              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Petugas Piket</label>
              <input
                v-model="petugasNama"
                type="text"
                class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <!-- Student List -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Daftar Siswa</p>
                <p class="text-[10px] text-gray-400 dark:text-gray-500">{{ Object.keys(studentEntries).length }} siswa</p>
              </div>
              <div class="border border-gray-200 dark:border-slate-700 rounded-lg divide-y divide-gray-100 dark:divide-slate-700 max-h-48 overflow-y-auto">
                <div
                  v-for="s in approvingSesi.jadwal?.kelas?.siswa"
                  :key="s.id"
                  class="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <p class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate min-w-0 flex-1">{{ s.nama }}</p>
                  <select
                    v-model="studentEntries[s.id].status"
                    class="px-1.5 py-1 text-[11px] rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 focus:outline-none flex-shrink-0"
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

          <!-- Modal Footer -->
          <div class="px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-2 flex-shrink-0">
            <button @click="approvingSesi = null" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Batal</button>
            <button
              @click="submitApprove"
              :disabled="loadingApprove"
              class="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {{ loadingApprove ? 'Menyimpan...' : 'Konfirmasi' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </PiketLayout>
</template>

<style scoped>
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-slide-up {
  animation: slide-up 0.25s ease-out;
}
</style>
