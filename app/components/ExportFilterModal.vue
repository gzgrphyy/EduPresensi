<script setup lang="ts">
const { t } = useI18n()

export interface ExportCardItem {
  id: string
  label: string
  description: string
  requiresClassMulti?: boolean
  requiresClassSingle?: boolean
  requiresDateSingle?: boolean
  requiresDateRange?: boolean
  requiresMonth?: boolean
  requiresSemester?: boolean
  requiresStudentSearch?: boolean
  requiresSessionSelect?: boolean
  requiresStatusIzin?: boolean
}

const props = defineProps<{
  show: boolean
  card: ExportCardItem | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: { jenis: string; format: 'xlsx'; filters: any }]
}>()

// Filter states
const selectedDate = ref(new Date().toISOString().slice(0, 10))
const dateRangeStart = ref(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
const dateRangeEnd = ref(new Date().toISOString().slice(0, 10))
const selectedMonth = ref(new Date().toISOString().slice(0, 7))
const selectedSemesterId = ref<number | ''>('')
const selectedKelasIds = ref<number[]>([])
const selectedSingleKelasId = ref<number | ''>('')
const selectedSiswaId = ref<number | null>(null)
const selectedSesiId = ref<number | ''>('')
const selectedStatusIzin = ref('SEMUA')

// Data sources
const { data: semesterList } = useFetch<any[]>('/api/admin/semester', { immediate: true })
const { data: kelasList } = useFetch<any[]>('/api/admin/kelas', { immediate: true })
const { data: siswaList } = useFetch<any[]>('/api/admin/siswa', { immediate: true })

// Sesi options for selected class and date
const sesiQueryParams = computed(() => ({
  ...(selectedDate.value ? { tanggalMulai: selectedDate.value, tanggalAkhir: selectedDate.value } : {}),
  ...(selectedSingleKelasId.value ? { kelasId: selectedSingleKelasId.value } : {})
}))

const { data: sesiList, refresh: refreshSesi } = useFetch<any[]>('/api/admin/rekap/sesi', {
  query: sesiQueryParams,
  immediate: false
})

watch(() => props.show, (isShown) => {
  if (isShown && props.card) {
    selectedDate.value = new Date().toISOString().slice(0, 10)
    dateRangeStart.value = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    dateRangeEnd.value = new Date().toISOString().slice(0, 10)
    selectedMonth.value = new Date().toISOString().slice(0, 7)
    selectedKelasIds.value = []
    selectedSingleKelasId.value = kelasList.value?.[0]?.id || ''
    selectedSiswaId.value = null
    selectedSesiId.value = ''
    selectedStatusIzin.value = 'SEMUA'

    const activeSem = semesterList.value?.find(s => s.isActive)
    if (activeSem) selectedSemesterId.value = activeSem.id

    if (props.card.requiresSessionSelect) {
      refreshSesi()
    }
  }
})

watch([selectedDate, selectedSingleKelasId], () => {
  if (props.card?.requiresSessionSelect) {
    refreshSesi()
  }
})

function toggleKelasChip(id: number) {
  if (selectedKelasIds.value.includes(id)) {
    selectedKelasIds.value = selectedKelasIds.value.filter(kId => kId !== id)
  } else {
    selectedKelasIds.value.push(id)
  }
}

function selectAllKelas() {
  if (!kelasList.value) return
  selectedKelasIds.value = kelasList.value.map(k => k.id)
}

function clearAllKelas() {
  selectedKelasIds.value = []
}

const siswaSearchOptions = computed(() => {
  return (siswaList.value || []).map(s => ({
    id: s.id,
    text: `${s.nama} (${s.kelas?.nama || '-'} - NISN: ${s.nisn})`
  }))
})

function handleSubmit() {
  if (!props.card) return

  const filters: any = {}

  if (props.card.requiresDateSingle) {
    filters.tanggal = selectedDate.value
  }
  if (props.card.requiresDateRange) {
    filters.tanggalMulai = dateRangeStart.value
    filters.tanggalSelesai = dateRangeEnd.value
  }
  if (props.card.requiresMonth) {
    filters.bulan = selectedMonth.value
  }
  if (props.card.requiresSemester && selectedSemesterId.value) {
    filters.semesterId = selectedSemesterId.value
  }
  if (props.card.requiresClassMulti) {
    filters.kelasIds = selectedKelasIds.value
  }
  if (props.card.requiresClassSingle && selectedSingleKelasId.value) {
    filters.kelasId = selectedSingleKelasId.value
  }
  if (props.card.requiresStudentSearch && selectedSiswaId.value) {
    filters.siswaId = selectedSiswaId.value
  }
  if (props.card.requiresSessionSelect && selectedSesiId.value) {
    filters.sesiId = selectedSesiId.value
  }
  if (props.card.requiresStatusIzin) {
    filters.statusIzin = selectedStatusIzin.value
  }

  emit('submit', {
    jenis: props.card.id,
    format: 'xlsx',
    filters
  })
}
</script>

<template>
  <BaseModal :show="show" :title="card?.label || t('admin.export.title')" max-width="max-w-lg" @close="emit('close')">
    <div v-if="card" class="space-y-4 text-xs">
      <p class="text-gray-500 dark:text-gray-400 -mt-1">{{ card.description }}</p>

      <!-- 1. Semester Filter -->
      <div v-if="card.requiresSemester" class="space-y-1.5">
        <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelSemester') }}</label>
        <select v-model="selectedSemesterId"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">-- {{ t('admin.export.labelSemester') }} --</option>
          <option v-for="sem in semesterList || []" :key="sem.id" :value="sem.id">
            {{ sem.nama }} - {{ sem.tahunAjaran?.nama }} {{ sem.isActive ? '(Aktif)' : '' }}
          </option>
        </select>
      </div>

      <!-- 2. Bulan Filter -->
      <div v-if="card.requiresMonth" class="space-y-1.5">
        <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelBulan') }}</label>
        <input type="month" v-model="selectedMonth"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      <!-- 3. Single Date Filter -->
      <div v-if="card.requiresDateSingle" class="space-y-1.5">
        <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelTanggal') }}</label>
        <input type="date" v-model="selectedDate"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>

      <!-- 4. Date Range Filter -->
      <div v-if="card.requiresDateRange" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelTanggalMulai') }}</label>
          <input type="date" v-model="dateRangeStart"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div class="space-y-1.5">
          <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelTanggalSelesai') }}</label>
          <input type="date" v-model="dateRangeEnd"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
      </div>

      <!-- 5. Single Class Select -->
      <div v-if="card.requiresClassSingle" class="space-y-1.5">
        <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelKelas') }}</label>
        <select v-model="selectedSingleKelasId"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Semua Kelas</option>
          <option v-for="k in kelasList || []" :key="k.id" :value="k.id">
            {{ k.nama }}
          </option>
        </select>
      </div>

      <!-- 6. Session Select -->
      <div v-if="card.requiresSessionSelect" class="space-y-1.5">
        <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelSesi') }}</label>
        <select v-model="selectedSesiId"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Semua Sesi pada Tanggal Ini</option>
          <option v-for="sesi in sesiList || []" :key="sesi.sesiId" :value="sesi.sesiId">
            {{ sesi.jamMulai }}-{{ sesi.jamSelesai }} | {{ sesi.mapel }} ({{ sesi.kelas }})
          </option>
        </select>
        <p v-if="sesiList && sesiList.length === 0" class="text-[11px] text-amber-600 dark:text-amber-400">
          {{ t('admin.export.tidakAdaSesi') }}
        </p>
      </div>

      <!-- 7. Searchable Student Select -->
      <div v-if="card.requiresStudentSearch" class="space-y-1.5">
        <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelMurid') }}</label>
        <SearchableSelect
          v-model="selectedSiswaId"
          :options="siswaSearchOptions"
          :placeholder="t('admin.export.searchMuridPlaceholder')"
        />
      </div>

      <!-- 8. Status Izin Select -->
      <div v-if="card.requiresStatusIzin" class="space-y-1.5">
        <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelStatus') }}</label>
        <select v-model="selectedStatusIzin"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="SEMUA">{{ t('admin.export.semuaStatus') }}</option>
          <option value="DISETUJUI">{{ t('admin.export.statusDisetujui') }}</option>
          <option value="PENDING">{{ t('admin.export.statusPending') }}</option>
          <option value="DITOLAK">{{ t('admin.export.statusDitolak') }}</option>
        </select>
      </div>

      <!-- 9. Multi-select Class Chips -->
      <div v-if="card.requiresClassMulti" class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="block font-medium text-gray-700 dark:text-gray-300">{{ t('admin.export.labelKelas') }}</label>
          <div class="flex items-center gap-2">
            <button type="button" @click="selectAllKelas" class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
              {{ t('admin.export.pilihSemua') }}
            </button>
            <span class="text-gray-300">|</span>
            <button type="button" @click="clearAllKelas" class="text-[11px] text-gray-500 hover:underline">
              {{ t('admin.export.hapusSemua') }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
          <button type="button"
            @click="selectedKelasIds = []"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
            :class="selectedKelasIds.length === 0 ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700'">
            {{ t('admin.export.semuaKelas') }}
          </button>
          <button v-for="k in kelasList || []" :key="k.id"
            type="button"
            @click="toggleKelasChip(k.id)"
            class="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
            :class="selectedKelasIds.includes(k.id) ? 'bg-blue-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:border-gray-300'">
            {{ k.nama }}
          </button>
        </div>
        <p class="text-[11px] text-gray-400">
          {{ selectedKelasIds.length === 0 ? t('admin.export.semuaKelas') : `${selectedKelasIds.length} kelas dipilih` }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <button type="button" @click="emit('close')" :disabled="loading"
          class="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
          {{ t('admin.export.btnBatal') }}
        </button>
        <button type="button" @click="handleSubmit" :disabled="loading || (card?.requiresStudentSearch && !selectedSiswaId)"
          class="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {{ t('admin.export.btnUnduhLaporan') }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>
