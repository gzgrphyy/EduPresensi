<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const { user } = useUserSession()
const isPiketOrAdmin = computed(() => {
  return user.value && (user.value.role === 'ADMIN' || user.value.email?.toLowerCase().includes('piket') || user.value.nama?.toLowerCase().includes('piket'))
})

watchEffect(() => {
  if (user.value && !isPiketOrAdmin.value) {
    navigateTo('/absensi')
  }
})
const selectedDate = ref(new Date().toISOString().split('T')[0])
const selectedKelas = ref('')
const searchMapel = ref('')

const { data: dashboardData, pending, refresh } = useFetch('/api/piket/pending-sessions', {
  query: computed(() => ({
    tanggal: selectedDate.value,
    kelasId: selectedKelas.value || undefined,
    mapel: searchMapel.value || undefined
  })),
  watch: [selectedDate, selectedKelas, searchMapel]
})

const approvingSesi = ref<any | null>(null)
const petugasNama = ref('')
const loadingApprove = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Modal state for student attendance details inside approval
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
        status: existingReq ? existingReq.status : 'HADIR',
        keterangan: existingReq?.keterangan || ''
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
      successMessage.value = 'Sesi berhasil disetujui!'
      approvingSesi.value = null
      refresh()
      setTimeout(() => { successMessage.value = '' }, 3000)
    }
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || 'Terjadi kesalahan saat menyetujui sesi'
  } finally {
    loadingApprove.value = false
  }
}
</script>

template
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12">
    <!-- Header -->
    <header class="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/absensi" class="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div>
            <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">Dashboard Guru Piket</h1>
            <p class="text-xs text-gray-500 dark:text-gray-400">Approval Kehadiran & Pemantauan Sesi Sekolah</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-700">
            Piket Aktif: {{ user?.nama }}
          </span>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <!-- Success Toast -->
      <div v-if="successMessage" class="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm font-medium flex items-center gap-2">
        <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        {{ successMessage }}
      </div>

      <!-- Filters Bar -->
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 shadow-card mb-6 flex flex-wrap items-center gap-4">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tanggal Sesi</label>
          <input
            v-model="selectedDate"
            type="date"
            class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cari Mapel / Guru</label>
          <input
            v-model="searchMapel"
            type="text"
            placeholder="Contoh: Matematika..."
            class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="space-y-4">
        <div v-for="i in 3" :key="i" class="h-28 bg-white dark:bg-slate-800 rounded-2xl p-5 animate-pulse border border-gray-200 dark:border-slate-700"></div>
      </div>

      <template v-else-if="dashboardData">
        <!-- Section 1: Dikonfirmasi Berhalangan (Skenario A) -->
        <div class="mb-8">
          <div class="flex items-center gap-2 mb-4">
            <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
            <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">
              Dikonfirmasi Berhalangan ({{ dashboardData.dikonfirmasiBerhalangan.length }})
            </h2>
          </div>

          <div v-if="dashboardData.dikonfirmasiBerhalangan.length === 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            Tidak ada guru yang berhalangan pada tanggal ini.
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="sesi in dashboardData.dikonfirmasiBerhalangan"
              :key="sesi.id"
              class="bg-white dark:bg-slate-800 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-card p-5 relative overflow-hidden flex flex-col justify-between"
            >
              <div class="absolute top-0 right-0 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-[11px] font-bold rounded-bl-xl">
                Guru Berhalangan: {{ sesi.guruBerhalangan?.alasan || 'SAKIT' }}
              </div>

              <div>
                <div class="flex items-start gap-3 mb-2">
                  <div class="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.mapel }}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      Guru: <span class="font-semibold text-gray-800 dark:text-gray-200">{{ sesi.jadwal.guru.nama }}</span>
                    </p>
                  </div>
                </div>

                <div class="my-3 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                  <p>Kelas: <b class="text-gray-900 dark:text-gray-100">{{ sesi.jadwal.kelas.nama }}</b> · Ruangan: {{ sesi.jadwal.ruangan.nama }}</p>
                  <p>Jam: {{ sesi.jadwal.jamMulai }} – {{ sesi.jadwal.jamSelesai }}</p>
                  <p v-if="sesi.guruBerhalangan?.keterangan" class="text-amber-600 dark:text-amber-400 italic mt-1">
                    Ket: "{{ sesi.guruBerhalangan.keterangan }}"
                  </p>
                </div>
              </div>

              <div class="pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {{ sesi.approvedByRole ? `Sudah Approve (${sesi.approvedByRole})` : 'Menunggu Approval Piket' }}
                </span>
                <button
                  v-if="!sesi.approvedByRole"
                  @click="openApproveModal(sesi)"
                  class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors"
                >
                  Approve Sesi
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Menunggu Laporan (Skenario B) -->
        <div>
          <div class="flex items-center gap-2 mb-4">
            <span class="w-3 h-3 rounded-full bg-slate-400"></span>
            <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">
              Menunggu Laporan / Sesi Pending Biasa ({{ dashboardData.menungguLaporan.length }})
            </h2>
          </div>

          <div v-if="dashboardData.menungguLaporan.length === 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            Tidak ada sesi pending tanpa penanda pada tanggal ini.
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="sesi in dashboardData.menungguLaporan"
              :key="sesi.id"
              class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-card p-5 flex flex-col justify-between"
            >
              <div>
                <div class="flex items-start gap-3 mb-2">
                  <div class="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.mapel }}</h3>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      Guru: <span class="font-semibold text-gray-800 dark:text-gray-200">{{ sesi.jadwal.guru.nama }}</span>
                    </p>
                  </div>
                </div>

                <div class="my-3 text-xs space-y-1 text-gray-600 dark:text-gray-300">
                  <p>Kelas: <b class="text-gray-900 dark:text-gray-100">{{ sesi.jadwal.kelas.nama }}</b> · Ruangan: {{ sesi.jadwal.ruangan.nama }}</p>
                  <p>Jam: {{ sesi.jadwal.jamMulai }} – {{ sesi.jadwal.jamSelesai }}</p>
                </div>
              </div>

              <div class="pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between">
                <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {{ sesi.approvedByRole ? `Sudah Approve (${sesi.approvedByRole})` : 'Belum di-approve guru' }}
                </span>
                <button
                  v-if="!sesi.approvedByRole"
                  @click="openApproveModal(sesi)"
                  class="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-colors"
                >
                  Approve Manual (Lisan)
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- Approve Modal -->
    <div v-if="approvingSesi" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] flex flex-col">
        <header class="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-700 mb-4">
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Approval Sesi Oleh Guru Piket</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {{ approvingSesi.jadwal.mapel }} — Kelas {{ approvingSesi.jadwal.kelas.nama }}
            </p>
          </div>
          <button @click="approvingSesi = null" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto space-y-4 pr-1">
          <!-- Error message -->
          <div v-if="errorMessage" class="p-3 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium">
            {{ errorMessage }}
          </div>

          <!-- Petugas Piket Nama -->
          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Nama Petugas Piket <span class="text-red-500">*</span>
            </label>
            <input
              v-model="petugasNama"
              type="text"
              placeholder="Masukkan nama Anda yang sedang bertugas piket..."
              class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <!-- Daftar Murid -->
          <div>
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Daftar Kehadiran Siswa</h4>
            <div class="space-y-2 border border-gray-100 dark:border-slate-700 rounded-xl p-3 bg-gray-50/50 dark:bg-slate-900/50 max-h-60 overflow-y-auto">
              <div
                v-for="s in approvingSesi.jadwal.kelas.siswa"
                :key="s.id"
                class="flex items-center justify-between gap-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700 text-xs"
              >
                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">{{ s.nama }}</p>
                  <p class="text-[11px] text-gray-400">{{ s.nisn }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <select
                    v-model="studentEntries[s.id].status"
                    class="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100"
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
        </div>

        <footer class="pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-end gap-3 mt-4">
          <button
            @click="approvingSesi = null"
            class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            @click="submitApprove"
            :disabled="loadingApprove"
            class="px-5 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-md transition-colors disabled:opacity-50"
          >
            {{ loadingApprove ? 'Menyimpan...' : 'Konfirmasi Approve' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>
