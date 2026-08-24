<script setup lang="ts">
interface AlphaItem {
  id: number
  nama: string
  kelas: string
  totalAlpha: number
  pelajaran?: { mapel: string; total: number; tanggal: string[] }[]
}

const { t } = useI18n()

// Murid yang sedang dilihat detail alphanya (modal)
const detailItem = ref<AlphaItem | null>(null)

// Jumlah chip pelajaran yang ditampilkan di tabel; sisanya lewat modal detail
const maxChips = 3

const selectedBulan = ref('')
const selectedKelas = ref<number | ''>('')

const appliedBulan = ref('')
const appliedKelas = ref<number | ''>('')

const { data: kelasList } = useFetch<{ id: number; nama: string }[]>('/api/admin/kelas', { immediate: true })

const queryParams = computed(() => ({
  ...(appliedBulan.value ? { bulan: appliedBulan.value } : {}),
  ...(appliedKelas.value ? { kelasId: appliedKelas.value } : {}),
}))

const { data, pending } = useFetch<AlphaItem[]>('/api/admin/alpha', {
  query: queryParams,
  immediate: true,
  transform: (res: any) => Array.isArray(res) ? res : []
})

const page = ref(1)
const pageSize = 10

watch([appliedBulan, appliedKelas], () => { page.value = 1 })

function applyFilter() {
  appliedBulan.value = selectedBulan.value
  appliedKelas.value = selectedKelas.value
}

function resetFilter() {
  selectedBulan.value = ''
  selectedKelas.value = ''
  appliedBulan.value = ''
  appliedKelas.value = ''
}

const totalPages = computed(() => Math.max(1, Math.ceil((data.value || []).length / pageSize)))
const visibleData = computed(() => {
  const start = (page.value - 1) * pageSize
  return (data.value || []).slice(start, start + pageSize)
})

const bulanOptions = computed(() => {
  const options = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })
    options.push({ value, label })
  }
  return options
})

const totalAlpha = computed(() => (data.value || []).reduce((a, b) => a + b.totalAlpha, 0))
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.alpha.title')" :description="t('admin.alpha.desc')" back-to="/admin" />

    <!-- Filter Area -->
    <div class="flex flex-wrap items-end gap-2.5 mb-5 bg-gray-50/60 dark:bg-slate-800/40 p-3 rounded-lg border border-gray-200/70 dark:border-slate-700/60">
      <!-- Filter: Periode Bulan -->
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ t('admin.alpha.periode') }}</label>
        <select v-model="selectedBulan"
          class="h-[34px] px-3 border border-gray-300 dark:border-slate-600 rounded-md text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow">
          <option value="">{{ t('admin.alpha.bulanBerjalan') }}</option>
          <option v-for="o in bulanOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>

      <!-- Filter: Kelas -->
      <div class="flex flex-col gap-1">
        <label class="text-[11px] font-medium text-gray-500 dark:text-gray-400">{{ t('admin.alpha.kelas') }}</label>
        <select v-model="selectedKelas"
          class="h-[34px] px-3 border border-gray-300 dark:border-slate-600 rounded-md text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow">
          <option :value="''">{{ t('admin.alpha.semuaKelas') }}</option>
          <option v-for="k in kelasList" :key="k.id" :value="k.id">{{ k.nama }}</option>
        </select>
      </div>

      <!-- Tombol Aksi Filter -->
      <div class="flex items-center gap-1.5 pt-1">
        <button @click="applyFilter()"
          class="h-[34px] inline-flex items-center gap-1.5 px-3.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 rounded-md transition-colors shadow-sm">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>{{ t('common.terapkan') }}</span>
        </button>

        <button
          @click="resetFilter()"
          class="h-[34px] inline-flex items-center gap-1.5 px-3 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md transition-colors shadow-sm"
          :title="t('common.aturUlang')">
          <svg class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{{ t('common.aturUlang') }}</span>
        </button>
      </div>
    </div>

    <LoadingSkeleton v-if="pending" type="table" :rows="6" :columns="5" />

    <template v-else>
      <!-- Stat Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div class="bg-white dark:bg-slate-800/90 rounded-lg border border-gray-200/80 dark:border-slate-700/80 border-l-[3px] border-l-red-500 px-4 py-3.5">
          <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <svg class="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('admin.alpha.statTotalAlpha') }}</span>
          </div>
          <div class="mt-1.5 flex items-baseline gap-2">
            <span class="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400 font-mono">{{ totalAlpha }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('admin.alpha.unitJamPelajaran') }}</span>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800/90 rounded-lg border border-gray-200/80 dark:border-slate-700/80 border-l-[3px] border-l-primary-500 px-4 py-3.5">
          <div class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <svg class="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('admin.alpha.statMuridAlpha') }}</span>
          </div>
          <div class="mt-1.5 flex items-baseline gap-2">
            <span class="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 font-mono">{{ (data || []).length }}</span>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('admin.alpha.unitSiswa') }}</span>
          </div>
        </div>
      </div>

      <!-- Container Tabel -->
      <div class="bg-white dark:bg-slate-800/95 rounded-lg border border-gray-200/90 dark:border-slate-700/80 overflow-hidden">
        <div class="overflow-x-auto scrollbar-thin">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/60">
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[24%]">{{ t('admin.alpha.colNama') }}</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell w-[13%]">{{ t('admin.alpha.colKelas') }}</th>
                <th class="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 hidden md:table-cell w-[47%]">{{ t('admin.alpha.colPelajaran') }}</th>
                <th class="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[8%]">{{ t('admin.alpha.colTotal') }}</th>
                <th class="text-center px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 w-[8%]">{{ t('admin.alpha.colAksi') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-700/60">
              <tr v-for="(item, idx) in visibleData" :key="item.id"
                class="transition-colors hover:bg-primary-50/30 dark:hover:bg-slate-700/40"
                :class="idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-800'">
                <td class="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{{ item.nama }}</td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell font-medium">
                  {{ item.kelas }}
                </td>
                <td class="px-4 py-3 hidden md:table-cell">
                  <div v-if="item.pelajaran?.length" class="text-gray-600 dark:text-gray-300 leading-relaxed">
                    <template v-for="(p, pIdx) in (item.pelajaran || []).slice(0, maxChips)" :key="p.mapel">
                      <span>{{ p.mapel }}</span>
                      <span class="text-red-600 dark:text-red-400 font-semibold font-mono ml-0.5">({{ p.total }})</span><span v-if="pIdx < Math.min((item.pelajaran || []).length, maxChips) - 1" class="mr-1.5 text-gray-400">,</span>
                    </template>
                    <button
                      v-if="(item.pelajaran || []).length > maxChips"
                      @click="detailItem = item"
                      :title="t('admin.alpha.lihatDetailTitle', { name: item.nama })"
                      class="ml-1.5 inline-flex items-center text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline transition-colors">
                      {{ t('admin.alpha.lainnya', { count: (item.pelajaran || []).length - maxChips }) }}
                    </button>
                  </div>
                  <span v-else class="text-gray-400 dark:text-gray-500">-</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="font-bold text-red-600 dark:text-red-400 font-mono">{{ item.totalAlpha }}×</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-center">
                    <button @click="detailItem = item"
                      class="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-slate-700/60 rounded-md transition-colors"
                      :title="t('admin.alpha.lihatDetailTitle', { name: item.nama })">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!data || data.length === 0">
                <td colspan="5" class="px-4 py-16 text-center">
                  <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('admin.alpha.empty') }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="(data || []).length > pageSize" class="px-4 sm:px-6 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3 bg-gray-50/30 dark:bg-slate-800/50">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize, (data || []).length), total: (data || []).length, unit: t('admin.siswa.unitMurid') }) }}
          </p>
          <div class="ml-auto flex items-center gap-2">
            <button
              @click="page--"
              :disabled="page <= 1"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              {{ t('common.sebelumnya') }}
            </button>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('common.halaman', { page, total: totalPages }) }}</span>
            <button
              @click="page++"
              :disabled="page >= totalPages"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {{ t('common.selanjutnya') }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal Detail Alpha per Murid -->
    <BaseModal
      :show="!!detailItem"
      :title="detailItem ? t('admin.alpha.modalTitle', { name: detailItem.nama }) : ''"
      max-width="max-w-lg"
      @close="detailItem = null"
    >
      <div v-if="detailItem" class="space-y-4">
        <!-- Ringkasan murid -->
        <div class="flex items-center gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ detailItem.nama }}</p>
            <p class="text-xs text-gray-400 dark:text-gray-500">
              {{ t('admin.alpha.modalSummary', { kelas: detailItem.kelas, count: detailItem.totalAlpha }) }}
            </p>
          </div>
        </div>

        <!-- Rincian per pelajaran -->
        <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-700">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50/75 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700">
                <th class="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 w-1/3">{{ t('admin.alpha.modalColMapel') }}</th>
                <th class="text-center px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 w-20">{{ t('admin.alpha.modalColJumlah') }}</th>
                <th class="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('admin.alpha.modalColTanggal') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-700/60">
              <tr v-for="(p, idx) in detailItem.pelajaran || []" :key="p.mapel"
                class="transition-colors"
                :class="idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-800'">
                <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{{ p.mapel }}</td>
                <td class="px-4 py-2.5 text-center font-bold text-red-600 dark:text-red-400 font-mono">
                  {{ p.total }}×
                </td>
                <td class="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-mono text-[11px]">{{ p.tanggal.join(', ') }}</td>
              </tr>
              <tr v-if="!detailItem.pelajaran?.length">
                <td colspan="3" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">{{ t('admin.alpha.modalEmpty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <template #footer>
        <button
          @click="detailItem = null"
          class="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
        >
          {{ t('common.tutup') }}
        </button>
      </template>
    </BaseModal>
  </AppLayout>
</template>
