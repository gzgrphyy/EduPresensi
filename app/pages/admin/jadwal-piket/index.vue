<script setup lang="ts">
interface PetugasPiket {
  id: number
  nama: string
  email: string
  nip: string | null
  foto: string | null
  isActive: boolean
}

interface JadwalPiket {
  id: number
  petugasPiketId: number
  hari: string
  jamMulai: string
  jamSelesai: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  petugasPiket: PetugasPiket
}

const { t } = useI18n()

const showInactive = ref(false)
const searchQuery = ref('')
const filterHari = ref('')
const page = ref(1)
const pageSize = 15

const HARI_LIST = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU']

const params = computed(() => {
  const p = new URLSearchParams()
  if (showInactive.value) p.set('showInactive', 'true')
  if (searchQuery.value) p.set('search', searchQuery.value)
  if (filterHari.value) p.set('hari', filterHari.value)
  return p.toString()
})

const { data: jadwalData, pending, refresh } = useFetch<JadwalPiket[]>(() => `/api/admin/jadwal-piket?${params.value}`, { immediate: true })

const { data: petugasList, refresh: refreshPetugas } = useFetch<any[]>('/api/admin/jadwal-piket?available=true', { immediate: true })

const sortedData = computed(() => {
  return jadwalData.value || []
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedData.value.length / pageSize)))

const visibleData = computed(() => {
  const start = (page.value - 1) * pageSize
  return sortedData.value.slice(start, start + pageSize)
})

watch([showInactive, searchQuery, filterHari], () => { page.value = 1 })

function hariLabel(hari: string) {
  return t(`hari.${hari}` as any)
}

const showModal = ref(false)
const editingItem = ref<JadwalPiket | null>(null)
const form = ref({ petugasPiketId: '', hari: '', jamMulai: '07:00', jamSelesai: '15:00' })
const saving = ref(false)
const confirmToggle = ref<{ id: number; nama: string; active: boolean } | null>(null)
const confirmDelete = ref<{ id: number; nama: string } | null>(null)
const errorMsg = ref('')
const successMsg = ref('')

function showError(msg: string) {
  errorMsg.value = msg
  setTimeout(() => { errorMsg.value = '' }, 5000)
}

function showSuccess(msg: string) {
  successMsg.value = msg
  setTimeout(() => { successMsg.value = '' }, 3000)
}

function openCreate() {
  editingItem.value = null
  form.value = { petugasPiketId: '', hari: '', jamMulai: '07:00', jamSelesai: '15:00' }
  errorMsg.value = ''
  successMsg.value = ''
  refreshPetugas()
  showModal.value = true
}

function openEdit(item: JadwalPiket) {
  editingItem.value = item
  form.value = {
    petugasPiketId: String(item.petugasPiketId),
    hari: item.hari,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai
  }
  errorMsg.value = ''
  successMsg.value = ''
  refreshPetugas()
  showModal.value = true
}

async function handleSave() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''

  if (!editingItem.value && !form.value.petugasPiketId) { showError('Petugas piket wajib dipilih'); saving.value = false; return }
  if (!form.value.hari) { showError('Hari wajib dipilih'); saving.value = false; return }
  if (!form.value.jamMulai || !form.value.jamSelesai) { showError('Jam mulai dan selesai wajib diisi'); saving.value = false; return }
  if (form.value.jamMulai >= form.value.jamSelesai) { showError('Jam mulai harus sebelum jam selesai'); saving.value = false; return }

  try {
    const body: Record<string, any> = {
      hari: form.value.hari,
      jamMulai: form.value.jamMulai,
      jamSelesai: form.value.jamSelesai
    }
    if (!editingItem.value) {
      body.petugasPiketId = parseInt(form.value.petugasPiketId)
    }

    if (editingItem.value) {
      const { error } = await useFetch(`/api/admin/jadwal-piket/${editingItem.value.id}`, {
        method: 'PATCH',
        body
      })
      if (error.value) {
        showError(error.value.statusMessage || 'Gagal menyimpan')
        return
      }
      showSuccess(t('admin.jadwalPiket.msgBerhasilEdit'))
    } else {
      const { error } = await useFetch('/api/admin/jadwal-piket', {
        method: 'POST',
        body
      })
      if (error.value) {
        showError(error.value.statusMessage || 'Gagal menyimpan')
        return
      }
      showSuccess(t('admin.jadwalPiket.msgBerhasilTambah'))
    }
    showModal.value = false
    await refresh()
    await refreshPetugas()
  } finally {
    saving.value = false
  }
}

function promptToggle(item: JadwalPiket) {
  confirmToggle.value = { id: item.id, nama: `${item.petugasPiket.nama} - ${hariLabel(item.hari)} ${item.jamMulai}-${item.jamSelesai}`, active: item.isActive }
}

async function handleToggleActive() {
  if (!confirmToggle.value) return
  const { id, active } = confirmToggle.value
  confirmToggle.value = null
  saving.value = true

  try {
    await $fetch(`/api/admin/jadwal-piket/${id}/toggle-active`, { method: 'PATCH' })
    showSuccess(active ? t('admin.jadwalPiket.msgBerhasilNonaktif') : t('admin.jadwalPiket.msgBerhasilAktif'))
    await refresh()
  } catch (err: any) {
    showError(err?.data?.statusMessage || 'Gagal mengubah status')
  } finally {
    saving.value = false
  }
}

function promptDelete(item: JadwalPiket) {
  confirmDelete.value = { id: item.id, nama: `${item.petugasPiket.nama} - ${hariLabel(item.hari)} ${item.jamMulai}-${item.jamSelesai}` }
}

async function handleDelete() {
  if (!confirmDelete.value) return
  const { id } = confirmDelete.value
  confirmDelete.value = null
  const { error } = await useFetch(`/api/admin/jadwal-piket/${id}`, { method: 'DELETE' })
  if (error.value) { showError(error.value.statusMessage || 'Gagal menghapus'); return }
  showSuccess(t('admin.jadwalPiket.msgBerhasilHapus'))
  await refresh()
}

function pageNumbers(): (number | '...')[] {
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
}
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.jadwalPiket.title')" :description="t('admin.jadwalPiket.desc')" />

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <!-- Filter -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" :placeholder="t('admin.jadwalPiket.searchPlaceholder')"
            class="w-40 sm:w-56 pl-9 pr-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </div>

        <select v-model="filterHari"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Semua Hari</option>
          <option v-for="h in HARI_LIST" :key="h" :value="h">{{ hariLabel(h) }}</option>
        </select>

        <label class="inline-flex items-center gap-2 cursor-pointer select-none group">
          <button type="button" role="switch" :aria-checked="showInactive" @click="showInactive = !showInactive"
            :class="showInactive ? 'bg-blue-600 ring-1 ring-blue-300' : 'bg-gray-200 dark:bg-slate-600 ring-1 ring-gray-300 dark:ring-slate-500'"
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 focus:outline-none">
            <span :class="showInactive ? 'translate-x-[18px]' : 'translate-x-[2px]'"
              class="inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-300 shadow-sm transition-all duration-200" />
          </button>
          <span class="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
            {{ t('admin.jadwalPiket.tampilkanNonaktif') }}
          </span>
        </label>
      </div>
      <button @click="openCreate"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 text-xs">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="hidden sm:inline">{{ t('admin.jadwalPiket.tambahJadwal') }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
      <div class="p-4 space-y-4">
        <div v-for="i in 3" :key="i" class="flex items-center gap-4 animate-pulse">
          <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32"></div>
          <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24"></div>
          <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32"></div>
          <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded-lg w-16"></div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
              <th class="text-left px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider">Petugas Piket</th>
              <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider">Hari</th>
              <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider">Jam</th>
              <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider">Status</th>
              <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y admin-accent-divide">
            <tr v-for="item in visibleData" :key="item.id"
              class="transition-all duration-150"
              :class="item.isActive ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30' : 'bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100/50 dark:hover:bg-gray-700/50 border-l-2 border-l-gray-300 dark:border-l-gray-600'">
              <td class="px-4 sm:px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border admin-accent-border">
                    <img :src="item.petugasPiket.foto || '/images/avatars/laki-1.svg'" class="w-full h-full object-cover" :alt="item.petugasPiket.nama" />
                  </div>
                  <div class="min-w-0">
                    <span class="text-gray-900 dark:text-gray-100 font-medium">{{ item.petugasPiket.nama }}</span>
                    <div class="text-[11px] text-gray-400 dark:text-gray-500">{{ item.petugasPiket.email }}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 sm:px-6 py-4 text-center">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                  {{ hariLabel(item.hari) }}
                </span>
              </td>
              <td class="px-4 sm:px-6 py-4 text-center">
                <span class="text-gray-600 dark:text-gray-300 font-mono text-[11px]">
                  {{ item.jamMulai }} – {{ item.jamSelesai }}
                </span>
              </td>
              <td class="px-4 sm:px-6 py-4 text-center">
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="item.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                  <span class="text-xs text-gray-600 dark:text-gray-400">{{ item.isActive ? 'Aktif' : 'Nonaktif' }}</span>
                </span>
              </td>
              <td class="px-4 sm:px-6 py-4">
                <div class="flex items-center justify-center gap-1">
                  <button @click="openEdit(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-150"
                    title="Edit">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button @click="promptToggle(item)"
                    :class="item.isActive ? 'p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all duration-150' : 'p-2 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-all duration-150'"
                    :title="item.isActive ? 'Nonaktifkan' : 'Aktifkan'">
                    <svg v-if="item.isActive" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button @click="promptDelete(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-all duration-150"
                    title="Hapus">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="sortedData.length === 0">
              <td colspan="5" class="px-4 sm:px-6 py-16 text-center">
                <div class="flex flex-col items-center gap-3">
                  <svg class="w-12 h-12 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p class="text-gray-500 dark:text-gray-400">
                    {{ showInactive ? t('admin.jadwalPiket.emptyInactive') : t('admin.jadwalPiket.empty') }}
                  </p>
                  <button v-if="!showInactive" @click="openCreate"
                    class="inline-flex items-center gap-1 px-4 py-2 text-xs text-blue-600 dark:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    {{ t('common.tambah') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="sortedData.length > pageSize" class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize, sortedData.length), total: sortedData.length, unit: t('admin.jadwalPiket.unitJadwal') }) }}
        </p>
        <div class="ml-auto flex items-center gap-2">
          <button @click="page--" :disabled="page <= 1"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ t('common.sebelumnya') }}
          </button>
          <div class="flex items-center gap-1">
            <template v-for="(n, i) in pageNumbers()" :key="i">
              <button v-if="n !== '...'" @click="page = n" :disabled="n === page"
                :class="n === page ? 'w-7 h-7 rounded-md text-xs text-white bg-primary-600 ring-1 ring-primary-600 cursor-default' : 'w-7 h-7 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors'">
                {{ n }}
              </button>
              <span v-else class="px-0.5 text-xs text-gray-400 dark:text-gray-500 select-none">&hellip;</span>
            </template>
          </div>
          <button @click="page++" :disabled="page >= totalPages"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ t('common.selanjutnya') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Create/Edit -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="showModal = false">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="showModal = false"></div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-auto overflow-hidden border border-gray-300 dark:border-gray-600">
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg text-gray-900 dark:text-gray-100">
                {{ editingItem ? t('admin.jadwalPiket.modalEdit') : t('admin.jadwalPiket.modalCreate') }}
              </h2>
              <button @click="showModal = false" class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form @submit.prevent="handleSave" class="p-4 space-y-4">
              <div v-if="!editingItem">
                <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">
                  {{ t('admin.jadwalPiket.labelPetugasPiket') }} <span class="text-red-500">*</span>
                </label>
                <select v-model="form.petugasPiketId" required
                  :class="form.petugasPiketId ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
                  <option value="" disabled>{{ t('admin.jadwalPiket.pilihPetugas') }}</option>
                  <option v-for="p in (petugasList || [])" :key="p.id" :value="String(p.id)">
                    {{ p.nama }}{{ p.nip ? ` (${p.nip})` : '' }}
                  </option>
                  <option v-if="!petugasList || petugasList.length === 0" disabled value="">
                    Tidak ada PTK tersedia
                  </option>
                </select>
              </div>

              <div v-if="editingItem">
                <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">Petugas Piket</label>
                <div class="w-full px-3.5 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-xs bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400">
                  {{ editingItem.petugasPiket.nama }}{{ editingItem.petugasPiket.nip ? ` (${editingItem.petugasPiket.nip})` : '' }}
                </div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Untuk mengganti petugas piket, hapus jadwal ini lalu buat baru.</p>
              </div>

              <div>
                <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">
                  {{ t('admin.jadwalPiket.labelHari') }} <span class="text-red-500">*</span>
                </label>
                <select v-model="form.hari" required
                  :class="form.hari ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
                  class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
                  <option value="" disabled>{{ t('admin.jadwalPiket.pilihHari') }}</option>
                  <option v-for="h in HARI_LIST" :key="h" :value="h">{{ hariLabel(h) }}</option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">
                    {{ t('admin.jadwalPiket.labelJamMulai') }} <span class="text-red-500">*</span>
                  </label>
                  <input v-model="form.jamMulai" type="time" required
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" />
                </div>
                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">
                    {{ t('admin.jadwalPiket.labelJamSelesai') }} <span class="text-red-500">*</span>
                  </label>
                  <input v-model="form.jamSelesai" type="time" required
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" />
                </div>
              </div>

              <Transition name="fade">
                <div v-if="errorMsg" class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ errorMsg }}</span>
                </div>
              </Transition>

              <div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" @click="showModal = false"
                  class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                  {{ t('common.batal') }}
                </button>
                <button type="submit" :disabled="saving"
                  class="px-5 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
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
                <h2 class="text-lg text-gray-900 dark:text-gray-100">
                  {{ confirmToggle.active ? t('admin.jadwalPiket.toggleTitleNonaktif') : t('admin.jadwalPiket.toggleTitleAktif') }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ confirmToggle.nama }}</p>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {{ confirmToggle.active ? t('admin.jadwalPiket.toggleMsgNonaktif') : t('admin.jadwalPiket.toggleMsgAktif') }}
            </p>
            <div class="flex justify-end gap-3">
              <button @click="confirmToggle = null" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.batal') }}
              </button>
              <button @click="handleToggleActive"
                :class="confirmToggle.active ? 'px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700' : 'px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700'">
                {{ confirmToggle.active ? t('admin.jadwalPiket.yaNonaktifkan') : t('common.yaAktifkan') }}
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
                <h2 class="text-lg text-gray-900 dark:text-gray-100">{{ t('admin.jadwalPiket.confirmDeleteTitle') }}</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ confirmDelete.nama }}</p>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-5">{{ t('admin.jadwalPiket.confirmDeleteMsg') }}</p>
            <div class="flex justify-end gap-3">
              <button @click="confirmDelete = null" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.batal') }}
              </button>
              <button @click="handleDelete" :disabled="saving" class="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                {{ t('common.yaHapus') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </AppLayout>
</template>
