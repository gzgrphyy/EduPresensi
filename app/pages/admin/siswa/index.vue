<script setup lang="ts">
  interface Siswa {
    id: number
    nisn: string
    nama: string
    kelasId: number
    nomorHp1: string | null
    nomorHp2: string | null
    namaWali: string | null
    emailWali: string | null
    kontakWali: string | null
    kontakWali2: string | null
    kelas: { id: number; nama: string }
    user: { email: string; isActive: boolean; foto: string | null; jenisKelamin: string | null }
    createdAt: string
  }

  const { t } = useI18n()

  const searchQuery = ref('')
  const showInactive = ref(false)
  const filterKelas = ref(0)
  const filterJenjang = ref('')
  const sortOrder = ref('')
  const page = ref(1)
  const pageSize = 10

  function toggleSort() {
    sortOrder.value = sortOrder.value === 'abjad' ? '' : 'abjad'
    page.value = 1
  }

  function initials(nama: string) {
    const parts = nama.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }

  // Foto profil dummy untuk data murid yang belum punya foto asli (dibedakan laki-laki/perempuan)
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

  function jenisKelaminBadgeClass(jk: string | null, isActive: boolean): string {
    if (!isActive) return 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
    if (jk === 'PEREMPUAN') return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300'
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  }

  function jenjangOf(nama: string) {
    return (nama.match(/^[IVXLCDM]+/)?.[0] || '').toUpperCase()
  }

  const jenjangList = computed(() => {
    const set = new Set < string > ()
    for (const k of kelasList.value || []) {
      const j = jenjangOf(k.nama)
      if (j) set.add(j)
    }
    return [...set].sort()
  })

  // Filter kelas list berdasarkan jenjang yang dipilih
  const filteredKelasList = computed(() => {
    if (!filterJenjang.value) return kelasList.value || []
    return (kelasList.value || []).filter(k => jenjangOf(k.nama) === filterJenjang.value)
  })

  // Urutan data: abjad = A-Z, default (off) = urutan dari server
  const displayData = computed(() => {
    let rows = siswaList.value || []
    if (filterJenjang.value) {
      rows = rows.filter(s => jenjangOf(s.kelas?.nama || '') === filterJenjang.value)
    }
    if (sortOrder.value === 'abjad') {
      return rows.slice().sort((a, b) => a.nama.localeCompare(b.nama))
    }
    return rows
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(displayData.value.length / pageSize)))

  // Nomor halaman untuk lompat langsung (pakai elipsis jika halaman banyak)
  const pageNumbers = computed < (number | '...')[] > (() => {
    const total = totalPages.value
    const current = page.value
    const set = new Set < number > ([1, total, current - 1, current, current + 1])
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
    return displayData.value.slice(start, start + pageSize)
  })

  watch([searchQuery, filterJenjang, showInactive], () => { filterKelas.value = 0; page.value = 1 })
  watch(filterKelas, () => { page.value = 1 })

  const { data: siswaList, pending, refresh } = useFetch < Siswa[] > (() => {
    const params = new URLSearchParams()
    if (showInactive.value) params.set('showInactive', 'true')
    if (searchQuery.value) params.set('search', searchQuery.value)
    if (filterKelas.value) params.set('kelasId', String(filterKelas.value))
    return `/api/admin/siswa?${params.toString()}`
  }, { immediate: true })
  const { data: kelasList } = useFetch < { id: number; nama: string }[] > ('/api/admin/kelas', { immediate: true })

  const showModal = ref(false)
  const emptyMsg = computed(() =>
    showInactive.value ? t('admin.guru.emptyInactive') : t('admin.siswa.empty')
  )
  const editing = ref < Siswa | null > (null)
  const form = ref({ nama: '', nisn: '', email: '', kelasId: 0, jenisKelamin: '', namaWali: '', emailWali: '', kontakWali: '', kontakWali2: '', nomorHp1: '', nomorHp2: '' })
  const saving = ref(false)
  const errorMsg = ref('')
  const successMsg = ref('')
  const confirmDelete = ref < { id: number; nama: string } | null > (null)
  const waliDetail = ref < Siswa | null > (null)
  const confirmClose = ref(false)
  const dirtyForm = ref(false)
  const generatedPassword = ref('')
  const showPasswordModal = ref(false)
  const resetPasswordFor = ref < Siswa | null > (null)
  const resettingPw = ref(false)

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

  function openCreate() {
    editing.value = null
    form.value = { nama: '', nisn: '', email: '', kelasId: 0, jenisKelamin: '', namaWali: '', emailWali: '', kontakWali: '', kontakWali2: '', nomorHp1: '', nomorHp2: '' }
    errorMsg.value = ''
    dirtyForm.value = false
    showModal.value = true
  }

  function openEdit(item: Siswa) {
    editing.value = item
    form.value = {
      nama: item.nama,
      nisn: item.nisn,
      email: item.user.email,
      kelasId: item.kelasId,
      jenisKelamin: item.user.jenisKelamin || '',
      namaWali: item.namaWali || '',
      emailWali: item.emailWali || '',
      kontakWali: item.kontakWali || '',
      kontakWali2: item.kontakWali2 || '',
      nomorHp1: item.nomorHp1 || '',
      nomorHp2: item.nomorHp2 || ''
    }
    errorMsg.value = ''
    dirtyForm.value = false
    showModal.value = true
  }

  function onFormChange() { dirtyForm.value = true }

  function onNisnInput(event: Event) {
    const target = event.target as HTMLInputElement
    form.value.nisn = target.value.replace(/\D/g, '').slice(0, 10)
    onFormChange()
  }

  function handleCloseClick() {
    showModal.value = false
  }

  async function handleSave() {
    saving.value = true
    errorMsg.value = ''

    if (!form.value.nama.trim()) { showError('Nama lengkap wajib diisi'); saving.value = false; return }
    if (!form.value.jenisKelamin) { showError('Jenis kelamin wajib diisi'); saving.value = false; return }
    if (!/^[0-9]{10}$/.test(form.value.nisn)) { showError('NISN harus tepat 10 digit angka'); saving.value = false; return }
    if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) { showError('Format email tidak valid'); saving.value = false; return }

    try {
      if (editing.value) {
        const body: Record<string, unknown> = {}
        if (form.value.nama !== editing.value.nama) body.nama = form.value.nama
        if (form.value.nisn !== editing.value.nisn) body.nisn = form.value.nisn
        if (form.value.email !== editing.value.user.email) body.email = form.value.email
        if (form.value.kelasId !== editing.value.kelasId) body.kelasId = form.value.kelasId
        if ((form.value.jenisKelamin || null) !== (editing.value.user.jenisKelamin || null)) body.jenisKelamin = form.value.jenisKelamin || null
        if (form.value.namaWali !== (editing.value.namaWali || '')) body.namaWali = form.value.namaWali || null
        if (form.value.emailWali !== (editing.value.emailWali || '')) body.emailWali = form.value.emailWali || null
        if (form.value.kontakWali !== (editing.value.kontakWali || '')) body.kontakWali = form.value.kontakWali || null
        if (form.value.kontakWali2 !== (editing.value.kontakWali2 || '')) body.kontakWali2 = form.value.kontakWali2 || null
        if (form.value.nomorHp1 !== (editing.value.nomorHp1 || '')) body.nomorHp1 = form.value.nomorHp1 || null
        if (form.value.nomorHp2 !== (editing.value.nomorHp2 || '')) body.nomorHp2 = form.value.nomorHp2 || null

        if (Object.keys(body).length === 0) { showModal.value = false; return }

        const { error } = await useFetch(`/api/admin/siswa/${editing.value.id}`, { method: 'PATCH', body })
        if (error.value) { showError(error.value.statusMessage || 'Gagal menyimpan'); return }
        showSuccess(t('admin.siswa.msgBerhasilEdit'))
      } else {
        const { data: result, error } = await useFetch('/api/admin/siswa', {
          method: 'POST',
          body: {
            nama: form.value.nama,
            nisn: form.value.nisn,
            email: form.value.email,
            kelasId: form.value.kelasId,
            jenisKelamin: form.value.jenisKelamin || undefined,
            namaWali: form.value.namaWali || undefined,
            emailWali: form.value.emailWali || undefined,
            kontakWali: form.value.kontakWali || undefined,
            kontakWali2: form.value.kontakWali2 || undefined,
            nomorHp1: form.value.nomorHp1 || undefined,
            nomorHp2: form.value.nomorHp2 || undefined
          }
        })
        if (error.value) { showError(error.value.statusMessage || 'Gagal menyimpan'); return }
        if (result.value?.generatedPassword) {
          generatedPassword.value = result.value.generatedPassword
          showPasswordModal.value = true
        }
        showSuccess(t('admin.siswa.msgBerhasilTambah'))
      }
      showModal.value = false
      confirmClose.value = false
      await refresh()
    } finally { saving.value = false }
  }

  function promptDelete(item: Siswa) {
    confirmDelete.value = { id: item.id, nama: item.nama }
  }

  function openWaliDetail(item: Siswa) {
    waliDetail.value = item
  }

  async function handleDelete() {
    if (!confirmDelete.value) return
    const { id } = confirmDelete.value
    confirmDelete.value = null
    const { error } = await useFetch(`/api/admin/siswa/${id}`, { method: 'DELETE' })
    if (error.value) { showError(error.value.statusMessage || 'Gagal menghapus'); return }
    showSuccess(t('admin.siswa.msgBerhasilHapus'))
    await refresh()
  }

  function promptResetPassword(item: Siswa) {
    resetPasswordFor.value = item
  }

  async function handleResetPassword() {
    if (!resetPasswordFor.value) return
    resettingPw.value = true
    errorMsg.value = ''

    try {
      const data = await $fetch(`/api/admin/siswa/${resetPasswordFor.value.id}/reset-password`, {
        method: 'POST'
      })
      generatedPassword.value = data.generatedPassword
      showPasswordModal.value = true
      resetPasswordFor.value = null
      showSuccess(t('admin.guru.msgBerhasilReset'))
    } catch (err: any) {
      showError(err?.data?.statusMessage || 'Gagal reset password')
    } finally {
      resettingPw.value = false
    }
  }

  async function copyPassword() {
    const ok = await copyToClipboard(generatedPassword.value)
    if (ok) {
      showSuccess(t('admin.guru.msgPasswordTersalin'))
    } else {
      showError(t('admin.guru.msgGagalSalin'))
    }
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
        nisn: String(row['NISN'] || row['nisn'] || '').trim(),
        nama: String(row['Nama'] || row['nama'] || '').trim(),
        email: String(row['Email'] || row['email'] || '').trim(),
        kelasId: parseInt(String(row['Kelas ID'] || row['kelasId'] || row['Kelas'] || '0')) || 0,
        jenisKelamin: String(row['Jenis Kelamin'] || row['jenisKelamin'] || '').trim() || undefined,
        namaWali: String(row['Nama Wali'] || row['namaWali'] || '').trim() || null,
        emailWali: String(row['Email Wali'] || row['emailWali'] || '').trim() || null,
        kontakWali: String(row['Kontak Wali'] || row['kontakWali'] || '').trim() || null,
        kontakWali2: String(row['Kontak Wali 2'] || row['kontakWali2'] || '').trim() || null,
        nomorHp1: String(row['No HP 1'] || row['noHp1'] || row['nomorHp1'] || '').trim() || null,
        nomorHp2: String(row['No HP 2'] || row['noHp2'] || row['nomorHp2'] || '').trim() || null
      }))

      const { data, error } = await useFetch('/api/admin/siswa/import', {
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
    <PageHeader :title="t('admin.siswa.title')" :description="t('admin.siswa.desc')" />

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" :placeholder="t('admin.siswa.searchPlaceholder')"
            class="w-40 sm:w-56 pl-9 pr-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </div>
        <select v-model="filterJenjang"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 centerFilter">
          <option value="">{{ t('admin.siswa.semuaJenjang') }}</option>
          <option v-for="j in jenjangList" :key="j" :value="j">{{ j }}</option>
        </select>
        <select v-model="filterKelas"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option :value="0">{{ t('admin.jadwal.semuaKelas') }}</option>
          <option v-for="k in filteredKelasList" :key="k.id" :value="k.id">{{ k.nama }}</option>
        </select>

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
            :title="sortOrder === 'abjad' ? t('admin.siswa.namaAz') : t('admin.siswa.namaAzOff')">
            <span
              :class="sortOrder === 'abjad' ? 'translate-x-[18px]' : 'translate-x-[2px]'"
              class="inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-slate-300 shadow-sm transition-all duration-200" />
          </button>
          <span class="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
            {{ t('admin.siswa.namaAz') }}
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
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">{{ t('admin.siswa.tambahMurid') }}</span>
        </button>
      </div>
    </div>

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <!-- Loading -->
    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="6" />

    <!-- Table -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
      <div class="overflow-x-auto scrollbar-thin">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.siswa.colNamaLengkap') }}</th>
              <th
                class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden md:table-cell">
                {{ t('admin.jadwal.colKelas') }}</th>
              <th
                class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell">
                {{ t('admin.siswa.colNisn') }}</th>
              <th
                class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden lg:table-cell">
                {{ t('admin.guru.colNoHp') }}</th>
              <th
                class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden xl:table-cell">
                {{ t('admin.guru.colEmail') }}</th>
              <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.tahunAjaran.colStatus') }}</th>
              <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.tahunAjaran.colAksi') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y admin-accent-divide">
            <tr v-for="item in visibleData" :key="item.id"
              class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div v-if="item.user.foto"
                    class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border admin-accent-border">
                    <img :src="item.user.foto" class="w-full h-full object-cover" :alt="item.nama" />
                  </div>
                  <div v-else class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border admin-accent-border">
                    <img :src="dummyAvatar(item.nama, item.user.jenisKelamin)" class="w-full h-full object-cover"
                      :alt="item.nama" />
                  </div>
                  <div class="min-w-0">
                    <span class="text-gray-900 dark:text-gray-100"
                      :class="{ 'text-gray-500 dark:text-gray-400': !item.user.isActive }">
                      {{ item.nama }}
                    </span>
                    <div class="text-xs text-gray-400 dark:text-gray-500"
                      :class="{ 'text-gray-300 dark:text-gray-600': !item.user.isActive }">
                      {{ item.user.jenisKelamin ? jenisKelaminLabel(item.user.jenisKelamin) : '-' }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300 hidden md:table-cell">{{ item.kelas?.nama || '-' }}
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell">{{ item.nisn }}</td>
              <td class="px-4 py-3 text-center hidden lg:table-cell">
                <div class="text-gray-500 dark:text-gray-400 text-xs">
                  <div>{{ item.nomorHp1 || '-' }}</div>
                  <div v-if="item.nomorHp2" class="mt-0.5">{{ item.nomorHp2 }}</div>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden xl:table-cell">{{ item.user.email ||
                '-' }}</td>
              <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="item.user.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                  <span class="text-xs text-gray-600 dark:text-gray-400">{{ item.user.isActive ? t('admin.tahunAjaran.aktif') : t('admin.tahunAjaran.tidakAktif') }}</span>
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-center gap-1">
                  <button @click="openEdit(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    :title="t('common.edit')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  <!-- Lihat Info Wali -->
                  <button @click="openWaliDetail(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-md transition-all duration-150"
                    :title="t('admin.siswa.viewWaliTitle')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>

                  <!-- Reset Password -->
                  <button @click="promptResetPassword(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-all duration-150"
                    :title="t('admin.guru.resetPwTitle').replace('{name}', item.nama)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>

                  <button @click="promptDelete(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md"
                    :title="t('common.hapus')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <!-- Empty state -->
            <tr v-if="!siswaList || siswaList.length === 0">
              <td colspan="7" class="px-4 py-16 text-center">
                <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 14l9-5-9-5-9 5 9 5zm0 7l-9-5 9-5 9 5-9 5zm0-7l-9-5 9-5 9 5-9 5z" />
                </svg>
                <p class="text-gray-500 dark:text-gray-400 ">{{ emptyMsg }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="(siswaList || []).length > pageSize"
        class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize, (siswaList ||
          []).length), total: (siswaList || []).length, unit: t('admin.siswa.unitMurid') }) }}
        </p>
        <div class="ml-auto flex items-center gap-2">
          <button @click="page--" :disabled="page <= 1"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            {{ t('common.sebelumnya') }}
          </button>
          <div class="flex items-center gap-1">
            <template v-for="(n, i) in pageNumbers" :key="i">
              <button v-if="n !== '...'" @click="page = n" :disabled="n === page"
                :class="n === page
                  ? 'w-7 h-7 rounded-md text-xs  text-white bg-primary-600 ring-1 ring-primary-600 cursor-default'
                  : 'w-7 h-7 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors'">
                {{ n }}
              </button>
              <span v-else class="px-0.5 text-xs text-gray-400 dark:text-gray-500 select-none">&hellip;</span>
            </template>
          </div>
          <button @click="page++" :disabled="page >= totalPages"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ t('common.selanjutnya') }}
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Create/Edit -->
    <BaseModal :show="showModal" :title="editing ? t('admin.siswa.modalEdit') : t('admin.siswa.modalCreate')"
      @close="handleCloseClick">
      <form @submit.prevent="handleSave" class="space-y-4">
        <BaseFormField :label="t('admin.guru.labelNama')" required :error="undefined">
          <input v-model="form.nama" type="text" @input="onFormChange" required
            :placeholder="t('admin.siswa.placeholderNama')"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </BaseFormField>

        <BaseFormField :label="t('admin.guru.labelJenisKelamin')" required>
          <select v-model="form.jenisKelamin" @change="onFormChange" required
            :class="form.jenisKelamin ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="" disabled>{{ t('admin.guru.pilihJenisKelamin') }}</option>
            <option value="LAKI_LAKI">{{ t('admin.guru.jenisKelaminL') }}</option>
            <option value="PEREMPUAN">{{ t('admin.guru.jenisKelaminP') }}</option>
          </select>
        </BaseFormField>

        <div class="grid grid-cols-2 gap-4">
          <BaseFormField :label="t('admin.jadwal.labelKelas')" required>
            <select v-model="form.kelasId" @change="onFormChange" required
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs dark:bg-slate-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700">
              <option :value="0" disabled>{{ t('admin.jadwal.pilihKelas') }}</option>
              <option v-for="k in kelasList" :key="k.id" :value="k.id">{{ k.nama }}</option>
            </select>
          </BaseFormField>

          <BaseFormField :label="t('admin.siswa.labelNisn')" required>
            <input v-model="form.nisn" type="text" @input="onNisnInput" required maxlength="10" inputmode="numeric"
              :placeholder="t('admin.siswa.placeholderNisn')"
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </BaseFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <BaseFormField :label="t('admin.siswa.labelNoHp1')">
            <input v-model="form.nomorHp1" type="text" @input="onFormChange"
              :placeholder="t('admin.siswa.placeholderHpMurid')"
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </BaseFormField>

          <BaseFormField :label="t('admin.siswa.labelNoHp2')">
            <input v-model="form.nomorHp2" type="text" @input="onFormChange"
              :placeholder="t('admin.guru.placeholderHp2')"
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </BaseFormField>
        </div>

        <BaseFormField :label="t('admin.siswa.labelEmailLogin')">
          <input v-model="form.email" type="email" @input="onFormChange" :placeholder="t('admin.guru.placeholderEmail')"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </BaseFormField>

        <Transition name="fade">
          <div v-if="!editing"
            class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-300">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ t('admin.siswa.infoPassword') }}</span>
          </div>
        </Transition>

        <p class="mt-2 text-xs text-gray-400 dark:text-gray-500">{{ t('admin.siswa.labelTitleKontakWali') }}</p>

        <BaseFormField :label="t('admin.siswa.labelNamaWali')">
          <input v-model="form.namaWali" type="text" @input="onFormChange"
            :placeholder="t('admin.siswa.placeholderNamaWali')"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </BaseFormField>

        <div class="grid grid-cols-2 gap-4">
          <BaseFormField :label="t('admin.siswa.labelKontakWali')">
            <input v-model="form.kontakWali" type="text" @input="onFormChange"
              :placeholder="t('admin.siswa.placeholderKontakWali')"
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </BaseFormField>

          <BaseFormField :label="t('admin.siswa.labelKontakWali2')">
            <input v-model="form.kontakWali2" type="text" @input="onFormChange"
              :placeholder="t('admin.siswa.placeholderKontakWali2')"
              class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
          </BaseFormField>

        </div>

        <BaseFormField :label="t('admin.siswa.labelEmailWali')">
          <input v-model="form.emailWali" type="email" @input="onFormChange"
            :placeholder="t('admin.siswa.placeholderEmailWali')"
            class="w-full px-3.5 py-2.5 border border-gray-300 dark:border-slate-600 rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
        </BaseFormField>

        <Teleport to="body">
          <Transition name="fade">
            <div v-if="errorMsg && showModal"
              class="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              <span>{{ errorMsg }}</span>
            </div>
          </Transition>
        </Teleport>
      </form>
      <template #footer>
        <button type="button" @click="handleCloseClick"
          class="px-4 py-2 text-xs  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">Batal</button>
        <button type="submit" @click="handleSave" :disabled="saving"
          class="px-5 py-2 text-xs  text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
          <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ saving ? 'Menyimpan...' : 'Simpan' }}
        </button>
      </template>
    </BaseModal>

    <!-- Modal Info Wali -->
    <BaseModal :show="!!waliDetail" :title="t('admin.siswa.modalWali')" max-w="max-w-sm" @close="waliDetail = null">
      <template v-if="waliDetail">
        <div class="p-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg mb-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="info-walikiri">
              <div class="flex items-center gap-3 ">
                <div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border admin-accent-border">
                  <img :src="waliDetail.user.foto || dummyAvatar(waliDetail.nama, waliDetail.user.jenisKelamin)"
                    class="w-full h-full object-cover" :alt="waliDetail.nama" />
                </div>
                <div class="min-w-0">
                  <div class="text-sm text-gray-900 dark:text-gray-100">{{ waliDetail.nama }}</div>
                  <div class="text-xs text-gray-400 dark:text-gray-500 label-gray">{{ waliDetail.user.jenisKelamin }}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">{{ waliDetail.nisn }}</div>
              <div class="text-xs text-gray-400 dark:text-gray-500 text-center"> {{waliDetail.kelas?.nama }}</div>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{ t('admin.siswa.labelNamaWali')
              }}</label>
            <div
              class="px-3.5 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-700">
              {{ waliDetail.namaWali || '-' }}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">
                {{ t('admin.siswa.labelKontakWali') }} <span class="text-red-500">*</span>
              </label>
              <div
                class="px-3.5 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-700">
                {{ waliDetail.kontakWali || '-' }}
              </div>
            </div>
            <div>
              <label class="block text-xs  text-gray-700 dark:text-gray-300 mb-1.5">{{ t('admin.siswa.labelKontakWali2')
                }}</label>
              <div
                class="px-3.5 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-700">
                {{ waliDetail.kontakWali2 || '-' }}
              </div>
            </div>
          </div>
          <div>
            <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">{{ t('admin.siswa.labelEmailWali')
              }}</label>
            <div
              class="px-3.5 py-2.5 border border-gray-200 dark:border-slate-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-slate-700">
              {{ waliDetail.emailWali || '-' }}
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <button @click="waliDetail = null"
          class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors button-tutup">
          {{ t('admin.guru.tutup') }}
        </button>
      </template>
    </BaseModal>

    <!-- Modal Password -->
    <BaseModal :show="showPasswordModal" title="Password Generated" max-w="max-w-sm" @close="showPasswordModal = false">
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Password untuk akun murid. Salin dan sampaikan ke murid.
      </p>
      <div
        class="flex items-center gap-2 p-4 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg mb-4">
        <code
          class="flex-1 text-lg font-mono  text-center text-gray-900 dark:text-gray-100 tracking-wider select-all">{{ generatedPassword }}</code>
      </div>
      <template #footer>
        <button @click="showPasswordModal = false"
          class="px-4 py-2 text-sm  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">Tutup</button>
        <button @click="copyPassword"
          class="px-4 py-2 text-sm  text-white bg-blue-600 rounded-md hover:bg-blue-700 inline-flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Salin Password
        </button>
      </template>
    </BaseModal>

    <!-- Modal Confirm Reset Password -->
    <Transition name="fade">
      <div v-if="resetPasswordFor" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="resetPasswordFor = null"></div>
        <div
          class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm mx-auto p-4 border border-gray-300 dark:border-gray-600">
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
              <svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg  text-gray-900 dark:text-gray-100">Reset Password</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ resetPasswordFor.nama }}</p>
            </div>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-400 mb-5">
            Password baru akan digenerate otomatis. Password lama tidak bisa digunakan lagi. Lanjutkan?
          </p>

          <div class="flex justify-end gap-3">
            <button @click="resetPasswordFor = null"
              class="px-4 py-2 text-sm  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
              Batal
            </button>
            <button @click="handleResetPassword" :disabled="resettingPw"
              class="px-4 py-2 text-sm  text-white bg-amber-600 rounded-md hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 inline-flex items-center gap-2">
              <svg v-if="resettingPw" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Ya, Reset
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal Confirm Delete -->
    <ConfirmDialog :show="!!confirmDelete" title="Hapus Data Murid"
      :message="`Yakin ingin menghapus ${confirmDelete?.nama}?`" variant="danger" @confirm="handleDelete"
      @cancel="confirmDelete = null" />

    <!-- Modal Import Excel -->
    <Transition name="fade">
      <div v-if="showImportModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="closeImportModal"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-3xl mx-auto overflow-hidden border border-gray-300 dark:border-gray-600 max-h-[90vh] flex flex-col">
          <div class="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 class="text-lg text-gray-900 dark:text-gray-100">{{ t('admin.siswa.importTitle') }}</h2>
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
                <p class="text-xs font-medium text-blue-700 dark:text-blue-300">{{ t('admin.siswa.belumPunyaTemplate') }}</p>
                <p class="text-xs text-blue-600 dark:text-blue-400">{{ t('admin.siswa.templateHint') }}</p>
              </div>
              <a href="/api/admin/siswa/template-export" download class="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {{ t('admin.siswa.downloadTemplate') }}
              </a>
            </div>

            <!-- File Upload Area -->
            <div v-if="!importPreview.length && !importResult" class="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
              <input type="file" accept=".xlsx,.xls,.csv" @change="handleFileChange" class="hidden" id="siswa-import-file" />
              <label for="siswa-import-file" class="cursor-pointer inline-flex flex-col items-center gap-3">
                <svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                  <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('admin.siswa.importBtn') }}</span>
                  <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('admin.siswa.requiredCols') }}</span>
              </label>
            </div>

            <!-- Preview Table -->
            <div v-if="importPreview.length > 0 && !importResult" class="space-y-3">
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('admin.siswa.previewRows', { count: importPreview.length }) }}</p>
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
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ t('admin.siswa.importSuccess') }}</span>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    {{ t('admin.siswa.resultSuccess') }}: <span class="font-medium text-green-600">{{ importResult.success }}</span> |
                    {{ t('admin.siswa.resultFailed') }}: <span class="font-medium text-red-600">{{ importResult.failed }}</span> |
                    {{ t('admin.siswa.resultTotal') }}: {{ importResult.success + importResult.failed }}
                  </p>
              </div>

              <div v-if="importResult.errors.length > 0" class="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                <div class="bg-red-50 dark:bg-red-900/20 px-4 py-2 border-b border-red-200 dark:border-red-800">
                    <p class="text-xs font-medium text-red-700 dark:text-red-400">{{ t('admin.siswa.detailError') }}:</p>
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
              {{ t('common.batal') }}
            </button>
            <button type="button" @click="handleImport" :disabled="importSubmitting || importPreview.length === 0"
              class="px-5 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
              <svg v-if="importSubmitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ importSubmitting ? t('common.menyimpan') : t('admin.siswa.importBtn') }}
            </button>
          </div>
          <div v-else class="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button type="button" @click="closeImportModal"
              class="px-4 py-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors">
              {{ t('common.tutup') }}
            </button>
            <button type="button" @click="openImport"
              class="px-5 py-2 text-xs text-white bg-blue-600 rounded-md hover:bg-blue-700 active:bg-blue-800">
              {{ t('admin.siswa.importLagi') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </AppLayout>
</template>

<style>
  .button-tutup {
    background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1));
  }

  .label-gray {
    text-transform: lowercase !important;
  }

  .label-gray::first-letter {
    text-transform: uppercase;

    /* Opsional: membuat huruf lebih besar */
  }

  .info-walikiri {
    border-right: 1px solid rgb(209 213 219 / var(--tw-border-opacity, 1));
  }
</style>