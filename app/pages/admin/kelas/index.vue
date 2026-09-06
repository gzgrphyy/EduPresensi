<script setup lang="ts">
  interface Kelas {
    id: number
    nama: string
    waliKelasId: number | null
    semesterId: number
    waliKelas: { id: number; nama: string; jenisKelamin: string | null; foto: string | null } | null
    semester: { id: number; nama: string; kodeAngka: number | null; pakaiRomawi: boolean; tahunAjaran: { id: number; nama: string } }
    _count: { siswa: number; jadwalPelajaran: number }
  }

  const { t } = useI18n()

  function jenisKelaminLabel(jk: string | null) {
    if (jk === 'LAKI_LAKI') return t('admin.guru.jenisKelaminL')
    if (jk === 'PEREMPUAN') return t('admin.guru.jenisKelaminP')
    return ''
  }

  const searchQuery = ref('')
  const draftJenjang = ref('')
  const draftKelas = ref('')

  const appliedJenjang = ref('')
  const appliedKelas = ref('')

  const page = ref(1)
  const pageSize = 10

  function jenjangOf(nama: string) {
    return (nama.match(/^[IVXLCDM]+/)?.[0] || '').toUpperCase()
  }

  const { data: kelasList, pending, refresh } = useFetch < Kelas[] > (() => {
    const params = new URLSearchParams()
    if (searchQuery.value) params.set('search', searchQuery.value)
    return `/api/admin/kelas?${params.toString()}`
  }, { immediate: true })

  const jenjangList = computed(() => {
    const set = new Set < string > ()
    for (const k of kelasList.value || []) {
      const j = jenjangOf(k.nama)
      if (j) set.add(j)
    }
    return [...set].sort()
  })

  const kelasOptions = computed(() => {
    const list = kelasList.value || []
    if (!draftJenjang.value) return list
    return list.filter(k => jenjangOf(k.nama) === draftJenjang.value)
  })

  watch(draftJenjang, () => { draftKelas.value = '' })

  const filteredData = computed(() => {
    const list = kelasList.value || []
    const byJenjang = appliedJenjang.value ? list.filter(k => jenjangOf(k.nama) === appliedJenjang.value) : list
    if (!appliedKelas.value) return byJenjang
    return byJenjang.filter(k => k.nama === appliedKelas.value)
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize)))
  const visibleData = computed(() => {
    const start = (page.value - 1) * pageSize
    return filteredData.value.slice(start, start + pageSize)
  })

  watch([searchQuery, appliedJenjang, appliedKelas], () => { page.value = 1 })

  function applyFilter() {
    appliedJenjang.value = draftJenjang.value
    appliedKelas.value = draftKelas.value
  }

  function resetFilter() {
    searchQuery.value = ''
    draftJenjang.value = ''
    draftKelas.value = ''
    appliedJenjang.value = ''
    appliedKelas.value = ''
  }
  const { data: guruList } = useFetch < { id: number; nama: string }[] > ('/api/admin/guru', { immediate: true })
  const { data: semesterList } = useFetch < { id: number; nama: string; kodeAngka: number | null; pakaiRomawi: boolean; isActive: boolean; tahunAjaran: { id: number; nama: string } }[] > ('/api/admin/semester', { immediate: true })

  const showModal = ref(false)
  const editing = ref < Kelas | null > (null)
  const form = ref({ nama: '', waliKelasId: 0, semesterId: 0 })
  const saving = ref(false)
  const errorMsg = ref('')
  const successMsg = ref('')
  const confirmDelete = ref < { id: number; nama: string } | null > (null)
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

  const activeSemester = computed(() => semesterList.value?.find(s => s.isActive))

  function openCreate() {
    editing.value = null
    form.value = { nama: '', waliKelasId: 0, semesterId: activeSemester.value?.id || 0 }
    errorMsg.value = ''
    dirtyForm.value = false
    showModal.value = true
  }

  function openEdit(item: Kelas) {
    editing.value = item
    form.value = {
      nama: item.nama,
      waliKelasId: item.waliKelasId || 0,
      semesterId: item.semesterId
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
      if (editing.value) {
        const body: Record<string, unknown> = {}
        if (form.value.nama !== editing.value.nama) body.nama = form.value.nama
        if ((form.value.waliKelasId || null) !== editing.value.waliKelasId) body.waliKelasId = form.value.waliKelasId || null
        if (form.value.semesterId !== editing.value.semesterId) body.semesterId = form.value.semesterId

        if (Object.keys(body).length === 0) { showModal.value = false; return }

        const { error } = await useFetch(`/api/admin/kelas/${editing.value.id}`, { method: 'PATCH', body })
        if (error.value) { showError(error.value.statusMessage || 'Gagal menyimpan'); return }
        showSuccess(t('admin.kelas.msgBerhasilEdit'))
      } else {
        const { error } = await useFetch('/api/admin/kelas', {
          method: 'POST',
          body: {
            nama: form.value.nama,
            waliKelasId: form.value.waliKelasId || undefined,
            semesterId: form.value.semesterId
          }
        })
        if (error.value) { showError(error.value.statusMessage || 'Gagal menyimpan'); return }
        showSuccess(t('admin.kelas.msgBerhasilTambah'))
      }
      showModal.value = false
      confirmClose.value = false
      await refresh()
    } finally { saving.value = false }
  }

  function promptDelete(item: Kelas) {
    confirmDelete.value = { id: item.id, nama: item.nama }
  }

  async function handleDelete() {
    if (!confirmDelete.value) return
    const { id } = confirmDelete.value
    confirmDelete.value = null
    const { error } = await useFetch(`/api/admin/kelas/${id}`, { method: 'DELETE' })
    if (error.value) { showError(error.value.statusMessage || 'Gagal menghapus'); return }
    showSuccess(t('admin.kelas.msgBerhasilHapus'))
    await refresh()
  }

  const guruOptions = computed(() => {
    const opts = [{ id: 0, text: t('common.tidakAda') }]
    for (const g of guruList.value || []) {
      opts.push({ id: g.id, text: g.nama })
    }
    return opts
  })
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.kelas.title')" :description="t('admin.kelas.desc')" />

    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" :placeholder="t('admin.kelas.searchPlaceholder')"
            class="pl-9 pr-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </div>
        <select v-model="draftJenjang"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">{{ t('admin.kelas.semuaJenjang') }}</option>
          <option v-for="j in jenjangList" :key="j" :value="j">{{ j }}</option>
        </select>
        <select v-model="draftKelas"
          class="px-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">{{ t('admin.kelas.semuaKelas') }}</option>
          <option v-for="k in kelasOptions" :key="k.id" :value="k.nama">{{ k.nama }}</option>
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
      <button @click="openCreate"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs ">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        <span class="hidden sm:inline">{{ t('admin.kelas.tambahKelas') }}</span>
      </button>
    </div>

    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />
    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="5" />

    <div v-else class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
      <div class="overflow-x-auto scrollbar-thin">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
              <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.kelas.colNama') }}</th>
              <th
                class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell">
                {{ t('admin.kelas.colWali') }}</th>
              <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.kelas.colMurid') }}</th>
              <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{
                t('admin.tahunAjaran.colAksi') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y admin-accent-divide">
            <tr v-for="item in visibleData" :key="item.id"
              class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
              <td class="px-4 py-3">
                <NuxtLink :to="`/admin/kelas/${item.id}`"
                  class="text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  :title="t('admin.kelas.lihatDetail')">
                  {{ item.nama }}
                </NuxtLink>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <div v-if="item.waliKelas" class="min-w-0">
                  <span class="text-gray-600 dark:text-gray-300">{{ item.waliKelas.nama }}</span>
                  <div v-if="item.waliKelas.jenisKelamin" class="text-xs text-gray-400 dark:text-gray-500">
                    {{ jenisKelaminLabel(item.waliKelas.jenisKelamin) }}
                  </div>
                </div>
                <span v-else class="text-gray-600 dark:text-gray-300">-</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span class="text-gray-700 dark:text-gray-200 ">{{ item._count.siswa }}</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-center gap-1">
                  <NuxtLink :to="`/admin/kelas/${item.id}`"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    :title="t('admin.kelas.lihatDetail')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </NuxtLink>
                  <button @click="openEdit(item)"
                    class="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                    :title="t('common.edit')">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
            <tr v-if="filteredData.length === 0">
              <td colspan="4" class="px-4 py-16 text-center">
                <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p class="text-gray-500 dark:text-gray-400 ">{{ t('admin.kelas.empty') }}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="filteredData.length > pageSize"
        class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize,
          filteredData.length), total: filteredData.length, unit: t('admin.kelas.unitKelas') }) }}
        </p>
        <div class="ml-auto flex items-center gap-2">
          <button @click="page--" :disabled="page <= 1"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            {{ t('common.sebelumnya') }}
          </button>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('common.halaman', { page, total: totalPages })
            }}</span>
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

    <!-- Modal -->
    <BaseModal :show="showModal" :title="editing ? t('admin.kelas.modalEdit') : t('admin.kelas.modalCreate')"
      @close="handleCloseClick">
      <form @submit.prevent="handleSave" class="space-y-4">
        <BaseFormField :label="t('admin.kelas.labelNama')" required>
          <input v-model="form.nama" type="text" @input="onFormChange" required
            :placeholder="t('admin.kelas.placeholderNama')"
            class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </BaseFormField>


        <BaseFormField :label="t('admin.kelas.labelWali')">
          <SearchableSelect v-model="form.waliKelasId" :options="guruOptions"
            :placeholder="t('common.tidakAda')" @change="onFormChange" />
        </BaseFormField>

        <BaseFormField :label="t('admin.kelas.labelTa')" required>
          <select v-model="form.semesterId" @change="onFormChange" required
            class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-primary-500 bg-white">
            <option v-for="s in semesterList" :key="s.id" :value="s.id">{{ s.tahunAjaran.nama }} ({{ semesterFullLabel(s, t) }})
            </option>
          </select>
        </BaseFormField>
      </form>
      <template #footer>
        <button type="button" @click="handleCloseClick"
          class="px-4 py-2 text-xs  text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">{{
          t('common.batal') }}</button>
        <button type="submit" @click="handleSave" :disabled="saving"
          class="px-5 py-2 text-xs  text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
          <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ saving ? t('common.menyimpan') : t('common.simpan') }}
        </button>
      </template>
    </BaseModal>

    <ConfirmDialog :show="!!confirmDelete" :title="t('admin.kelas.confirmDeleteTitle')"
      :message="t('admin.kelas.confirmDeleteMsg', { nama: confirmDelete?.nama })" variant="danger"
      @confirm="handleDelete" @cancel="confirmDelete = null" />
  </AppLayout>
</template>

<style>
  select {
    appearance: none !important;
    -webkit-appearance: none !important;
    -moz-appearance: none !important;
    padding: 10px 40px 10px 15px !important;
    /* Atur jarak kanan lebih besar */
    background-image: url('/icon/down.png') !important;
    /* Masukkan ikon SVG */
    background-repeat: no-repeat !important;
    background-position: right 15px center !important;
    /* Mengatur posisi jarak ikon */
    background-size: 14px;
  }
</style>