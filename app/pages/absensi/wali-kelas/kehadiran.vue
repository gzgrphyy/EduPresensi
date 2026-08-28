<script setup lang="ts">
import { statusLabels, statusDotColor, statusBadgeVariant } from '~/utils/absensi'

interface SiswaItem {
  id: number
  nisn: string
  nama: string
}

interface KelasItem {
  id: number
  nama: string
  semester: { nama: string; tahunAjaran: { nama: string } }
  siswa: SiswaItem[]
  _count: { siswa: number }
}

interface KelasSayaResponse {
  isWaliKelas: boolean
  kelas: KelasItem[]
}

interface MarkedEntry {
  siswaId: number
  status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPHA'
  keterangan: string
}

const today = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})()

const { data, pending } = useFetch<KelasSayaResponse>('/api/absensi/wali-kelas/kelas-saya', { immediate: true })

const selectedKelasId = ref<number | null>(null)
const tanggal = ref<string[]>([today])
// temporary holder for a date before adding to the array
const tempTanggal = ref('')
function addTanggal() {
  if (!tempTanggal.value) return
  if (!tanggal.value.includes(tempTanggal.value)) {
    tanggal.value.push(tempTanggal.value)
  }
  tempTanggal.value = ''
}
function removeTanggal(dateStr: string) {
  tanggal.value = tanggal.value.filter(d => d !== dateStr)
}
const marked = ref<MarkedEntry[]>([])
const showPicker = ref(false)
const pickerSearch = ref('')
const pickerStatus = ref<'SAKIT' | 'IZIN' | 'ALPHA' | 'HADIR'>('SAKIT')
const pickerKeterangan = ref('')
const editingId = ref<number | null>(null)
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const sesiCount = ref(0)

const selectedKelas = computed(() => data.value?.kelas.find(k => k.id === selectedKelasId.value) || null)

function showError(msg: string) { errorMsg.value = msg; setTimeout(() => { errorMsg.value = '' }, 5000) }
function showSuccess(msg: string) { successMsg.value = msg; setTimeout(() => { successMsg.value = '' }, 3500) }

const markedCount = computed(() => marked.value.length)
const markedBreakdown = computed(() => {
  const counts: Record<string, number> = { SAKIT: 0, IZIN: 0, ALPHA: 0, HADIR: 0 }
  for (const m of marked.value) counts[m.status] = (counts[m.status] || 0) + 1
  return counts
})
const notMarkedCount = computed(() => selectedKelas.value ? selectedKelas.value._count.siswa - markedCount.value : 0)

function siswaById(id: number) { return selectedKelas.value?.siswa.find(s => s.id === id) }

const availableSiswa = computed(() => {
  if (!selectedKelas.value) return []
  const taken = new Set(marked.value.map(m => m.siswaId))
  const q = pickerSearch.value.trim().toLowerCase()
  return selectedKelas.value.siswa.filter(s => {
    if (taken.has(s.id) && s.id !== editingId.value) return false
    if (!q) return true
    return s.nama.toLowerCase().includes(q) || s.nisn.toLowerCase().includes(q)
  })
})

function openPicker() {
  pickerSearch.value = ''
  pickerStatus.value = 'SAKIT'
  pickerKeterangan.value = ''
  editingId.value = null
  showPicker.value = true
}

function openEdit(entry: MarkedEntry) {
  pickerSearch.value = ''
  pickerStatus.value = entry.status
  pickerKeterangan.value = entry.keterangan
  editingId.value = entry.siswaId
  showPicker.value = true
}

function closePicker() { showPicker.value = false; editingId.value = null }

function pickSiswa(siswaId: number) {
  if (editingId.value !== null) {
    const idx = marked.value.findIndex(m => m.siswaId === editingId.value)
    if (idx !== -1) marked.value[idx] = { siswaId, status: pickerStatus.value, keterangan: pickerKeterangan.value.trim() }
  } else {
    if (!marked.value.some(m => m.siswaId === siswaId)) {
      marked.value.push({ siswaId, status: pickerStatus.value, keterangan: pickerKeterangan.value.trim() })
    }
  }
  closePicker()
}

function removeMarked(siswaId: number) { marked.value = marked.value.filter(m => m.siswaId !== siswaId) }

async function fetchSesiCount() {
  if (!selectedKelasId.value || !tanggal.value) { sesiCount.value = 0; return }
  try {
    const res: any = await $fetch('/api/absensi/wali-kelas/info-sesi', {
      query: { kelasId: selectedKelasId.value, tanggal: tanggal.value }
    })
    sesiCount.value = res?.count ?? 0
  } catch { sesiCount.value = 0 }
}

async function loadExisting() {
  if (!selectedKelasId.value || !tanggal.value) {
    marked.value = []
    return
  }
  try {
    const res: any = await $fetch('/api/absensi/wali-kelas/existing', {
      query: { kelasId: selectedKelasId.value, tanggal: tanggal.value }
    })
    marked.value = res?.marked || []
  } catch {
    marked.value = []
  }
}

watch([selectedKelasId, tanggal], () => {
  loadExisting()
  fetchSesiCount()
})

watch(data, (d) => {
  if (d && d.kelas.length === 1 && selectedKelasId.value === null) {
    selectedKelasId.value = d.kelas[0].id
  }
}, { immediate: true })

async function submit() {
  if (!selectedKelasId.value) { showError('Pilih kelas terlebih dahulu'); return }
  // Removed future‑date restriction: allow tanggal array with future dates
  if (marked.value.length === 0) { showError('Tandai minimal satu murid'); return }
  submitting.value = true
  try {
    const res: any = await $fetch('/api/absensi/wali-kelas/kehadiran', {
      method: 'POST',
      body: {
        kelasId: selectedKelasId.value,
        tanggal: tanggal.value,
        catatanGlobal: null,
        entries: marked.value.map(m => ({
          siswaId: m.siswaId,
          status: m.status,
          keterangan: m.keterangan || null
        }))
      }
    })
    showSuccess(`Berhasil menyimpan ${marked.value.length} murid ke ${res?.sesiCount ?? 0} sesi`)
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal menyimpan kehadiran')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <PTKLayout>
    <PageHeader title="Catat Pengecualian Kehadiran" description="Tandai murid yang tidak hadir (wali kelas)" back-to="/absensi" />

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <div v-if="!pending && data && !data.isWaliKelas"
      class="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Anda belum ditugaskan sebagai wali kelas. Fitur ini hanya untuk wali kelas.
      </p>
    </div>

    <template v-else>
      <div class="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-4 mb-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kelas</label>
            <select v-if="data && data.kelas.length > 1" v-model.number="selectedKelasId"
              class="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-700 dark:text-gray-100">
              <option :value="null">— Pilih kelas —</option>
              <option v-for="k in data.kelas" :key="k.id" :value="k.id">{{ k.nama }}</option>
            </select>
            <div v-else-if="data && data.kelas.length === 1"
              class="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-slate-700/50 text-gray-700 dark:text-gray-200">
              {{ data.kelas[0].nama }}
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tanggal</label>
            <!-- Custom date selector component -->
            <DateChipSelector v-model="tanggal" :class-id="selectedKelasId" />
          </div>
        </div>
        <p v-if="selectedKelasId" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <template v-if="sesiCount > 0">
            Tanggal ini memiliki <strong class="text-gray-700 dark:text-gray-300">{{ sesiCount }} sesi</strong> untuk kelas {{ selectedKelas?.nama }}.
          </template>
        </p>
      </div>

      <LoadingSkeleton v-if="pending" type="list" :rows="3" />

      <template v-else-if="selectedKelas">
        <!-- Hero stat -->
        <div class="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-card dark:shadow-dark-card p-5 mb-4">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Murid tidak hadir hari ini</p>
          <p class="text-4xl font-extrabold text-gray-900 dark:text-gray-100 mt-1 leading-none">
            {{ markedCount }}<span class="text-base font-medium text-gray-400 dark:text-gray-500"> / {{ selectedKelas._count.siswa }} murid</span>
          </p>
          <div v-if="markedCount > 0" class="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            <span v-if="markedBreakdown.SAKIT" class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{{ markedBreakdown.SAKIT }} sakit
            </span>
            <span v-if="markedBreakdown.IZIN" class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>{{ markedBreakdown.IZIN }} izin
            </span>
            <span v-if="markedBreakdown.ALPHA" class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>{{ markedBreakdown.ALPHA }} alpha
            </span>
            <span v-if="markedBreakdown.HADIR" class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>{{ markedBreakdown.HADIR }} hadir (koreksi)
            </span>
          </div>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {{ notMarkedCount }} murid belum ditandai — diasumsikan hadir di semua sesi.
          </p>
        </div>

        <!-- Action bar -->
        <div class="flex flex-wrap items-center gap-3 mb-3">
          <button @click="openPicker" type="button"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 active:bg-primary-700 rounded-xl shadow-sm shadow-primary-500/20 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Tandai murid tidak hadir
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400">Hanya murid yang ditandai akan dikirim ke sistem.</p>
        </div>

        <!-- Daftar murid ditandai -->
        <div v-if="markedCount > 0" class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card overflow-hidden">
          <div class="px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Murid ditandai</p>
            <div class="flex items-center gap-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ markedCount }} murid</p>
              <span class="text-gray-300 dark:text-slate-600">|</span>
              <button @click="marked = []" type="button" class="text-xs font-medium text-red-500 hover:underline">
                Hapus Semua
              </button>
            </div>
          </div>
          <ul class="divide-y divide-gray-100 dark:divide-slate-700">
            <li v-for="m in marked" :key="m.siswaId" class="px-4 sm:px-5 py-3 flex items-start gap-3">
              <span :class="['mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0', statusDotColor[m.status]]"></span>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ siswaById(m.siswaId)?.nama }}</p>
                  <BaseBadge :variant="statusBadgeVariant[m.status]">{{ statusLabels[m.status] }}</BaseBadge>
                </div>
                <p v-if="m.keterangan" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ m.keterangan }}</p>
              </div>
              <div class="flex items-center gap-1 flex-shrink-0">
                <button @click="openEdit(m)" type="button" title="Edit"
                  class="p-1.5 text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="removeMarked(m.siswaId)" type="button" title="Hapus"
                  class="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                </button>
              </div>
            </li>
          </ul>
          <div class="px-4 sm:px-5 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/40 flex items-center justify-end">
            <button @click="submit" :disabled="submitting"
              class="w-full sm:w-auto justify-center px-5 py-2.5 text-sm font-semibold text-white bg-primary-500 rounded-xl hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50 inline-flex items-center gap-2 shadow-md shadow-primary-500/30 transition-colors">
              <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ submitting ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
          <p class="text-sm text-gray-700 dark:text-gray-200 font-medium">Belum ada murid ditandai</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Klik tombol di atas untuk mulai menandai murid yang tidak hadir.</p>
        </div>

      </template>
    </template>

    <!-- Picker modal -->
    <BaseModal :show="showPicker" @close="closePicker">
      <template #header>
        <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">
          {{ editingId !== null ? 'Edit penandaan' : 'Tandai murid' }}
        </h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pilih status dan murid yang dimaksud.</p>
      </template>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Status</label>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="opt in [
              { value: 'SAKIT', label: 'Sakit' },
              { value: 'IZIN', label: 'Izin' },
              { value: 'ALPHA', label: 'Alpha' }
            ]" :key="opt.value" type="button" @click="pickerStatus = opt.value as any"
              :class="pickerStatus === opt.value
                ? 'border-gray-900 dark:border-gray-100 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-sm'
                : 'border-gray-200 dark:border-slate-600 bg-transparent text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-500'"
              class="px-3 py-2 text-sm font-medium rounded-lg border transition-all">
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Keterangan (opsional)</label>
          <input v-model="pickerKeterangan" type="text" placeholder="Mis. Demam, izin keluarga" maxlength="255"
            class="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-500" />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {{ editingId !== null ? 'Ganti murid' : 'Pilih murid' }}
          </label>
          <div class="relative mb-2">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input v-model="pickerSearch" type="text" placeholder="Ketik nama atau NISN…"
              class="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder:text-gray-400" />
          </div>
          <ul v-if="availableSiswa.length > 0" class="max-h-60 overflow-y-auto border border-gray-200 dark:border-slate-600 rounded-lg divide-y divide-gray-100 dark:divide-slate-700">
            <li v-for="s in availableSiswa.slice(0, 30)" :key="s.id">
              <button type="button" @click="pickSiswa(s.id)"
                class="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <p class="text-sm text-gray-900 dark:text-gray-100">{{ s.nama }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ s.nisn }}</p>
              </button>
            </li>
          </ul>
          <p v-else class="text-xs text-gray-500 dark:text-gray-400 px-1 py-2">
            Tidak ada murid yang cocok, atau semua murid sudah ditandai.
          </p>
        </div>
      </div>

      <template #footer>
        <button @click="closePicker" type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          Batal
        </button>
      </template>
    </BaseModal>
  </PTKLayout>
</template>
