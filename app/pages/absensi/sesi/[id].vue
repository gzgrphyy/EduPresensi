<script setup lang="ts">

interface SiswaItem {
  id: number
  nisn: string
  nama: string
  request: {
    id: number
    status: string
    scannedAt: string
    keterangan: string | null
    approver?: { id: number; nama: string; role: string } | null
  } | null
}

interface SesiDetail {
  id: number
  status: string
  tanggal: string
  ditutupPada: string | null
  updatedAt: string
  approvedByRole: string | null
  petugasPiketNama: string | null
  isGuruBerhalangan: boolean
  isRevised: boolean
  revisiAt: string | null
  alasanRevisi: string | null
  allSiswa: SiswaItem[]
  jadwal: {
    mapel: string
    jamMulai: string
    jamSelesai: string
    kelas: { id: number; nama: string }
    ruangan: { id: number; nama: string }
    guru: { id: number; nama: string }
  }
  audits: {
    id: number
    action: string
    role: string
    petugasPiketNama: string | null
    detail: string | null
    createdAt: string
    user: { nama: string; role: string }
  }[]
}

const route = useRoute()
const sesiId = computed(() => parseInt(route.params.id as string))

const sesi = ref<SesiDetail | null>(null)
const entries = ref<Map<number, { checked: boolean; status: string; keterangan: string }>>(new Map())
const loading = ref(true)
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const showRevisiModal = ref(false)
const alasanRevisiInput = ref('')
const submittingRevisi = ref(false)

async function submitRevisi() {
  if (!alasanRevisiInput.value.trim() || alasanRevisiInput.value.trim().length < 3) {
    showError('Alasan revisi wajib diisi minimal 3 karakter')
    return
  }
  submittingRevisi.value = true
  errorMsg.value = ''
  try {
    const listEntries = Array.from(entries.value.entries()).map(([siswaId, val]) => ({
      siswaId,
      status: val.status as any,
      keterangan: val.keterangan || null
    }))

    const res: any = await $fetch(`/api/absensi/sesi/${sesiId.value}/revisi`, {
      method: 'POST',
      body: {
        alasanRevisi: alasanRevisiInput.value.trim(),
        entries: listEntries
      }
    })

    if (res.success) {
      showSuccess('Revisi kehadiran berhasil disimpan!')
      showRevisiModal.value = false
      alasanRevisiInput.value = ''
      await fetchSesi()
    }
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal menyimpan revisi')
  } finally {
    submittingRevisi.value = false
  }
}

function showError(msg: string) {
  errorMsg.value = msg
  setTimeout(() => { errorMsg.value = '' }, 5000)
}

function showSuccess(msg: string) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}

async function fetchSesi() {
  try {
    const data = await $fetch<SesiDetail>(`/api/absensi/sesi/${sesiId.value}`)
    sesi.value = data

    const map = new Map()
    for (const s of data.allSiswa) {
      const isPending = s.request?.status === 'PENDING'
      const isFinalNonHadir = s.request?.status === 'SAKIT' || s.request?.status === 'IZIN' || s.request?.status === 'ALPHA'
      const isWaliKelasSet = !!s.request?.approver && s.request.approver.id !== data.jadwal.guru.id
      map.set(s.id, {
        checked: isPending || s.request?.status === 'HADIR' || (isFinalNonHadir && isWaliKelasSet),
        status: s.request?.status === 'HADIR' ? 'HADIR'
          : isPending ? 'HADIR'
          : s.request?.status || 'BELUM',
        keterangan: s.request?.keterangan || '',
        isWaliKelasSet
      })
    }
    entries.value = map
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal memuat data sesi')
  } finally {
    loading.value = false
  }
}

function toggleSiswa(siswaId: number) {
  const e = entries.value.get(siswaId)
  if (e) {
    e.checked = !e.checked
    if (e.checked) {
      if (e.status === 'ALPHA' || e.status === 'BELUM') {
        e.status = 'HADIR'
      }
    } else if (e.status === 'HADIR') {
      e.status = 'ALPHA'
    }
  }
}

function onStatusChange(siswaId: number) {
  const e = entries.value.get(siswaId)
  if (e) e.checked = e.status !== 'ALPHA' && e.status !== 'BELUM'
}

const statusCount = computed(() => {
  const counts: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPHA: 0, PENDING: 0, BELUM: 0 }
  for (const e of entries.value.values()) {
    counts[e.status] = (counts[e.status] || 0) + 1
  }
  return counts
})

async function submitKonfirmasi() {
  if (!sesi.value) return
  submitting.value = true
  errorMsg.value = ''

  const payload = {
    entries: Array.from(entries.value.entries())
      .filter(([_, e]) => e.status !== 'PENDING' && e.status !== 'BELUM')
      .map(([siswaId, e]) => ({
        siswaId,
        status: e.status as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA',
        keterangan: e.keterangan || null
      }))
  }

  try {
    await $fetch(`/api/absensi/sesi/${sesiId.value}/konfirmasi`, {
      method: 'POST',
      body: payload
    })
    showSuccess('Kehadiran berhasil dikonfirmasi')
    await fetchSesi()
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal mengonfirmasi kehadiran')
  } finally {
    submitting.value = false
  }
}

onMounted(fetchSesi)

onMounted(() => {
  const interval = setInterval(fetchSesi, 10000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <PTKLayout>
    <PageHeader title="Konfirmasi Kehadiran" description="Periksa & konfirmasi kehadiran murid" back-to="/absensi" />

    <!-- Session Info Bar -->
    <div
      v-if="sesi"
      class="rounded-2xl border p-5 shadow-card dark:shadow-dark-card mb-4"
      :class="sesi.status === 'AKTIF'
        ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-900/20 border-green-200 dark:border-green-800'
        : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700'"
    >
      <div class="flex items-center gap-3 mb-3">
        <div class="p-2.5 rounded-full flex-shrink-0"
          :class="sesi.status === 'AKTIF'
            ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
            : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Sesi absensi</p>
          <p class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{{ sesi.jadwal.mapel }}</p>
        </div>
        <span v-if="sesi.status === 'AKTIF'" class="inline-flex items-center gap-1.5 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
          <span class="text-xs font-medium text-gray-600 dark:text-gray-400">AKTIF</span>
        </span>
        <span v-else class="inline-flex items-center gap-1.5 flex-shrink-0">
          <span class="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
          <span class="text-xs text-gray-600 dark:text-gray-400">SELESAI</span>
        </span>
      </div>

      <dl class="space-y-1.5 text-sm">
        <div class="flex items-center justify-between gap-3">
          <dt class="text-gray-500 dark:text-gray-400">Kelas</dt>
          <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.kelas.nama }}</dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-gray-500 dark:text-gray-400">Ruangan</dt>
          <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.ruangan.nama }}</dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-gray-500 dark:text-gray-400">Waktu</dt>
          <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ sesi.jadwal.jamMulai }} - {{ sesi.jadwal.jamSelesai }}</dd>
        </div>
        <div v-if="sesi.status === 'SELESAI'" class="flex items-center justify-between gap-3">
          <dt class="text-gray-500 dark:text-gray-400">Ditutup</dt>
          <dd class="font-semibold text-gray-900 dark:text-gray-100">
            {{ new Date(sesi.ditutupPada || sesi.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3">
          <dt class="text-gray-500 dark:text-gray-400">Guru</dt>
          <dd class="font-semibold text-gray-900 dark:text-gray-100 truncate">{{ sesi.jadwal.guru.nama }}</dd>
        </div>
      </dl>

      <!-- Approval & Revision Badges -->
      <div class="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 space-y-2 text-xs">
        <div v-if="sesi.approvedByRole" class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 font-medium">
            <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Diapprove oleh: {{ sesi.approvedByRole === 'GURU_PIKET' ? `Guru Piket (${sesi.petugasPiketNama || 'Petugas'})` : sesi.approvedByRole }}
          </span>
          <button
            v-if="sesi.approvedByRole && sesi.status === 'SELESAI'"
            @click="showRevisiModal = true"
            class="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow transition-colors"
          >
            Revisi Kehadiran
          </button>
        </div>
        <div v-else class="text-amber-600 dark:text-amber-400 font-medium">
          Status: Menunggu Approval
        </div>

        <div v-if="sesi.isRevised" class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
          <p class="font-semibold">Direvisi pada {{ new Date(sesi.revisiAt!).toLocaleString('id-ID') }}</p>
          <p class="italic text-[11px] mt-0.5">Alasan: "{{ sesi.alasanRevisi }}"</p>
        </div>
      </div>
    </div>

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <!-- Status Summary -->
    <div v-if="sesi" class="flex flex-wrap gap-2 mb-4">
      <BaseBadge variant="green">{{ statusCount.HADIR || 0 }} Hadir</BaseBadge>
      <BaseBadge variant="amber">{{ statusCount.SAKIT || 0 }} Sakit</BaseBadge>
      <BaseBadge variant="blue">{{ statusCount.IZIN || 0 }} Izin</BaseBadge>
      <BaseBadge variant="gray">{{ statusCount.ALPHA || 0 }} Alpha</BaseBadge>
      <BaseBadge variant="amber">{{ statusCount.PENDING || 0 }} Menunggu</BaseBadge>
      <BaseBadge variant="gray">{{ statusCount.BELUM || 0 }} Belum Absen</BaseBadge>
    </div>

    <!-- Loading -->
    <LoadingSkeleton v-if="loading" type="table" :rows="5" :columns="5" />

    <!-- Siswa Table -->
    <div v-else-if="sesi" class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden">
      <div class="overflow-x-auto scrollbar-thin">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700">
              <th class="w-12 px-3 py-3"></th>
              <th class="text-left px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Nama</th>
              <th class="text-left px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider hidden sm:table-cell">NISN</th>
              <th class="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Status</th>
              <th class="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider hidden md:table-cell">Keterangan</th>
              <th class="text-center px-3 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider hidden md:table-cell">Scan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
            <tr v-for="s in sesi.allSiswa" :key="s.id"
              class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
              :class="{ 'bg-green-50/40 dark:bg-green-900/20': entries.get(s.id)?.checked && (!s.request || s.request.status === 'PENDING') }">
              <td class="px-3 py-3 text-center">
                <input type="checkbox"
                  :checked="entries.get(s.id)?.checked || false"
                  @change="toggleSiswa(s.id)"
                  class="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 dark:bg-slate-700 focus:ring-primary-500 cursor-pointer" />
              </td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ s.nama }}</span>
                  <span v-if="entries.get(s.id)?.isWaliKelasSet"
                    class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                    Wali kelas
                  </span>
                </div>
              </td>
              <td class="px-3 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{{ s.nisn }}</td>
              <td class="px-3 py-3 text-center">
                <select
                  v-model="entries.get(s.id)!.status"
                  @change="onStatusChange(s.id)"
                  class="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-700 dark:text-gray-100 cursor-pointer">
                  <option value="BELUM">Belum Absen</option>
                  <option value="HADIR">Hadir</option>
                  <option value="SAKIT">Sakit</option>
                  <option value="IZIN">Izin</option>
                  <option value="ALPHA">Alpha</option>
                </select>
              </td>
              <td class="px-3 py-3 text-center hidden md:table-cell">
                <input
                  v-model="entries.get(s.id)!.keterangan"
                  type="text" placeholder="-" maxlength="255"
                  class="w-full max-w-[120px] text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-500" />
              </td>
              <td class="px-3 py-3 text-center hidden md:table-cell">
                <span v-if="s.request" class="text-xs text-gray-400 dark:text-gray-500">
                  {{ new Date(s.request.scannedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
                </span>
                <span v-else class="text-xs text-gray-300 dark:text-slate-500">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Actions -->
      <div class="px-5 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 flex flex-col sm:flex-row sm:items-center gap-3">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          <strong class="text-gray-700 dark:text-gray-300">{{ entries.size }}</strong> murid —
          <strong class="text-green-600 dark:text-green-400">{{ statusCount.HADIR }}</strong> hadir
        </p>
        <button @click="submitKonfirmasi" :disabled="submitting"
          class="w-full sm:w-auto justify-center px-5 py-2.5 text-sm font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2 shadow-md shadow-primary-500/30 transition-colors">
          <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          {{ submitting ? 'Menyimpan...' : sesi.status === 'SELESAI' ? 'Simpan Koreksi' : 'Konfirmasi Kehadiran' }}
        </button>
      </div>
    </div>

    <!-- Modal Revisi Kehadiran oleh Guru Asli -->
    <div v-if="showRevisiModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <header class="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-700 mb-4">
          <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">Revisi Kehadiran Sesi</h3>
          <button @click="showRevisiModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Alasan Revisi <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="alasanRevisiInput"
              rows="3"
              placeholder="Contoh: Guru masuk terlambat, koreksi data, dll..."
              class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
            ></textarea>
            <p class="text-[11px] text-gray-400 mt-1">Perubahan status kehadiran per siswa akan mengikuti tabel utama di bawah.</p>
          </div>

          <footer class="pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              @click="showRevisiModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              @click="submitRevisi"
              :disabled="submittingRevisi"
              class="px-5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-colors disabled:opacity-50"
            >
              {{ submittingRevisi ? 'Menyimpan...' : 'Simpan Revisi' }}
            </button>
          </footer>
        </div>
      </div>
    </div>
  </PTKLayout>
</template>
