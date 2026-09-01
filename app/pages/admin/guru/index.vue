<script setup lang="ts">
interface Guru {
  id: number
  nama: string
  email: string
  nip: string | null
  nomorHp1: string | null
  nomorHp2: string | null
  jenisKelamin: string | null
  foto: string | null
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { kelasWali: number }
}

interface PtkPendamping {
  id: number
  nama: string
  nip: string | null
  nomorHp: string | null
  jenisKelamin: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type Jenis = 'PTK' | 'PENDAMPING'

interface Row {
  key: string
  jenis: Jenis
  id: number
  nama: string
  foto: string | null
  email: string | null
  nip: string | null
  nomorHp: string | null
  nomorHp2: string | null
  jenisKelamin: string | null
  role: string | null
  isActive: boolean
}

const { t } = useI18n()

const showInactive = ref(false)
const searchQuery = ref('')
const sortOrder = ref('')
const page = ref(1)
const pageSize = 10

function toggleSort() {
  sortOrder.value = sortOrder.value === 'abjad' ? '' : 'abjad'
  page.value = 1
}

// Foto profil dummy untuk PTK yang belum punya foto asli (dibedakan laki-laki/perempuan)
const dummyAvatarsLaki = [
  '/images/avatars/laki-1.svg',
  '/images/avatars/laki-2.svg',
  '/images/avatars/laki-3.svg',
]

const dummyAvatarsPerempuan = [
  '/images/avatars/perempuan-1.svg',
  '/images/avatars/perempuan-2.svg',
  '/images/avatars/perempuan-3.svg',
]

function dummyAvatar(seed: string, jenisKelamin: string | null): string {
  const list = jenisKelamin === 'PEREMPUAN' ? dummyAvatarsPerempuan : dummyAvatarsLaki
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return list[hash % list.length]
}

function jenisKelaminLabel(jk: string | null) {
  if (jk === 'LAKI_LAKI') return t('admin.guru.jenisKelaminL')
  if (jk === 'PEREMPUAN') return t('admin.guru.jenisKelaminP')
  return ''
}

const guruParams = computed(() => {
  const params = new URLSearchParams()
  if (showInactive.value) params.set('showInactive', 'true')
  if (searchQuery.value) params.set('search', searchQuery.value)
  return params.toString()
})

const { data: guruData, pending: guruPending, refresh: refreshGuru } = useFetch<Guru[]>(() => `/api/admin/guru?${guruParams.value}`, { immediate: true })
const { data: pendampingData, pending: pendampingPending, refresh: refreshPendamping } = useFetch<PtkPendamping[]>(() => `/api/admin/ptk-pendamping?${guruParams.value}`, { immediate: true })

const pending = computed(() => guruPending.value || pendampingPending.value)

// Gabungan semua data PTK
const rows = computed<Row[]>(() => {
  const all: Row[] = []
  for (const g of guruData.value || []) {
    all.push({
      key: `ptk-${g.id}`,
      jenis: 'PTK',
      id: g.id,
      nama: g.nama,
      foto: g.foto,
      email: g.email,
      nip: g.nip,
      nomorHp: g.nomorHp1,
      nomorHp2: g.nomorHp2,
      jenisKelamin: g.jenisKelamin,
      role: g.role,
      isActive: g.isActive
    })
  }
  for (const p of pendampingData.value || []) {
    all.push({
      key: `pendamping-${p.id}`,
      jenis: 'PENDAMPING',
      id: p.id,
      nama: p.nama,
      foto: null,
      email: null,
      nip: p.nip,
      nomorHp: p.nomorHp,
      nomorHp2: null,
      jenisKelamin: p.jenisKelamin,
      role: null,
      isActive: p.isActive
    })
  }

  if (sortOrder.value === 'abjad') return all.slice().sort((a, b) => a.nama.localeCompare(b.nama))
  return all
})

const totalPages = computed(() => Math.max(1, Math.ceil(rows.value.length / pageSize)))

// Nomor halaman untuk lompat langsung (pakai elipsis jika halaman banyak)
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
  return rows.value.slice(start, start + pageSize)
})

watch([showInactive, searchQuery], () => { page.value = 1 })

const emptyMsg = computed(() =>
  showInactive.value ? t('admin.guru.emptyInactive') : t('admin.guru.empty')
)

const showModal = ref(false)
const showPasswordModal = ref(false)
const editingRow = ref<Row | null>(null)
const editingGuru = ref<Guru | null>(null)
const editingPendamping = ref<PtkPendamping | null>(null)
const form = ref({ nama: '', email: '', nip: '', nomorHp1: '', nomorHp2: '', jenisKelamin: '' })
const saving = ref(false)
const generatedPassword = ref('')
const resetPasswordFor = ref<Guru | null>(null)
const confirmToggle = ref<{ jenis: Jenis; id: number; nama: string; active: boolean } | null>(null)
const confirmDelete = ref<{ id: number; nama: string } | null>(null)
const confirmClose = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const dirtyForm = ref(false)

// Import Excel state
const showImportModal = ref(false)
const importFile = ref<File | null>(null)
const importPreview = ref<Array<Record<string, any>>>([])
const importHeaders = ref<string[]>([])
const importLoading = ref(false)
const importSubmitting = ref(false)
const importResult = ref<{ success: number; failed: number; errors: Array<{ row: number; error: string }> } | null>(null)

function showError(msg: string) {
  errorMsg.value = msg
  setTimeout(() => { errorMsg.value = '' }, 5000)
}

function showSuccess(msg: string) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}

function openImport() {
  showImportModal.value = true
  importFile.value = null
  importPreview.value = []
  importHeaders.value = []
  importLoading.value = false
  importSubmitting.value = false
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

function closeImportModal() {
  showImportModal.value = false
  importFile.value = null
  importPreview.value = []
  importHeaders.value = []
  importResult.value = null
}

async function handleImport() {
  if (importPreview.value.length === 0) return

  importSubmitting.value = true
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const items = importPreview.value.map(row => ({
      nama: String(row['Nama'] || row['nama'] || '').trim(),
      email: String(row['Email'] || row['email'] || '').trim(),
      nip: String(row['NIP'] || row['nip'] || '').trim() || null,
      nomorHp1: String(row['No HP 1'] || row['noHp1'] || row['nomorHp1'] || '').trim() || null,
      nomorHp2: String(row['No HP 2'] || row['noHp2'] || row['nomorHp2'] || '').trim() || null,
      jenisKelamin: String(row['Jenis Kelamin'] || row['jenisKelamin'] || '').trim() || null
    }))

    const { data, error } = await useFetch('/api/admin/guru/import', {
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
      await Promise.all([refreshGuru(), refreshPendamping()])
    } else if (data.value?.summary?.success === 0) {
      showError('Semua data gagal diimport')
    } else {
      showSuccess(data.value?.message || 'Import sebagian berhasil')
      await Promise.all([refreshGuru(), refreshPendamping()])
    }
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal import data')
  } finally {
    importSubmitting.value = false
  }
}

function openCreate() {
  editingRow.value = null
  editingGuru.value = null
  editingPendamping.value = null
  form.value = { nama: '', email: '', nip: '', nomorHp1: '', nomorHp2: '', jenisKelamin: '' }
  errorMsg.value = ''
  successMsg.value = ''
  dirtyForm.value = false
  showModal.value = true
}

function openEdit(item: Row) {
  editingRow.value = item
  editingGuru.value = null
  editingPendamping.value = null
  if (item.jenis === 'PTK') {
    editingGuru.value = guruData.value?.find(g => g.id === item.id) || null
  } else {
    editingPendamping.value = pendampingData.value?.find(p => p.id === item.id) || null
  }
  form.value = {
    nama: item.nama,
    email: editingGuru.value?.email || '',
    nip: item.nip || '',
    nomorHp1: item.jenis === 'PTK' ? (editingGuru.value?.nomorHp1 || '') : (item.nomorHp || ''),
    nomorHp2: item.jenis === 'PTK' ? (editingGuru.value?.nomorHp2 || '') : '',
    jenisKelamin: item.jenisKelamin || ''
  }
  errorMsg.value = ''
  successMsg.value = ''
  dirtyForm.value = false
  showModal.value = true
}

function onFormChange() {
  dirtyForm.value = true
}

function handleCloseClick() {
  if (dirtyForm.value) {
    confirmClose.value = true
  } else {
    showModal.value = false
  }
}

async function handleSave() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''

  if (!form.value.nama.trim()) { showError('Nama lengkap wajib diisi'); saving.value = false; return }
  if (!form.value.jenisKelamin) { showError('Jenis kelamin wajib diisi'); saving.value = false; return }
  if (!form.value.nip.trim()) { showError('NIP wajib diisi'); saving.value = false; return }
  if (!form.value.nomorHp1.trim()) { showError('No. HP 1 wajib diisi'); saving.value = false; return }

  try {
    if (editingRow.value) {
      if (editingRow.value.jenis === 'PTK') {
        const guru = editingGuru.value
        if (!guru) return
        const body: Record<string, unknown> = {}
        if (form.value.nama !== guru.nama) body.nama = form.value.nama
        if (form.value.email !== guru.email) body.email = form.value.email
        if ((form.value.nip || null) !== guru.nip) body.nip = form.value.nip || null
        if ((form.value.nomorHp1 || null) !== guru.nomorHp1) body.nomorHp1 = form.value.nomorHp1 || null
        if ((form.value.nomorHp2 || null) !== guru.nomorHp2) body.nomorHp2 = form.value.nomorHp2 || null
        if ((form.value.jenisKelamin || null) !== guru.jenisKelamin) body.jenisKelamin = form.value.jenisKelamin || null

        if (Object.keys(body).length === 0) {
          showModal.value = false
          return
        }

        const { error } = await useFetch(`/api/admin/guru/${guru.id}`, {
          method: 'PATCH',
          body
        })
        if (error.value) {
          showError(error.value.statusMessage || 'Gagal menyimpan')
          return
        }
        showSuccess(t('admin.guru.msgBerhasilEdit'))
      } else {
        const pendamping = editingPendamping.value
        if (!pendamping) return
        const body = {
          nama: form.value.nama,
          nip: form.value.nip || null,
          nomorHp: form.value.nomorHp1 || null,
          jenisKelamin: form.value.jenisKelamin || null
        }
        const { error } = await useFetch(`/api/admin/ptk-pendamping/${pendamping.id}`, {
          method: 'PATCH',
          body
        })
        if (error.value) {
          showError(error.value.statusMessage || 'Gagal menyimpan')
          return
        }
        showSuccess(t('admin.guru.msgBerhasilEdit'))
      }
    } else {
      // PTK dengan email = punya akun login; tanpa email = cukup data kontak
      if (form.value.email.trim() !== '') {
        const { data: result, error } = await useFetch('/api/admin/guru', {
          method: 'POST',
          body: {
            nama: form.value.nama,
            email: form.value.email,
            nip: form.value.nip || undefined,
            nomorHp1: form.value.nomorHp1 || undefined,
            nomorHp2: form.value.nomorHp2 || undefined,
            jenisKelamin: form.value.jenisKelamin || undefined
          }
        })
        if (error.value) {
          showError(error.value.statusMessage || 'Gagal menyimpan')
          return
        }
        if (result.value?.generatedPassword) {
          generatedPassword.value = result.value.generatedPassword
          showPasswordModal.value = true
        }
      } else {
        const { error } = await useFetch('/api/admin/ptk-pendamping', {
          method: 'POST',
          body: {
            nama: form.value.nama,
            nip: form.value.nip || null,
            nomorHp: form.value.nomorHp1 || null,
            jenisKelamin: form.value.jenisKelamin || null
          }
        })
        if (error.value) {
          showError(error.value.statusMessage || 'Gagal menyimpan')
          return
        }
      }
      showSuccess(t('admin.guru.msgBerhasilTambah'))
    }
    showModal.value = false
    confirmClose.value = false
    await Promise.all([refreshGuru(), refreshPendamping()])
  } finally {
    saving.value = false
  }
}

async function handleResetPassword() {
  if (!resetPasswordFor.value) return
  saving.value = true
  errorMsg.value = ''

  try {
    const data = await $fetch(`/api/admin/guru/${resetPasswordFor.value.id}/reset-password`, {
      method: 'POST'
    })
    generatedPassword.value = data.generatedPassword
    showPasswordModal.value = true
    resetPasswordFor.value = null
    showSuccess(t('admin.guru.msgBerhasilReset'))
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal reset password')
  } finally {
    saving.value = false
  }
}

function promptToggle(item: Row) {
  confirmToggle.value = { jenis: item.jenis, id: item.id, nama: item.nama, active: item.isActive }
}

async function handleToggleActive() {
  if (!confirmToggle.value) return
  const { jenis, id, active } = confirmToggle.value
  confirmToggle.value = null
  saving.value = true

  try {
    if (jenis === 'PTK') {
      await $fetch(`/api/admin/guru/${id}/toggle-active`, {
        method: 'PATCH'
      })
    } else {
      await $fetch(`/api/admin/ptk-pendamping/${id}/toggle-active`, {
        method: 'PATCH'
      })
    }
    showSuccess(active ? t('admin.guru.msgBerhasilNonaktif') : t('admin.guru.msgBerhasilAktif'))
    await Promise.all([refreshGuru(), refreshPendamping()])
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal mengubah status')
  } finally {
    saving.value = false
  }
}

function promptResetPassword(item: Row) {
  const guru = guruData.value?.find(g => g.id === item.id)
  if (guru) resetPasswordFor.value = guru
}

function promptDelete(item: Row) {
  confirmDelete.value = { id: item.id, nama: item.nama }
}

async function handleDelete() {
  if (!confirmDelete.value) return
  const { id } = confirmDelete.value
  confirmDelete.value = null
  const { error } = await useFetch(`/api/admin/ptk-pendamping/${id}`, { method: 'DELETE' })
  if (error.value) { showError(error.value.statusMessage || 'Gagal menghapus'); return }
  showSuccess(t('admin.guru.msgBerhasilHapus'))
  await Promise.all([refreshGuru(), refreshPendamping()])
}

async function copyPassword() {
  const ok = await copyToClipboard(generatedPassword.value)
  if (ok) {
    showSuccess(t('admin.guru.msgPasswordTersalin'))
  } else {
    showError(t('admin.guru.msgGagalSalin'))
  }
}
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.guru.title')" :description="t('admin.guru.desc')" />

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <!-- Filter -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" :placeholder="t('admin.guru.searchPlaceholder')"
            class="w-40 sm:w-56 pl-9 pr-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </div>

        <!-- Toggle Nama A-Z -->
        <label class="inline-flex items-center gap-2 cursor-pointer select-none group">
          <button
            type="button"
            role="switch"
            :aria-checked="sortOrder === 'abjad'"
            @click="toggleSort()"
            :class="sortOrder === 'abjad'
              ? 'bg-blue-600 ring-1 ring-blue-300'
              : 'bg-gray-200 dark:bg-slate-600 ring-1 ring-gray-300 dark:ring-slate-500'"
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 focus:outline-none"
            :title="sortOrder === 'abjad' ? t('admin.guru.namaAz') : t('admin.guru.namaAzOff')">
            <span
              :class="sortOrder === 'abjad' ? 'translate-x-[18px]' : 'translate-x-[2px]'"
              class="inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-300 shadow-sm transition-all duration-200" />
          </button>
          <span class="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
            {{ t('admin.guru.namaAz') }}
          </span>
        </label>

        <!-- Toggle Tampilkan Nonaktif -->
        <label class="inline-flex items-center gap-2 cursor-pointer select-none group">
          <button
            type="button"
            role="switch"
            :aria-checked="showInactive"
            @click="showInactive = !showInactive"
            :class="showInactive
              ? 'bg-blue-600 ring-1 ring-blue-300'
              : 'bg-gray-200 dark:bg-slate-600 ring-1 ring-gray-300 dark:ring-slate-500'"
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 focus:outline-none"
            :title="t('admin.guru.tampilkanNonaktif')">
            <span
              :class="showInactive ? 'translate-x-[18px]' : 'translate-x-[2px]'"
              class="inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-300 shadow-sm transition-all duration-200" />
          </button>
          <span class="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
            {{ t('admin.guru.tampilkanNonaktif') }}
          </span>
        </label>
      </div>
      <div class="flex items-center gap-3">
        <button @click="openImport"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 text-xs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="hidden sm:inline">Import Excel</span>
        </button>
        <button @click="openCreate"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 text-xs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">{{ t('admin.guru.tambahPtk') }}</span>
        </button>
      </div>
    </div>

      <!-- Loading skeleton -->
      <div v-if="pending" class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
        <div class="p-4 space-y-4">
          <div v-for="i in 3" :key="i" class="flex items-center gap-4 animate-pulse">
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-40"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-52"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24"></div>
            <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded-lg w-20"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-20 ml-auto"></div>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th class="text-left px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.guru.labelNama') }}</th>
                <th class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden md:table-cell">{{ t('admin.guru.colNip') }}</th>
                <th class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden lg:table-cell">{{ t('admin.guru.colNoHp') }}</th>
                <th class="text-left px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell">{{ t('admin.guru.colEmail') }}</th>
                <th class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.tahunAjaran.colStatus') }}</th>
                <th class="text-center px-4 sm:px-6 py-3.5  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.tahunAjaran.colAksi') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="item in visibleData" :key="item.key"
                class="transition-all duration-150"
                :class="item.isActive
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  : 'bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 border-l-2 border-l-gray-300 dark:border-l-gray-600'">
                <td class="px-4 sm:px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div v-if="item.foto" class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border admin-accent-border">
                      <img :src="item.foto" class="w-full h-full object-cover" :alt="item.nama" />
                    </div>
                    <div v-else class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border admin-accent-border">
                      <img :src="dummyAvatar(item.nama, item.jenisKelamin)" class="w-full h-full object-cover" :alt="item.nama" />
                    </div>
                    <div class="min-w-0">
                      <span class="text-gray-900 dark:text-gray-100" :class="{ 'text-gray-500 dark:text-gray-400': !item.isActive }">
                        {{ item.nama }}
                      </span>
                      <div v-if="item.jenisKelamin" class="text-xs text-gray-400 dark:text-gray-500" :class="{ 'text-gray-300 dark:text-gray-600': !item.isActive }">
                        {{ jenisKelaminLabel(item.jenisKelamin) }}
                      </div>
                      <div v-if="item.jenis === 'PTK'" class="text-xs text-gray-400 dark:text-gray-500 sm:hidden">{{ item.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden md:table-cell">
                  <span class="text-gray-500 dark:text-gray-400" :class="{ 'text-gray-300 dark:text-gray-600': !item.isActive }">
                    {{ item.nip || '-' }}
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden lg:table-cell">
                  <div class="text-gray-500 dark:text-gray-400 text-xs" :class="{ 'text-gray-300 dark:text-gray-600': !item.isActive }">
                    <div>{{ item.nomorHp || '-' }}</div>
                    <div v-if="item.nomorHp2" class="mt-0.5">{{ item.nomorHp2 }}</div>
                  </div>
                </td>
                <td class="px-4 sm:px-6 py-4 hidden sm:table-cell">
                  <span class="text-gray-600 dark:text-gray-300" :class="{ 'text-gray-400 dark:text-gray-500': !item.isActive }">
                    {{ item.email || '-' }}
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="item.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ item.isActive ? t('admin.tahunAjaran.aktif') : t('admin.tahunAjaran.tidakAktif') }}</span>
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4">
                  <div class="flex items-center justify-center gap-1">
                    <!-- Edit -->
                    <button @click="openEdit(item)"
                      class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-150"
                      :title="t('admin.guru.editTitle', { name: item.nama })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    <!-- Reset Password (PTK) -->
                    <button v-if="item.jenis === 'PTK'" @click="promptResetPassword(item)"
                      class="p-2 text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-all duration-150"
                      :title="t('admin.guru.resetPwTitle', { name: item.nama })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>

                    <!-- Toggle Active -->
                    <button @click="promptToggle(item)"
                      :class="item.isActive
                        ? 'p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all duration-150'
                        : 'p-2 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-all duration-150'"
                      :title="item.isActive ? t('admin.guru.nonaktifkanTitle') : t('admin.guru.aktifkanTitle')">
                      <svg v-if="item.isActive" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    <!-- Delete -->
                    <button v-if="item.jenis === 'PENDAMPING'" @click="promptDelete(item)"
                      class="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all duration-150"
                      :title="t('common.hapus')">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Empty state -->
              <tr v-if="rows.length === 0">
                <td colspan="6" class="px-4 sm:px-6 py-16 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <svg class="w-12 h-12 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p class="text-gray-500 dark:text-gray-400 ">
                      {{ emptyMsg }}
                    </p>
                    <button v-if="!showInactive" @click="openCreate"
                      class="inline-flex items-center gap-1 px-4 py-2 text-xs text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      {{ t('admin.tahunAjaran.emptyAction') }}
                    </button>
                  </div>
                </td>
              </tr>

            </tbody>
          </table>
        </div>
        <div v-if="rows.length > pageSize" class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize, rows.length), total: rows.length, unit: t('admin.guru.unitPtk') }) }}
          </p>
          <div class="ml-auto flex items-center gap-2">
            <button
              @click="page--"
              :disabled="page <= 1"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              {{ t('common.selanjutnya') }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

    <!-- Modal Create/Edit -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="handleCloseClick">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="handleCloseClick"></div>

          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-auto overflow-hidden border border-gray-300 dark:border-gray-600">
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg  text-gray-900 dark:text-gray-100">
                {{ editingRow ? t('admin.guru.modalEdit') : t('admin.guru.modalCreate') }}
              </h2>
              <button @click="handleCloseClick"
                class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form @submit.prevent="handleSave" class="p-4 space-y-4">
              <!-- Nama Lengkap -->
              <div>
                <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">
                  {{ t('admin.guru.labelNama') }} <span class="text-red-500">*</span>
                </label>
                <input v-model="form.nama" type="text" @input="onFormChange"
                  :placeholder="t('admin.guru.placeholderNama')"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
              </div>

              <!-- Jenis Kelamin -->
              <div>
                <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">
                  {{ t('admin.guru.labelJenisKelamin') }} <span class="text-red-500">*</span>
                </label>
                <select v-model="form.jenisKelamin" @change="onFormChange" required
                  :class="form.jenisKelamin ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
                  <option value="" disabled>{{ t('admin.guru.pilihJenisKelamin') }}</option>
                  <option value="LAKI_LAKI">{{ t('admin.guru.jenisKelaminL') }}</option>
                  <option value="PEREMPUAN">{{ t('admin.guru.jenisKelaminP') }}</option>
                </select>
              </div>

              <!-- NIP -->
              <div>
                <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">
                  {{ t('admin.guru.labelNip') }} <span class="text-red-500">*</span>
                </label>
                <input v-model="form.nip" type="text" @input="onFormChange" required
                  :placeholder="t('admin.guru.placeholderNip')"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
              </div>

              <!-- Nomor HP -->
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">
                    {{ t('admin.guru.labelNoHp1') }} <span class="text-red-500">*</span>
                  </label>
                  <input v-model="form.nomorHp1" type="text" @input="onFormChange" required
                    :placeholder="t('admin.guru.placeholderHp')"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                </div>
                <div>
                  <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">{{ t('admin.guru.labelNoHp2') }}</label>
                  <input v-model="form.nomorHp2" type="text" @input="onFormChange"
                    :placeholder="t('admin.guru.placeholderHp2')"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                </div>
              </div>

              <!-- Email -->
              <div>
                <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">
                  {{ t('admin.guru.labelEmail') }}
                </label>
                <input v-model="form.email" type="email" @input="onFormChange"
                  :placeholder="t('admin.guru.placeholderEmail')"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                <p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">{{ t('admin.guru.infoLogin') }}</p>
              </div>

              <!-- Info create -->
              <Transition name="fade">
                <div v-if="!editingRow && form.email.trim() !== ''" class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ t('admin.guru.infoPassword') }}</span>
                </div>
              </Transition>

              <!-- Error -->
              <Transition name="fade">
                <div v-if="errorMsg" class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ errorMsg }}</span>
                </div>
              </Transition>

              <!-- Actions -->
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" @click="handleCloseClick"
                  class="px-4 py-2 text-xs  text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                  {{ t('common.batal') }}
                </button>
                <button type="submit" :disabled="saving"
                  class="px-5 py-2 text-xs  text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {{ saving ? t('common.menyimpan') : t('common.simpan') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>

      <!-- Modal Confirm Close -->
      <Transition name="modal">
        <div v-if="confirmClose" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="confirmClose = false"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <h2 class="text-xs  text-gray-900 dark:text-gray-100 mb-2">{{ t('admin.tahunAjaran.confirmCloseTitle') }}</h2>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-5">{{ t('admin.tahunAjaran.confirmCloseMsg') }}</p>
            <div class="flex justify-end gap-3">
              <button @click="confirmClose = false"
                class="px-4 py-2 text-xs  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('admin.tahunAjaran.lanjutkanEdit') }}
              </button>
              <button @click="showModal = false; confirmClose = false"
                class="px-4 py-2 text-xs  text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors">
                {{ t('admin.tahunAjaran.yaBatalkan') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal Show Password -->
      <Transition name="modal">
        <div v-if="showPasswordModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showPasswordModal = false"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h2 class="text-lg  text-gray-900 dark:text-gray-100">{{ t('admin.guru.pwModalTitle') }}</h2>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {{ t('admin.guru.pwModalMsg') }}
            </p>

            <div class="flex items-center gap-2 p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg mb-4">
              <code class="flex-1 text-lg font-mono  text-center text-gray-900 dark:text-gray-100 tracking-wider select-all">
                {{ generatedPassword }}
              </code>
            </div>

            <div class="flex justify-end gap-3">
              <button @click="showPasswordModal = false"
                class="px-4 py-2 text-sm  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('admin.guru.tutup') }}
              </button>
              <button @click="copyPassword"
                class="px-4 py-2 text-sm  text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 inline-flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {{ t('admin.guru.salinPassword') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal Confirm Toggle Active -->
      <Transition name="modal">
        <div v-if="confirmToggle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="confirmToggle = null"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <div class="flex items-center gap-3 mb-4">
              <div :class="confirmToggle.active ? 'p-2 bg-red-100 dark:bg-red-900/30 rounded-lg' : 'p-2 bg-green-100 dark:bg-green-900/30 rounded-lg'">
                <svg v-if="confirmToggle.active" class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <svg v-else class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg  text-gray-900 dark:text-gray-100">
                  {{ confirmToggle.active ? t('admin.guru.toggleTitleNonaktif') : t('admin.guru.toggleTitleAktif') }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ confirmToggle.nama }}</p>
              </div>
            </div>

            <p v-if="confirmToggle.active" class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {{ t('admin.guru.toggleMsgNonaktif') }}
            </p>
            <p v-else class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {{ t('admin.guru.toggleMsgAktif') }}
            </p>

            <div class="flex justify-end gap-3">
              <button @click="confirmToggle = null"
                class="px-4 py-2 text-sm  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.batal') }}
              </button>
              <button @click="handleToggleActive"
                :class="confirmToggle.active
                  ? 'px-4 py-2 text-sm  text-white bg-red-600 rounded-md hover:bg-red-700'
                  : 'px-4 py-2 text-sm  text-white bg-green-600 rounded-md hover:bg-green-700'">
                {{ confirmToggle.active ? t('admin.guru.yaNonaktifkan') : t('common.yaAktifkan') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal Confirm Delete -->
      <Transition name="modal">
        <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="confirmDelete = null"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg  text-gray-900 dark:text-gray-100">{{ t('admin.guru.confirmDeleteTitle') }}</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ confirmDelete.nama }}</p>
              </div>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-5">
              {{ t('admin.guru.confirmDeleteMsg', { nama: confirmDelete.nama }) }}
            </p>

            <div class="flex justify-end gap-3">
              <button @click="confirmDelete = null"
                class="px-4 py-2 text-sm  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.batal') }}
              </button>
              <button @click="handleDelete" :disabled="saving"
                class="px-4 py-2 text-sm  text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                {{ t('common.yaHapus') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal Confirm Reset Password -->
      <Transition name="modal">
        <div v-if="resetPasswordFor" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="resetPasswordFor = null"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg  text-gray-900 dark:text-gray-100">{{ t('admin.guru.resetTitle') }}</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ resetPasswordFor.nama }}</p>
              </div>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400 mb-5">
              {{ t('admin.guru.resetMsg') }}
            </p>

            <div class="flex justify-end gap-3">
              <button @click="resetPasswordFor = null"
                class="px-4 py-2 text-sm  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.batal') }}
              </button>
              <button @click="handleResetPassword"
                class="px-4 py-2 text-sm  text-white bg-amber-600 rounded-md hover:bg-amber-700 active:bg-amber-800">
                {{ t('admin.guru.yaReset') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <!-- Modal Import Excel -->
      <Transition name="fade">
        <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeImportModal"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl mx-auto overflow-hidden border border-gray-300 dark:border-gray-600 max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg text-gray-900 dark:text-gray-100">{{ t('admin.guru.importTitle') }}</h2>
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
                  <p class="text-xs font-medium text-blue-700 dark:text-blue-300">{{ t('admin.guru.belumPunyaTemplate') }}</p>
                  <p class="text-xs text-blue-600 dark:text-blue-400">{{ t('admin.guru.templateHint') }}</p>
                </div>
                <a href="/api/admin/guru/template-export" download class="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {{ t('admin.guru.downloadTemplate') }}
                </a>
              </div>

              <!-- File Upload Area -->
              <div v-if="!importPreview.length && !importResult" class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <input type="file" accept=".xlsx,.xls,.csv" @change="handleFileChange" class="hidden" id="ptk-import-file" />
                <label for="ptk-import-file" class="cursor-pointer inline-flex flex-col items-center gap-3">
                  <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('admin.guru.importBtn') }}</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('admin.guru.requiredCols') }}</span>
                </label>
              </div>

              <!-- Preview Table -->
              <div v-if="importPreview.length > 0 && !importResult" class="space-y-3">
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('admin.guru.previewRows', { count: importPreview.length }) }}</p>
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
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ t('admin.guru.importSuccess') }}</span>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    {{ t('admin.guru.resultSuccess') }}: <span class="font-medium text-green-600">{{ importResult.success }}</span> |
                    {{ t('admin.guru.resultFailed') }}: <span class="font-medium text-red-600">{{ importResult.failed }}</span> |
                    {{ t('admin.guru.resultTotal') }}: {{ importResult.success + importResult.failed }}
                  </p>
                </div>

                <div v-if="importResult.errors.length > 0" class="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                  <div class="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b border-red-200 dark:border-red-800">
                    <p class="text-xs font-medium text-red-700 dark:text-red-400">{{ t('admin.guru.detailError') }}:</p>
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
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 12 12h4z" />
                 </svg>
                 {{ importSubmitting ? t('common.menyimpan') : t('admin.guru.importBtn') }}
               </button>
            </div>
            <div v-else class="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button type="button" @click="closeImportModal"
                class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.tutup') }}
              </button>
              <button type="button" @click="openImport"
                class="px-5 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800">
                {{ t('admin.guru.importLagi') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
</template>

<style scoped>
.modal-enter-active {
  transition: all 0.2s ease-out;
}
.modal-leave-active {
  transition: all 0.15s ease-in;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
}
.modal-enter-from > div:first-child,
.modal-leave-to > div:first-child {
  opacity: 0;
}
.slide-enter-active {
  transition: all 0.3s ease-out;
}
.slide-leave-active {
  transition: all 0.2s ease-in;
}
.slide-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}
.slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
