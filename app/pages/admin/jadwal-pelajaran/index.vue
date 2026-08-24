<script setup lang="ts">
interface Jadwal {
  id: number
  mapel: string
  hari: string
  jamMulai: string
  jamSelesai: string
  kelas: { id: number; nama: string }
  ruangan: { id: number; nama: string }
  guru: { id: number; nama: string; jenisKelamin: string | null }
  ptkPendamping?: { id: number; nama: string; jenisKelamin: string | null } | null
}

const { t } = useI18n()

function jenisKelaminLabel(jk: string | null) {
  if (jk === 'LAKI_LAKI') return t('admin.guru.jenisKelaminL')
  if (jk === 'PEREMPUAN') return t('admin.guru.jenisKelaminP')
  return ''
}

const { data: kelasList } = useFetch<{ id: number; nama: string }[]>('/api/admin/kelas', { immediate: true })
const { data: guruList } = useFetch<{ id: number; nama: string }[]>('/api/admin/guru', { immediate: true })
const { data: ruanganList } = useFetch<{ id: number; nama: string }[]>('/api/admin/ruangan', { immediate: true })
const { data: pendampingList } = useFetch<{ id: number; nama: string }[]>('/api/admin/ptk-pendamping', { immediate: true })

const hariList = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU']
const hariLabel = (h: string) => t('hari.' + h)

const draftSearch = ref('')
const draftJenjang = ref('')
const draftKelasId = ref<number | undefined>(undefined)

const appliedSearch = ref('')
const appliedJenjang = ref('')
const appliedKelasId = ref<number | undefined>(undefined)

const page = ref(1)
const pageSize = 10

const { data: jadwalList, pending, refresh } = useFetch<Jadwal[]>('/api/admin/jadwal-pelajaran', {
  immediate: true
})

function jenjangOf(nama: string) {
  return (nama.match(/^[IVXLCDM]+/)?.[0] || '').toUpperCase()
}

const jenjangList = computed(() => {
  const set = new Set<string>()
  for (const k of kelasList.value || []) {
    const j = jenjangOf(k.nama)
    if (j) set.add(j)
  }
  return [...set].sort()
})

const filteredKelasList = computed(() => {
  if (!draftJenjang.value) return kelasList.value || []
  return (kelasList.value || []).filter(k => jenjangOf(k.nama) === draftJenjang.value)
})

const filteredJadwal = computed(() => {
  const q = appliedSearch.value.trim().toLowerCase()
  return (jadwalList.value || []).filter((j) => {
    const matchKelas = !appliedKelasId.value || j.kelas.id === appliedKelasId.value
    const matchJenjang = !appliedJenjang.value || jenjangOf(j.kelas?.nama || '') === appliedJenjang.value
    const matchMapel = !q || j.mapel.toLowerCase().includes(q)
    return matchKelas && matchJenjang && matchMapel
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredJadwal.value.length / pageSize)))

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
  return filteredJadwal.value.slice(start, start + pageSize)
})

watch([appliedSearch, appliedJenjang, appliedKelasId], () => { page.value = 1 })
watch(draftJenjang, () => { draftKelasId.value = undefined })

function applyFilter() {
  appliedSearch.value = draftSearch.value.trim()
  appliedJenjang.value = draftJenjang.value
  appliedKelasId.value = draftKelasId.value
}

function resetFilter() {
  draftSearch.value = ''
  draftJenjang.value = ''
  draftKelasId.value = undefined
  appliedSearch.value = ''
  appliedJenjang.value = ''
  appliedKelasId.value = undefined
}

const showModal = ref(false)
const editing = ref<Jadwal | null>(null)
const form = ref({ mapel: '', hari: 'SENIN', jamMulai: '', jamSelesai: '', kelasId: 0, ruanganId: 0, guruId: 0, ptkPendampingId: 0 })
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const confirmDelete = ref<{ id: number; mapel: string } | null>(null)
const confirmClose = ref(false)
const dirtyForm = ref(false)

function showError(msg: string) {
  errorMsg.value = msg
  setTimeout(() => { errorMsg.value = '' }, 5000)
}

function showSuccess(msg: string) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}

function openCreate() {
  editing.value = null
  form.value = { mapel: '', hari: 'SENIN', jamMulai: '', jamSelesai: '', kelasId: 0, ruanganId: 0, guruId: 0, ptkPendampingId: 0 }
  errorMsg.value = ''
  dirtyForm.value = false
  showModal.value = true
}

function openEdit(item: Jadwal) {
  editing.value = item
  form.value = {
    mapel: item.mapel,
    hari: item.hari,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai,
    kelasId: item.kelas.id,
    ruanganId: item.ruangan.id,
    guruId: item.guru.id,
    ptkPendampingId: item.ptkPendamping?.id || 0
  }
  errorMsg.value = ''
  dirtyForm.value = false
  showModal.value = true
}

function onFormChange() { dirtyForm.value = true }

function handleCloseClick() {
  showModal.value = false
}

async function handleSave() {
  saving.value = true
  errorMsg.value = ''

  try {
    const body = {
      mapel: form.value.mapel,
      hari: form.value.hari,
      jamMulai: form.value.jamMulai,
      jamSelesai: form.value.jamSelesai,
      kelasId: form.value.kelasId,
      ruanganId: form.value.ruanganId,
      guruId: form.value.guruId,
      ptkPendampingId: form.value.ptkPendampingId || null
    }

    if (editing.value) {
      const { error } = await useFetch(`/api/admin/jadwal-pelajaran/${editing.value.id}`, { method: 'PATCH', body })
      if (error.value) { showError(error.value.statusMessage || 'Gagal menyimpan'); return }
      showSuccess(t('admin.jadwal.msgBerhasilEdit'))
    } else {
      const { error } = await useFetch('/api/admin/jadwal-pelajaran', { method: 'POST', body })
      if (error.value) { showError(error.value.statusMessage || 'Gagal menyimpan'); return }
      showSuccess(t('admin.jadwal.msgBerhasilTambah'))
    }
    showModal.value = false
    confirmClose.value = false
    await refresh()
  } finally { saving.value = false }
}

function promptDelete(item: Jadwal) {
  confirmDelete.value = { id: item.id, mapel: item.mapel }
}

async function handleDelete() {
  if (!confirmDelete.value) return
  const { id } = confirmDelete.value
  confirmDelete.value = null
  const { error } = await useFetch(`/api/admin/jadwal-pelajaran/${id}`, { method: 'DELETE' })
  if (error.value) { showError(error.value.statusMessage || 'Gagal menghapus'); return }
  showSuccess(t('admin.jadwal.msgBerhasilHapus'))
  await refresh()
}

// Import Excel state
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importPreview = ref<Array<Record<string, any>>>([])
const importHeaders = ref<string[]>([])
const importLoading = ref(false)
const importSubmitting = ref(false)
const importResult = ref<{ success: number; failed: number; errors: Array<{ row: number; error: string }> } | null>(null)

function openImport() {
  showImportModal.value = true
  importFile.value = null
  importPreview.value = []
  importHeaders.value = []
  importLoading.value = false
  importSubmitting.value = false
  importResult.value = null
}

function closeImportModal() {
  showImportModal.value = false
  importFile.value = null
  importPreview.value = []
  importHeaders.value = []
  importResult.value = null
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importFile.value = file
  importLoading.value = true
  importResult.value = null

  try {
    const buffer = await file.arrayBuffer()
    // @ts-ignore
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' })

    if (jsonData.length === 0) {
      showError('File Excel kosong')
      importPreview.value = []
      importHeaders.value = []
      return
    }

    importHeaders.value = Object.keys(jsonData[0])
    importPreview.value = jsonData.slice(0, 50)
  } catch (err) {
    showError('Gagal membaca file Excel')
    importPreview.value = []
    importHeaders.value = []
  } finally {
    importLoading.value = false
  }
}

async function handleImport() {
  if (importPreview.value.length === 0) return

  importSubmitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const items = importPreview.value.map(row => ({
      hari: String(row['Hari'] || row['hari'] || '').trim(),
      jamMulai: String(row['Jam Mulai'] || row['jamMulai'] || '').trim(),
      jamSelesai: String(row['Jam Selesai'] || row['jamSelesai'] || '').trim(),
      mapel: String(row['Mapel'] || row['mapel'] || '').trim(),
      kelas: String(row['Kelas'] || row['kelas'] || '').trim(),
      ruangan: String(row['Ruangan'] || row['ruangan'] || '').trim(),
      guruPengampu: String(row['Guru Pengampu'] || row['guruPengampu'] || '').trim(),
      ptkPendamping: String(row['PTK Pendamping'] || row['ptkPendamping'] || '').trim() || null
    }))

    const { data, error } = await useFetch('/api/admin/jadwal-pelajaran/import', {
      method: 'POST',
      body: { items }
    })

    if (error.value) {
      showError(error.value.statusMessage || 'Gagal import data')
      return
    }

    importResult.value = data.value?.summary || null
    if (data.value?.summary?.failed === 0) {
      showSuccess(data.value?.message || 'Import berhasil')
      await refresh()
    } else if (data.value?.summary?.success === 0) {
      showError('Semua data gagal diimport')
    } else {
      showSuccess(data.value?.message || 'Import sebagian berhasil')
      await refresh()
    }
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal import data')
  } finally {
    importSubmitting.value = false
  }
}
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.jadwal.title')" :description="t('admin.jadwal.desc')" />

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="draftSearch" type="text" :placeholder="t('admin.jadwal.searchPlaceholder')"
            class="w-40 sm:w-56 pl-9 pr-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </div>
        <select v-model="draftJenjang"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">{{ t('admin.jadwal.semuaJenjang') }}</option>
          <option v-for="j in jenjangList" :key="j" :value="j">{{ j }}</option>
        </select>
        <select v-model="draftKelasId"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option :value="undefined">{{ t('admin.jadwal.semuaKelas') }}</option>
          <option v-for="k in filteredKelasList" :key="k.id" :value="k.id">{{ k.nama }}</option>
        </select>
        <button @click="applyFilter"
          class="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md border border-blue-600 transition-colors">
          {{ t('common.terapkan') }}
        </button>
        <button @click="resetFilter"
          class="px-3 py-2 text-xs  text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md border admin-accent-border transition-colors">
          {{ t('common.aturUlang') }}
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button @click="openImport"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-md border admin-accent-border hover:bg-gray-50 dark:hover:bg-slate-700 text-xs transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span class="hidden sm:inline">Import Excel</span>
        </button>
        <button @click="openCreate"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs ">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">{{ t('admin.jadwal.tambahJadwal') }}</span>
        </button>
      </div>
    </div>

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="8" />

    <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
      <div class="overflow-x-auto scrollbar-thin">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.jadwal.colMapel') }}</th>
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.jadwal.colHari') }}</th>
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.jadwal.colJam') }}</th>
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell">{{ t('admin.jadwal.colKelas') }}</th>
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden md:table-cell">{{ t('admin.jadwal.colRuangan') }}</th>
                <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden lg:table-cell">{{ t('admin.jadwal.colPtk') }}</th>
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden xl:table-cell">{{ t('admin.jadwal.colPtkPendamping') }}</th>
              <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.tahunAjaran.colAksi') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y admin-accent-divide">
            <tr v-for="item in visibleData" :key="item.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
              <td class="px-4 py-3  text-gray-900 dark:text-gray-100">{{ item.mapel }}</td>
              <td class="px-4 py-3">
                <BaseBadge variant="blue" size="sm">{{ hariLabel(item.hari) }}</BaseBadge>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{{ item.jamMulai }} - {{ item.jamSelesai }}</td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell">{{ item.kelas.nama }}</td>
              <td class="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{{ item.ruangan.nama }}</td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <div class="min-w-0">
                  <span class="text-gray-500 dark:text-gray-400 text-xs">{{ item.guru.nama }}</span>
                  <div v-if="item.guru.jenisKelamin" class="text-[10px] text-gray-400 dark:text-gray-500">
                    {{ jenisKelaminLabel(item.guru.jenisKelamin) }}
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 hidden xl:table-cell">
                <div v-if="item.ptkPendamping" class="min-w-0">
                  <span class="text-gray-500 dark:text-gray-400 text-xs">{{ item.ptkPendamping.nama }}</span>
                  <div v-if="item.ptkPendamping.jenisKelamin" class="text-[10px] text-gray-400 dark:text-gray-500">
                    {{ jenisKelaminLabel(item.ptkPendamping.jenisKelamin) }}
                  </div>
                </div>
                <span v-else class="text-gray-500 dark:text-gray-400 text-xs">-</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-center gap-1">
                  <button @click="openEdit(item)" class="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-md" :title="t('common.edit')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button @click="promptDelete(item)" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md" :title="t('common.hapus')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredJadwal.length === 0">
              <td colspan="8" class="px-4 py-16 text-center">
                <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p class="text-gray-500 dark:text-gray-400 ">{{ t('admin.jadwal.empty') }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filteredJadwal.length > pageSize" class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize, filteredJadwal.length), total: filteredJadwal.length, unit: t('admin.jadwal.unitJadwal') }) }}
        </p>
        <div class="ml-auto flex items-center gap-2">
          <button
            @click="page--"
            :disabled="page <= 1"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs  text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                  ? 'w-7 h-7 rounded-md text-xs  text-white bg-primary-600 ring-1 ring-primary-600 cursor-default'
                  : 'w-7 h-7 rounded-md text-xs  text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 transition-colors'"
              >
                {{ n }}
              </button>
              <span v-else class="px-0.5 text-xs text-gray-400 dark:text-gray-500 select-none">&hellip;</span>
            </template>
          </div>
          <button
            @click="page++"
            :disabled="page >= totalPages"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs  text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {{ t('common.selanjutnya') }}
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <BaseModal :show="showModal" :title="editing ? t('admin.jadwal.modalEdit') : t('admin.jadwal.modalCreate')" @close="handleCloseClick" max-w="max-w-lg">
      <form @submit.prevent="handleSave" class="space-y-4">
        <BaseFormField :label="t('admin.jadwal.labelMapel')" required>
          <input v-model="form.mapel" type="text" @input="onFormChange" required
            :placeholder="t('admin.jadwal.placeholderMapel')"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </BaseFormField>

        <div class="grid grid-cols-2 gap-4">
          <BaseFormField :label="t('admin.jadwal.labelHari')" required>
            <select v-model="form.hari" @change="onFormChange" required
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700">
              <option v-for="h in hariList" :key="h" :value="h">{{ hariLabel(h) }}</option>
            </select>
          </BaseFormField>

          <BaseFormField :label="t('admin.jadwal.labelKelas')" required>
            <select v-model="form.kelasId" @change="onFormChange" required
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700">
              <option :value="0" disabled>{{ t('admin.jadwal.pilihKelas') }}</option>
              <option v-for="k in kelasList" :key="k.id" :value="k.id">{{ k.nama }}</option>
            </select>
          </BaseFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseFormField :label="t('admin.jadwal.labelJamMulai')" required>
            <input v-model="form.jamMulai" type="time" @input="onFormChange" required
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
          </BaseFormField>

          <BaseFormField :label="t('admin.jadwal.labelJamSelesai')" required>
            <input v-model="form.jamSelesai" type="time" @input="onFormChange" required
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500" />
          </BaseFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseFormField :label="t('admin.jadwal.labelRuangan')" required>
            <select v-model="form.ruanganId" @change="onFormChange" required
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700">
              <option :value="0" disabled>{{ t('admin.jadwal.pilihRuangan') }}</option>
              <option v-for="r in ruanganList" :key="r.id" :value="r.id">{{ r.nama }}</option>
            </select>
          </BaseFormField>

          <BaseFormField :label="t('admin.jadwal.labelPtk')" required>
            <select v-model="form.guruId" @change="onFormChange" required
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700">
              <option :value="0" disabled>{{ t('admin.jadwal.pilihPtk') }}</option>
              <option v-for="g in guruList" :key="g.id" :value="g.id">{{ g.nama }}</option>
            </select>
          </BaseFormField>
        </div>

        <BaseFormField :label="t('admin.jadwal.labelPtkPendamping')">
          <select v-model="form.ptkPendampingId" @change="onFormChange"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700">
            <option :value="0">{{ t('admin.jadwal.tanpaPtkPendamping') }}</option>
            <option v-for="p in pendampingList" :key="p.id" :value="p.id">{{ p.nama }}</option>
          </select>
        </BaseFormField>

      </form>
      <template #footer>
        <button type="button" @click="handleCloseClick" class="px-4 py-2 text-xs  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">{{ t('common.batal') }}</button>
        <button type="submit" @click="handleSave" :disabled="saving"
          class="px-5 py-2 text-xs  text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
          <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          {{ saving ? t('common.menyimpan') : t('common.simpan') }}
        </button>
      </template>
    </BaseModal>

    <ConfirmDialog
      :show="!!confirmDelete"
      :title="t('admin.jadwal.confirmDeleteTitle')"
      :message="t('admin.jadwal.confirmDeleteMsg', { mapel: confirmDelete?.mapel })"
      variant="danger"
      @confirm="handleDelete"
      @cancel="confirmDelete = null"
    />

    <Teleport to="body">
      <!-- Modal Import Excel -->
      <Transition name="fade">
        <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeImportModal"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl mx-auto overflow-hidden border border-gray-300 dark:border-gray-600 max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg text-gray-900 dark:text-gray-100">Import Jadwal Pelajaran</h2>
              <button @click="closeImportModal"
                class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="p-4 overflow-y-auto flex-1 space-y-4">
              <!-- Template Download -->
              <div class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div>
                  <p class="text-xs font-medium text-blue-700 dark:text-blue-300">Belum punya template?</p>
                  <p class="text-xs text-blue-600 dark:text-blue-400">Unduh template Excel dengan format kolom yang sesuai</p>
                </div>
                <a href="/api/admin/jadwal-pelajaran/template-export" download class="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Unduh Template
                </a>
              </div>

              <!-- File Upload Area -->
              <div v-if="!importPreview.length && !importResult" class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <input type="file" accept=".xlsx,.xls,.csv" @change="handleFileChange" class="hidden" id="jadwal-import-file" />
                <label for="jadwal-import-file" class="cursor-pointer inline-flex flex-col items-center gap-3">
                  <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span class="text-sm text-gray-600 dark:text-gray-400">Pilih file Excel untuk diimport</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500">Kolom: Hari, Jam Mulai, Jam Selesai, Mapel, Kelas, Ruangan, Guru Pengampu, PTK Pendamping (opsional)</span>
                </label>
              </div>

              <!-- Preview Table -->
              <div v-if="importPreview.length > 0 && !importResult" class="space-y-3">
                <p class="text-xs text-gray-500 dark:text-gray-400">Pratinjau {{ importPreview.length }} baris pertama</p>
                <div class="overflow-x-auto border border-gray-200 dark:border-slate-600 rounded-lg">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="bg-gray-50 dark:bg-slate-700/50">
                        <th v-for="header in importHeaders" :key="header" class="px-3 py-2 text-left text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-slate-600">
                          {{ header }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-slate-600">
                      <tr v-for="(row, idx) in importPreview" :key="idx" class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                        <td v-for="header in importHeaders" :key="header" class="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {{ row[header] || '-' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Import Result -->
              <div v-if="importResult" class="space-y-3">
                <div class="p-4 rounded-lg border" :class="importResult.failed === 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'">
                  <div class="flex items-center gap-2 mb-2">
                    <svg v-if="importResult.failed === 0" class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <svg v-else class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Import selesai</span>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    Berhasil: <span class="font-medium text-green-600">{{ importResult.success }}</span> |
                    Gagal: <span class="font-medium text-red-600">{{ importResult.failed }}</span> |
                    Total: {{ importResult.success + importResult.failed }}
                  </p>
                </div>

                <div v-if="importResult.errors.length > 0" class="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                  <div class="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b border-red-200 dark:border-red-800">
                    <p class="text-xs font-medium text-red-700 dark:text-red-400">Detail error:</p>
                  </div>
                  <div class="max-h-48 overflow-y-auto">
                    <div v-for="(err, idx) in importResult.errors" :key="idx" class="px-4 py-2 border-b border-red-100 dark:border-red-900/30 last:border-b-0">
                      <span class="text-xs text-red-600 dark:text-red-400">Baris {{ err.row }}: {{ err.error }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div v-if="!importResult" class="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button type="button" @click="closeImportModal"
                class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                Batal
              </button>
              <button type="button" @click="handleImport" :disabled="importSubmitting || importPreview.length === 0"
                class="px-5 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                <svg v-if="importSubmitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ importSubmitting ? t('common.menyimpan') : 'Import Sekarang' }}
              </button>
            </div>
            <div v-else class="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button type="button" @click="closeImportModal"
                class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.tutup') }}
              </button>
              <button type="button" @click="openImport"
                class="px-5 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800">
                Import Lagi
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
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
</style>
