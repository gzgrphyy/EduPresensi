<script setup lang="ts">
  interface TahunAjaranItem {
    id: number
    nama: string
    kodeAngka: number | null
    pakaiRomawi: boolean
    isActive: boolean
    tanggalMulai: string | null
    tanggalAkhir: string | null
    deletedAt: string | null
    createdAt: string
    updatedAt: string
    _count: { semester: number }
  }

  interface SemesterItem {
    id: number
    tahunAjaranId: number
    nama: 'GANJIL' | 'GENAP'
    kodeAngka: number | null
    pakaiRomawi: boolean
    isActive: boolean
    tanggalMulai: string | null
    tanggalAkhir: string | null
    deletedAt: string | null
    createdAt: string
    updatedAt: string
    tahunAjaran: { id: number; nama: string; isActive: boolean }
    _count: { kelas: number }
  }

  type Editing = { type: 'semester'; item: SemesterItem } | { type: 'tahun'; item: TahunAjaranItem } | null

  const { t } = useI18n()

  const activeTab = ref<'data' | 'absensi'>('data')
  const { pengaturan, fetch: fetchPengaturan } = usePengaturan()

  const savingPengaturan = ref(false)
  const successMsgPengaturan = ref('')
  const errorMsgPengaturan = ref('')

  onMounted(() => {
    fetchPengaturan()
  })

  const { data: semesterData, pending: pendingSemester, refresh: refreshSemester } = useFetch<SemesterItem[]>('/api/admin/semester', {
    immediate: true
  })

  const { data: tahunData, pending: pendingTahun, refresh: refreshTahun } = useFetch<TahunAjaranItem[]>('/api/admin/tahun-ajaran', {
    immediate: true
  })

  const { data: tahunList } = useFetch<TahunAjaranItem[]>('/api/admin/tahun-ajaran', {
    immediate: true
  })

  const showModal = ref(false)
  const editing = ref<Editing>(null)
  const form = ref({
    nama: '',
    kodeAngka: '',
    pakaiRomawi: false,
    setActive: false,
    tanggalMulai: '',
    tanggalAkhir: ''
  })
  const saving = ref(false)
  const confirmToggle = ref<{ id: number; nama: string } | null>(null)
  const confirmDelete = ref<{ id: number; nama: string; count: number } | null>(null)
  const confirmClose = ref<boolean>(false)
  const errorMsg = ref('')
  const successMsg = ref('')
  const dirtyForm = ref(false)

  const isTabTahunAjaran = computed(() => activeTab.value === 'absensi')

  const semesterLabel = (s: 'GANJIL' | 'GENAP') => s === 'GANJIL' ? t('semester.ganjil') : t('semester.genap')

  const tahunUrut = computed(() => {
    const sorted = [...(tahunData.value || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const map = new Map<number, number>()
    sorted.forEach((item, i) => map.set(item.id, i + 1))
    return map
  })

  const modalTitle = computed(() => {
    if (editing.value) {
      return isTabTahunAjaran.value ? t('admin.tahunAjaran.modalEditTahunAjaran') : t('admin.tahunAjaran.modalEdit')
    }
    return isTabTahunAjaran.value ? t('admin.tahunAjaran.modalCreateTahunAjaran') : t('admin.tahunAjaran.modalCreate')
  })

  const editingHasKelas = computed(() => {
    if (!editing.value) return false
    return editing.value.type === 'semester' ? editing.value.item._count.kelas > 0 : editing.value.item._count.semester > 0
  })

  function openCreate() {
    editing.value = null
    form.value = { nama: '', kodeAngka: '', pakaiRomawi: false, setActive: false, tanggalMulai: '', tanggalAkhir: '' }
    errorMsg.value = ''
    successMsg.value = ''
    dirtyForm.value = false
    showModal.value = true
  }

  function openEditSemester(item: SemesterItem) {
    editing.value = { type: 'semester', item }
    form.value = {
      nama: item.nama === 'GANJIL' ? 'Ganjil' : 'Genap',
      kodeAngka: String(item.kodeAngka ?? (item.nama === 'GANJIL' ? 1 : 2)),
      pakaiRomawi: item.pakaiRomawi,
      setActive: false,
      tanggalMulai: item.tanggalMulai ? item.tanggalMulai.substring(0, 10) : '',
      tanggalAkhir: item.tanggalAkhir ? item.tanggalAkhir.substring(0, 10) : ''
    }
    errorMsg.value = ''
    successMsg.value = ''
    dirtyForm.value = false
    showModal.value = true
  }

  function openEditTahun(item: TahunAjaranItem) {
    editing.value = { type: 'tahun', item }
    form.value = {
      nama: item.nama,
      kodeAngka: String(item.kodeAngka ?? ''),
      pakaiRomawi: item.pakaiRomawi,
      setActive: false,
      tanggalMulai: item.tanggalMulai ? item.tanggalMulai.substring(0, 10) : '',
      tanggalAkhir: item.tanggalAkhir ? item.tanggalAkhir.substring(0, 10) : ''
    }
    errorMsg.value = ''
    successMsg.value = ''
    dirtyForm.value = false
    showModal.value = true
  }

  function onFormChange() {
    dirtyForm.value = true
  }

  function onTahunAjaranInput(e: Event) {
    const target = e.target as HTMLInputElement
    target.value = target.value.replace(/[^\d/]/g, '')
    form.value.nama = target.value
  }

  function onTahunKodeAngkaInput(e: Event) {
    const target = e.target as HTMLInputElement
    const cleaned = target.value.replace(/[^0-9]/g, '').slice(0, 4)
    form.value.kodeAngka = cleaned
    target.value = cleaned
  }

  const normalizeSemester = (v: string): 'GANJIL' | 'GENAP' | null => {
    const s = v.trim().toLowerCase()
    if (s === 'ganjil' || s === '1') return 'GANJIL'
    if (s === 'genap' || s === '2') return 'GENAP'
    return null
  }

  const codeFromName = (v: string): string => {
    const n = normalizeSemester(v)
    return n === 'GANJIL' ? '1' : n === 'GENAP' ? '2' : ''
  }

  const displayAngka = (item: SemesterItem): string => semesterDisplayAngka(item)

  const displayAngkaTahun = (item: TahunAjaranItem): string => {
    const angka = item.kodeAngka ?? tahunUrut.value.get(item.id) ?? 0
    return item.pakaiRomawi ? toRoman(angka) : String(angka)
  }

  const formAngkaPreview = computed(() => {
    const num = parseInt(form.value.kodeAngka, 10)
    if (!num || num < 1) return ''
    return form.value.pakaiRomawi ? toRoman(num) : String(num)
  })

  const formAngkaParitasInvalid = computed(() => {
    if (!form.value.nama.trim() || !form.value.kodeAngka.trim()) return false
    const num = parseInt(form.value.kodeAngka, 10)
    if (!num || num < 1) return false
    const jenis = normalizeSemester(form.value.nama)
    if (!jenis) return false
    return jenis === 'GANJIL' ? num % 2 === 0 : num % 2 !== 0
  })

  function onNamaSemesterInput(e: Event) {
    const target = e.target as HTMLInputElement
    target.value = target.value.replace(/[^A-Za-z ]/g, '')
    form.value.nama = target.value
    form.value.kodeAngka = codeFromName(target.value)
  }

  function onKodeAngkaInput(e: Event) {
    const target = e.target as HTMLInputElement
    const cleaned = target.value.replace(/[^0-9]/g, '').slice(0, 2)
    const jenis = normalizeSemester(form.value.nama)
    if (cleaned && jenis) {
      const num = parseInt(cleaned, 10)
      if (num === 0 || (jenis === 'GANJIL' ? num % 2 === 0 : num % 2 !== 0)) {
        target.value = form.value.kodeAngka
        return
      }
    }
    form.value.kodeAngka = cleaned
    target.value = cleaned
  }

  function handleCloseClick() {
    if (dirtyForm.value) {
      confirmClose.value = true
    } else {
      showModal.value = false
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

  async function handleSave() {
    saving.value = true
    errorMsg.value = ''
    successMsg.value = ''
    let parsedKode = 0

    if (isTabTahunAjaran.value) {
      if (!form.value.nama.trim()) {
        showError(t('admin.tahunAjaran.labelTahunAjaran') + ' wajib diisi')
        saving.value = false
        return
      }
      parsedKode = parseInt(form.value.kodeAngka, 10)
      if (!form.value.kodeAngka.trim() || isNaN(parsedKode) || parsedKode < 1) {
        showError(t('admin.tahunAjaran.errKodeAngkaInvalid'))
        saving.value = false
        return
      }
    } else {
      if (!form.value.nama.trim()) {
        showError(t('admin.tahunAjaran.labelNamaSemester') + ' wajib diisi')
        saving.value = false
        return
      }
      const jenis = normalizeSemester(form.value.nama)
      if (!jenis) {
        showError(t('admin.tahunAjaran.errJenisSemesterInvalid'))
        saving.value = false
        return
      }
      parsedKode = parseInt(form.value.kodeAngka, 10)
      if (!form.value.kodeAngka.trim() || isNaN(parsedKode) || parsedKode < 1) {
        showError(t('admin.tahunAjaran.errKodeAngkaInvalid'))
        saving.value = false
        return
      }
      if (jenis === 'GANJIL' && parsedKode % 2 === 0) {
        showError(t('admin.tahunAjaran.errKodeAngkaGanjil'))
        saving.value = false
        return
      }
      if (jenis === 'GENAP' && parsedKode % 2 !== 0) {
        showError(t('admin.tahunAjaran.errKodeAngkaGenap'))
        saving.value = false
        return
      }
    }

    try {
      if (isTabTahunAjaran.value) {
        if (editing.value && editing.value.type === 'tahun') {
          const body: Record<string, unknown> = {}
          if (!editing.value.item._count.semester) {
            body.nama = form.value.nama
          }
          if (form.value.setActive) {
            body.isActive = true
          }
          body.kodeAngka = parsedKode
          body.pakaiRomawi = form.value.pakaiRomawi
          body.tanggalMulai = form.value.tanggalMulai || null
          body.tanggalAkhir = form.value.tanggalAkhir || null
          if (Object.keys(body).length === 0) {
            showModal.value = false
            return
          }
          const { error } = await useFetch(`/api/admin/tahun-ajaran/${editing.value.item.id}`, {
            method: 'PATCH',
            body
          })
          if (error.value) {
            showError(error.value.statusMessage || 'Gagal menyimpan')
            return
          }
          showSuccess(t('admin.tahunAjaran.msgBerhasilEdit'))
        } else {
          const { error } = await useFetch('/api/admin/tahun-ajaran', {
            method: 'POST',
            body: {
              nama: form.value.nama,
              kodeAngka: parsedKode,
              pakaiRomawi: form.value.pakaiRomawi,
              setActive: form.value.setActive,
              tanggalMulai: form.value.tanggalMulai || null,
              tanggalAkhir: form.value.tanggalAkhir || null
            }
          })
          if (error.value) {
            showError(error.value.statusMessage || 'Gagal menyimpan')
            return
          }
          showSuccess(t('admin.tahunAjaran.msgBerhasilTambah'))
        }
        showModal.value = false
        await refreshTahun()
        await refreshSemester()
      } else {
        const normalized = normalizeSemester(form.value.nama)!
        if (editing.value && editing.value.type === 'semester') {
          const body: Record<string, unknown> = {}
          if (!editing.value.item._count.kelas && normalized !== editing.value.item.nama) {
            body.nama = normalized
          }
          body.kodeAngka = parsedKode
          body.pakaiRomawi = form.value.pakaiRomawi
          body.tanggalMulai = form.value.tanggalMulai || null
          body.tanggalAkhir = form.value.tanggalAkhir || null
          if (Object.keys(body).length === 0) {
            showModal.value = false
            return
          }
          const { error } = await useFetch(`/api/admin/semester/${editing.value.item.id}`, {
            method: 'PATCH',
            body
          })
          if (error.value) {
            showError(error.value.statusMessage || 'Gagal menyimpan')
            return
          }
          showSuccess(t('admin.tahunAjaran.msgBerhasilEditSemester'))
        } else {
          const activeTahun = tahunList.value?.find(t => t.isActive)
          if (!activeTahun) {
            showError(t('admin.tahunAjaran.errTidakAdaTahunAktif'))
            saving.value = false
            return
          }
          const { error } = await useFetch('/api/admin/semester', {
            method: 'POST',
            body: {
              nama: normalized,
              kodeAngka: parsedKode,
              pakaiRomawi: form.value.pakaiRomawi,
              setActive: false,
              tanggalMulai: form.value.tanggalMulai || null,
              tanggalAkhir: form.value.tanggalAkhir || null
            }
          })
          if (error.value) {
            showError(error.value.statusMessage || 'Gagal menyimpan')
            return
          }
          showSuccess(t('admin.tahunAjaran.msgBerhasilTambahSemester'))
        }
        showModal.value = false
        await refreshSemester()
      }
    } finally {
      saving.value = false
    }
  }

  async function handleToggle() {
    if (!confirmToggle.value) return
    const { id } = confirmToggle.value
    confirmToggle.value = null

    const url = isTabTahunAjaran.value ? `/api/admin/tahun-ajaran/${id}` : `/api/admin/semester/${id}`
    const { error } = await useFetch(url, {
      method: 'PATCH',
      body: { isActive: true }
    })
    if (error.value) {
      showError(error.value.statusMessage || 'Gagal mengubah status')
      return
    }
    showSuccess(isTabTahunAjaran.value
      ? t('admin.tahunAjaran.msgBerhasilPindahAktif')
      : t('admin.tahunAjaran.msgBerhasilPindahAktifSemester'))
    await refreshTahun()
    await refreshSemester()
  }

  async function handleDelete() {
    if (!confirmDelete.value) return
    const { id } = confirmDelete.value
    confirmDelete.value = null

    const url = isTabTahunAjaran.value ? `/api/admin/tahun-ajaran/${id}` : `/api/admin/semester/${id}`
    const { error } = await useFetch(url, {
      method: 'DELETE'
    })
    if (error.value) {
      showError(error.value.statusMessage || 'Gagal menghapus')
      return
    }
    showSuccess(isTabTahunAjaran.value
      ? t('admin.tahunAjaran.msgBerhasilHapus')
      : t('admin.tahunAjaran.msgBerhasilHapusSemester'))
    await refreshTahun()
    await refreshSemester()
  }

  function promptToggleSemester(item: SemesterItem) {
    confirmToggle.value = { id: item.id, nama: semesterFullLabel(item, t) }
  }

  function promptDeleteSemester(item: SemesterItem) {
    confirmDelete.value = { id: item.id, nama: semesterFullLabel(item, t), count: item._count.kelas }
  }

  function promptToggleTahun(item: TahunAjaranItem) {
    confirmToggle.value = { id: item.id, nama: item.nama }
  }

  function promptDeleteTahun(item: TahunAjaranItem) {
    confirmDelete.value = { id: item.id, nama: item.nama, count: item._count.semester }
  }

  const formatDate = (v: string | null) => v
    ? new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-'
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.tahunAjaran.title')" :description="t('admin.tahunAjaran.desc')" />

    <Notification type="error" :message="errorMsgPengaturan" :show="!!errorMsgPengaturan"
      @dismiss="errorMsgPengaturan = ''" />
    <Notification type="success" :message="successMsgPengaturan" :show="!!successMsgPengaturan"
      @dismiss="successMsgPengaturan = ''" />

    <div class="flex gap-6 border-b admin-accent-border mb-5"
      :style="{ '--tab-accent': pengaturan?.warnaUtama || '#0A66A0' }">
      <button @click="activeTab = 'data'" class="py-2.5 text-[12px] font-medium transition-colors"
        :class="activeTab === 'data' ? 'text-[var(--tab-accent)]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'">
        <span
          class="relative inline-block after:absolute after:-bottom-2.5 after:left-0 after:h-0.5 after:rounded-full after:bg-[var(--tab-accent)] after:transition-all"
          :class="activeTab === 'data' ? 'after:w-full' : 'after:w-0 hover:after:w-full'">
          {{ t('admin.tahunAjaran.tabData') }}
        </span>
      </button>

      <button @click="activeTab = 'absensi'" class="py-2.5 text-[12px] font-medium transition-colors"
        :class="activeTab === 'absensi' ? 'text-[var(--tab-accent)]' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'">
        <span
          class="relative inline-block after:absolute after:-bottom-2.5 after:left-0 after:h-0.5 after:rounded-full after:bg-[var(--tab-accent)] after:transition-all"
          :class="activeTab === 'absensi' ? 'after:w-full' : 'after:w-0 hover:after:w-full'">
          {{ t('admin.tahunAjaran.tabTahunAjaran') }}
        </span>
      </button>
    </div>

    <!-- Tab: Semester -->
    <div v-show="activeTab === 'data'">
      <div class="flex flex-wrap items-center justify-end gap-3 mb-4">
        <button @click="openCreate"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs ">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">{{ t('admin.tahunAjaran.tambahAjaran') }}</span>
        </button>
      </div>

      <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
      <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

      <!-- Loading skeleton -->
      <div v-if="pendingSemester" class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
        <div class="p-6 space-y-4">
          <div v-for="i in 3" :key="i" class="flex items-center gap-4 animate-pulse">
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-20"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-12 ml-auto"></div>
            <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded-lg w-20"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24 ml-auto"></div>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th rowspan="2" class="text-left px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider align-middle border-r border-gray-200 dark:border-slate-600">{{
                  t('admin.tahunAjaran.colSemester') }}</th>
                <th rowspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell align-middle border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colAngka') }}</th>
                <th colspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colTanggalAktif') }}
                </th>
                <th rowspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider align-middle border-r border-gray-200 dark:border-slate-600">{{
                  t('admin.tahunAjaran.colStatus') }}</th>
                <th rowspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider align-middle">{{
                  t('admin.tahunAjaran.colAksi') }}</th>
              </tr>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-[10px] tracking-wider hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colMulai') }}
                </th>
                <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-[10px] tracking-wider hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colAkhir') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="item in semesterData" :key="item.id" class="transition-all duration-150" :class="item.isActive
                  ? 'border-l-2 border-l-green-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'">
                <td class="px-4 sm:px-6 py-4 border-r border-gray-200 dark:border-slate-600">
                  <span class="text-gray-900 dark:text-gray-100">{{ semesterLabel(item.nama) }}</span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  <span class="text-xs text-gray-600 dark:text-gray-300">
                    {{ displayAngka(item) }}
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  <span class="text-xs text-gray-600 dark:text-gray-300">{{ formatDate(item.tanggalMulai) }}</span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  <span class="text-xs text-gray-600 dark:text-gray-300">{{ formatDate(item.tanggalAkhir) }}</span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center border-r border-gray-200 dark:border-slate-600">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="item.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ item.isActive ? t('admin.tahunAjaran.aktif') : t('admin.tahunAjaran.tidakAktif') }}</span>
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4">
                  <div class="flex items-center justify-center gap-1">
                    <button @click="openEditSemester(item)"
                      class="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-md transition-all duration-150"
                      :title="t('admin.tahunAjaran.editTitle', { name: semesterFullLabel(item, t) })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    <button v-if="!item.isActive" @click="promptToggleSemester(item)"
                      class="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-md transition-all duration-150"
                      :title="t('admin.tahunAjaran.aktifkanTitle', { name: semesterFullLabel(item, t) })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    <span v-else class="p-2 text-green-500 cursor-default" :title="t('admin.tahunAjaran.sedangAktif')">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>

                    <button v-if="!item.isActive" @click="promptDeleteSemester(item)"
                      class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"
                      :title="t('admin.tahunAjaran.hapusTitle', { name: semesterFullLabel(item, t) })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="!semesterData || semesterData.length === 0">
                <td colspan="6" class="px-4 sm:px-6 py-16 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-gray-500 ">{{ t('admin.tahunAjaran.emptySemester') }}</p>
                    <button @click="openCreate"
                      class="inline-flex items-center gap-1 px-4 py-2 text-xs text-primary-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
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
      </div>
    </div>

    <!-- Tab: Tahun Ajaran -->
    <div v-show="activeTab === 'absensi'">
      <div class="flex flex-wrap items-center justify-end gap-3 mb-4">
        <button @click="openCreate"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs ">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">{{ t('admin.tahunAjaran.tambahTahunAjaran') }}</span>
        </button>
      </div>

      <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
      <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

      <!-- Loading skeleton -->
      <div v-if="pendingTahun" class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
        <div class="p-6 space-y-4">
          <div v-for="i in 3" :key="i" class="flex items-center gap-4 animate-pulse">
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-32"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-20"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-12 ml-auto"></div>
            <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded-lg w-20"></div>
            <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24 ml-auto"></div>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th rowspan="2" class="text-left px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider align-middle border-r border-gray-200 dark:border-slate-600">{{
                  t('admin.tahunAjaran.colTahunAjaran') }}</th>
                <th rowspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell align-middle border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colAngka') }}</th>
                <th colspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colTanggalAktifTahun') }}
                </th>
                <th rowspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider align-middle border-r border-gray-200 dark:border-slate-600">{{
                  t('admin.tahunAjaran.colStatus') }}</th>
                <th rowspan="2" class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs tracking-wider align-middle">{{
                  t('admin.tahunAjaran.colAksi') }}</th>
              </tr>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-[10px] tracking-wider hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colMulai') }}
                </th>
                <th class="text-center px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-300 text-[10px] tracking-wider hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  {{ t('admin.tahunAjaran.colAkhir') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="item in tahunData" :key="item.id" class="transition-all duration-150" :class="item.isActive
                  ? 'border-l-2 border-l-green-500 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'">
                <td class="px-4 sm:px-6 py-4 border-r border-gray-200 dark:border-slate-600">
                  <span class="text-gray-900 dark:text-gray-100">{{ item.nama }}</span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  <span class="text-xs text-gray-600 dark:text-gray-300">
                    {{ displayAngkaTahun(item) }}
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  <span class="text-xs text-gray-600 dark:text-gray-300">{{ formatDate(item.tanggalMulai) }}</span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center hidden sm:table-cell border-r border-gray-200 dark:border-slate-600">
                  <span class="text-xs text-gray-600 dark:text-gray-300">{{ formatDate(item.tanggalAkhir) }}</span>
                </td>
                <td class="px-4 sm:px-6 py-4 text-center border-r border-gray-200 dark:border-slate-600">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="item.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ item.isActive ? t('admin.tahunAjaran.aktif') : t('admin.tahunAjaran.tidakAktif') }}</span>
                  </span>
                </td>
                <td class="px-4 sm:px-6 py-4">
                  <div class="flex items-center justify-center gap-1">
                    <button @click="openEditTahun(item)"
                      class="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-md transition-all duration-150"
                      :title="t('admin.tahunAjaran.editTitle', { name: item.nama })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    <button v-if="!item.isActive" @click="promptToggleTahun(item)"
                      class="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-md transition-all duration-150"
                      :title="t('admin.tahunAjaran.aktifkanTitle', { name: item.nama })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    <span v-else class="p-2 text-green-500 cursor-default" :title="t('admin.tahunAjaran.sedangAktif')">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>

                    <button v-if="!item.isActive" @click="promptDeleteTahun(item)"
                      class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150"
                      :title="t('admin.tahunAjaran.hapusTitle', { name: item.nama })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="!tahunData || tahunData.length === 0">
                <td colspan="6" class="px-4 sm:px-6 py-16 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p class="text-gray-500 ">{{ t('admin.tahunAjaran.empty') }}</p>
                    <button @click="openCreate"
                      class="inline-flex items-center gap-1 px-4 py-2 text-xs text-primary-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
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
      </div>
    </div>

    <!-- Modal Create/Edit -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="handleCloseClick">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="handleCloseClick"></div>

          <div
            class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-auto overflow-hidden border border-gray-300 dark:border-gray-600">
            <div class="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 class="text-lg text-gray-900 dark:text-gray-100">
                {{ modalTitle }}
              </h2>
              <button @click="handleCloseClick"
                class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form @submit.prevent="handleSave" class="p-4 space-y-4">
              <!-- Semester tab: input nama semester + kode/angka -->
              <template v-if="!isTabTahunAjaran">
                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{
                    t('admin.tahunAjaran.labelNamaSemester') }}</label>
                  <input v-model="form.nama" type="text" @input="onNamaSemesterInput" @change="onFormChange"
                    :disabled="editingHasKelas"
                    :placeholder="t('admin.tahunAjaran.placeholderJenisSemester')"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                  <Transition name="fade">
                    <p v-if="editingHasKelas"
                      class="flex items-center gap-1 text-xs text-amber-600 mt-1.5">
                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {{ t('admin.tahunAjaran.infoNamaTerkunciSemester', { count: editingHasKelas && editing ? (editing.type === 'semester' ? editing.item._count.kelas : 0) : 0 }) }}
                    </p>
                  </Transition>
                </div>

                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{
                    t('admin.tahunAjaran.labelKodeAngka') }}</label>
                  <input v-model="form.kodeAngka" type="text" inputmode="numeric" maxlength="2"
                    @input="onKodeAngkaInput" @change="onFormChange"
                    :class="formAngkaParitasInvalid ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500' : ''"
                    :placeholder="t('admin.tahunAjaran.placeholderKodeAngka')"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                  <Transition name="fade">
                    <p v-if="formAngkaParitasInvalid" class="flex items-center gap-1 text-xs text-red-600 mt-1.5">
                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {{ t('admin.tahunAjaran.hintParitas') }}
                    </p>
                  </Transition>

                  <label class="mt-3 flex items-start gap-2.5 cursor-pointer select-none">
                    <input v-model="form.pakaiRomawi" type="checkbox" @change="onFormChange"
                      class="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 transition-shadow" />
                    <div class="flex flex-col">
                      <span class="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">{{
                        t('admin.tahunAjaran.labelPakaiRomawi') }}</span>
                      <span v-if="formAngkaPreview" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {{ form.pakaiRomawi ? t('admin.tahunAjaran.previewRomawi', { angka: formAngkaPreview }) : t('admin.tahunAjaran.previewAngka', { angka: formAngkaPreview }) }}
                      </span>
                    </div>
                  </label>
                </div>
              </template>

              <!-- Tahun Ajaran tab: input tahun -->
              <template v-else>
                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{
                    t('admin.tahunAjaran.labelTahunAjaran') }}</label>
                  <input v-model="form.nama" type="text" @input="onTahunAjaranInput" @change="onFormChange"
                    :placeholder="t('admin.tahunAjaran.placeholderTahunAjaran')"
                    :disabled="editingHasKelas"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                  <Transition name="fade">
                    <p v-if="editingHasKelas"
                      class="flex items-center gap-1 text-xs text-amber-600 mt-1.5">
                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {{ t('admin.tahunAjaran.infoNamaTerkunci', { count: editingHasKelas && editing && editing.type === 'tahun' ? editing.item._count.semester : 0 }) }}
                    </p>
                  </Transition>
                </div>

                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{
                    t('admin.tahunAjaran.labelKodeAngka') }}</label>
                  <input v-model="form.kodeAngka" type="text" inputmode="numeric" maxlength="4"
                    @input="onTahunKodeAngkaInput" @change="onFormChange"
                    :placeholder="t('admin.tahunAjaran.placeholderKodeAngkaTahun')"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow placeholder:text-gray-400 dark:placeholder:text-gray-500" />

                  <label class="mt-3 flex items-start gap-2.5 cursor-pointer select-none">
                    <input v-model="form.pakaiRomawi" type="checkbox" @change="onFormChange"
                      class="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 transition-shadow" />
                    <div class="flex flex-col">
                      <span class="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">{{
                        t('admin.tahunAjaran.labelPakaiRomawi') }}</span>
                      <span v-if="formAngkaPreview" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {{ form.pakaiRomawi ? t('admin.tahunAjaran.previewRomawi', { angka: formAngkaPreview }) : t('admin.tahunAjaran.previewAngka', { angka: formAngkaPreview }) }}
                      </span>
                    </div>
                  </label>
                </div>
              </template>

              <!-- Tanggal Aktivasi -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{
                    t('admin.tahunAjaran.labelTanggalMulai') }}</label>
                  <input v-model="form.tanggalMulai" type="date" @change="onFormChange"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow" />
                </div>
                <div>
                  <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{
                    t('admin.tahunAjaran.labelTanggalAkhir') }}</label>
                  <input v-model="form.tanggalAkhir" type="date" @change="onFormChange"
                    class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow" />
                </div>
              </div>

              <!-- Set Active (hanya tab Tahun Ajaran) -->
              <div v-if="isTabTahunAjaran"
                class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                <input id="setActive" v-model="form.setActive" type="checkbox" @change="onFormChange"
                  class="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 transition-shadow" />
                <div class="flex flex-col">
                  <label for="setActive" class="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                    {{ editing ? (isTabTahunAjaran ? t('admin.tahunAjaran.setAktifEdit') : t('admin.tahunAjaran.setAktifEditSemester')) : t('admin.tahunAjaran.setAktifCreate') }}
                  </label>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {{ isTabTahunAjaran ? t('admin.tahunAjaran.infoAutoNonaktif') : t('admin.tahunAjaran.infoAutoNonaktifSemester') }}
                  </p>
                </div>
              </div>

              <!-- Edit mode info (hanya tab Tahun Ajaran) -->
              <Transition name="fade">
                <div v-if="editing && editing.item.isActive"
                  class="flex items-center gap-2 p-3 bg-primary-50 border border-primary-200 rounded-lg text-xs text-primary-700">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ isTabTahunAjaran ? t('admin.tahunAjaran.infoEditAktif') : t('admin.tahunAjaran.infoEditAktifSemester') }}</span>
                </div>
              </Transition>

              <!-- Error -->
              <Transition name="fade">
                <div v-if="errorMsg"
                  class="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{{ errorMsg }}</span>
                </div>
              </Transition>

              <!-- Actions -->
              <div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
                <button type="button" @click="handleCloseClick"
                  class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                  {{ t('common.batal') }}
                </button>
                <button type="submit" :disabled="saving"
                  class="px-5 py-2 text-xs text-white bg-primary-600 rounded-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
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
          <div
            class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <h2 class="text-xs text-gray-900 dark:text-gray-100 mb-2">{{ t('admin.tahunAjaran.confirmCloseTitle') }}
            </h2>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-5">{{ t('admin.tahunAjaran.confirmCloseMsg') }}</p>
            <div class="flex justify-end gap-3">
              <button @click="confirmClose = false"
                class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('admin.tahunAjaran.lanjutkanEdit') }}
              </button>
              <button @click="showModal = false; confirmClose = false"
                class="px-4 py-2 text-xs text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors">
                {{ t('admin.tahunAjaran.yaBatalkan') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal Confirm Toggle -->
      <Transition name="modal">
        <div v-if="confirmToggle" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="confirmToggle = null"></div>
          <div
            class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 class="text-lg text-gray-900 dark:text-gray-100">
                {{ isTabTahunAjaran ? t('admin.tahunAjaran.confirmToggleTitle') : t('admin.tahunAjaran.confirmToggleTitleSemester') }}
              </h2>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {{ isTabTahunAjaran ? t('admin.tahunAjaran.confirmToggleMsg', { name: confirmToggle.nama }) : t('admin.tahunAjaran.confirmToggleMsgSemester', { name: confirmToggle.nama }) }}
            </p>
            <p
              class="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-lg p-3 mb-4">
              {{ isTabTahunAjaran ? t('admin.tahunAjaran.confirmToggleInfo') : t('admin.tahunAjaran.confirmToggleInfoSemester') }}
            </p>
            <div class="flex justify-end gap-3">
              <button @click="confirmToggle = null"
                class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.batal') }}
              </button>
              <button @click="handleToggle"
                class="px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 active:bg-green-800">
                {{ t('common.yaAktifkan') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Modal Confirm Delete -->
      <Transition name="modal">
        <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="confirmDelete = null"></div>
          <div
            class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg text-gray-900 dark:text-gray-100">
                  {{ isTabTahunAjaran ? t('admin.tahunAjaran.confirmDeleteTitle') : t('admin.tahunAjaran.confirmDeleteTitleSemester') }}
                </h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('admin.tahunAjaran.confirmDeleteSub') }}</p>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {{ isTabTahunAjaran ? t('admin.tahunAjaran.confirmDeleteMsg', { name: confirmDelete.nama }) : t('admin.tahunAjaran.confirmDeleteMsgSemester', { name: confirmDelete.nama }) }}
            </p>
            <div v-if="confirmDelete.count > 0"
              class="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>
                {{ isTabTahunAjaran ? t('admin.tahunAjaran.confirmDeleteKelas', { count: confirmDelete.count }) : t('admin.tahunAjaran.confirmDeleteKelasSemester', { count: confirmDelete.count }) }}
              </span>
            </div>
            <p v-else class="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {{ t('admin.tahunAjaran.confirmDeleteTanpaKelas') }}
            </p>
            <div class="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-slate-700">
              <button @click="confirmDelete = null"
                class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
                {{ t('common.batal') }}
              </button>
              <button @click="handleDelete"
                class="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 active:bg-red-800">
                {{ t('common.yaHapus') }}
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

  .modal-enter-from>div:last-child,
  .modal-leave-to>div:last-child {
    transform: scale(0.95);
  }

  .modal-enter-from>div:first-child,
  .modal-leave-to>div:first-child {
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