<script setup lang="ts">
import type { ExportCardItem } from '~/components/ExportFilterModal.vue'

const { t } = useI18n()

interface ExportSection {
  title: string
  description: string
  items: ExportCardItem[]
}

const exportSections = computed<ExportSection[]>(() => [
  {
    title: t('admin.export.sectionRekap'),
    description: t('admin.export.descRekap'),
    items: [
      {
        id: 'rekap-harian',
        label: t('admin.export.rekapHarian'),
        description: t('admin.export.descRekapHarian'),
        requiresDateSingle: true,
        requiresClassMulti: true,
      },
      {
        id: 'rekap-bulanan',
        label: t('admin.export.rekapBulanan'),
        description: t('admin.export.descRekapBulanan'),
        requiresMonth: true,
        requiresClassMulti: true,
      },
      {
        id: 'rekap-kelas',
        label: t('admin.export.rekapKelas'),
        description: t('admin.export.descRekapKelas'),
        requiresDateRange: true,
        requiresClassMulti: true,
      },
      {
        id: 'rekap-sesi',
        label: t('admin.export.rekapSesi'),
        description: t('admin.export.descRekapSesi'),
        requiresDateSingle: true,
        requiresClassSingle: true,
        requiresSessionSelect: true,
      },
      {
        id: 'rekap-semester',
        label: t('admin.export.rekapSemester'),
        description: t('admin.export.descRekapSemester'),
        requiresSemester: true,
        requiresClassMulti: true,
      },
      {
        id: 'rekap-individu',
        label: t('admin.export.rekapIndividu'),
        description: t('admin.export.descRekapIndividu'),
        requiresStudentSearch: true,
        requiresDateRange: true,
      },
    ],
  },
  {
    title: t('admin.export.sectionPersetujuan'),
    description: t('admin.export.descPersetujuan'),
    items: [
      {
        id: 'rekap-izin',
        label: t('admin.export.rekapIzin'),
        description: t('admin.export.descRekapIzin'),
        requiresDateRange: true,
        requiresStatusIzin: true,
      },
    ],
  },
  {
    title: t('admin.export.sectionSekolah'),
    description: t('admin.export.descSekolah'),
    items: [
      {
        id: 'data-siswa',
        label: t('admin.export.dataSiswa'),
        description: t('admin.export.descDataSiswa'),
        requiresClassSingle: true,
      },
      {
        id: 'data-guru',
        label: t('admin.export.dataGuru'),
        description: t('admin.export.descDataGuru'),
      },
      {
        id: 'data-kelas',
        label: t('admin.export.dataKelas'),
        description: t('admin.export.descDataKelas'),
      },
    ],
  },
])

// Modal & export state
const activeCard = ref<ExportCardItem | null>(null)
const isModalOpen = ref(false)
const exporting = ref<string | null>(null)
const errorMsg = ref('')
const successMsg = ref('')

// History fetch
const { data: historyList, pending: historyPending, refresh: refreshHistory } = useFetch<any[]>('/api/admin/export/history', {
  immediate: true,
})

// History pagination state
const historyPage = ref(1)
const historyPageSize = 10

const totalHistoryPages = computed(() => Math.max(1, Math.ceil(((historyList.value || []).length) / historyPageSize)))

const historyPageNumbers = computed<(number | '...')[]>(() => {
  const total = totalHistoryPages.value
  const current = historyPage.value
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

const visibleHistoryList = computed(() => {
  const list = historyList.value || []
  const start = (historyPage.value - 1) * historyPageSize
  return list.slice(start, start + historyPageSize)
})

watch(historyList, () => {
  if (historyPage.value > totalHistoryPages.value) {
    historyPage.value = 1
  }
})

function openFilterModal(card: ExportCardItem) {
  const hasFilters = card.requiresDateSingle ||
    card.requiresDateRange ||
    card.requiresMonth ||
    card.requiresSemester ||
    card.requiresClassMulti ||
    card.requiresClassSingle ||
    card.requiresStudentSearch ||
    card.requiresSessionSelect ||
    card.requiresStatusIzin

  if (!hasFilters) {
    handleDirectExport(card)
    return
  }

  activeCard.value = card
  isModalOpen.value = true
}

async function handleDirectExport(card: ExportCardItem) {
  await executeExport({
    jenis: card.id,
    format: 'xlsx',
    filters: {}
  }, card.label)
}

async function handleModalSubmit(payload: { jenis: string; format: 'xlsx'; filters: any }) {
  const cardLabel = activeCard.value?.label || payload.jenis
  isModalOpen.value = false
  await executeExport(payload, cardLabel)
}

async function executeExport(payload: { jenis: string; format: 'xlsx'; filters: any }, label: string) {
  exporting.value = payload.jenis
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const res = await $fetch<Blob>('/api/admin/export/generate', {
      method: 'POST',
      body: payload,
      responseType: 'blob' as any
    })

    const url = URL.createObjectURL(res)
    const a = document.createElement('a')
    a.href = url
    a.download = `${payload.jenis}-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    successMsg.value = t('admin.export.msgBerhasil', { label })
    await refreshHistory()
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage || err?.message || t('admin.export.msgGagal')
  } finally {
    exporting.value = null
  }
}

async function handleReDownload(historyItem: any) {
  exporting.value = `re-${historyItem.id}`
  errorMsg.value = ''
  successMsg.value = ''

  try {
    const res = await $fetch<Blob>(`/api/admin/export/history/${historyItem.id}/download`, {
      responseType: 'blob' as any
    })

    const url = URL.createObjectURL(res)
    const a = document.createElement('a')
    a.href = url
    a.download = historyItem.fileName || `${historyItem.jenis}-${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    successMsg.value = t('admin.export.msgBerhasil', { label: historyItem.judul || historyItem.jenis })
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage || err?.message || t('admin.export.msgGagal')
  } finally {
    exporting.value = null
  }
}

function formatDateDisplay(dStr: string) {
  if (!dStr) return '-'
  try {
    const date = new Date(dStr)
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dStr
  }
}
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.export.title')" :description="t('admin.export.desc')" />

    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />
    <Notification type="error" :message="errorMsg" :show="!!errorMsg" @dismiss="errorMsg = ''" />

    <!-- Section Groups (Single Container per Section with List Items) -->
    <div class="space-y-6">
      <div v-for="section in exportSections" :key="section.title">
        <div class="mb-2">
          <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {{ section.title }}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ section.description }}</p>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg border admin-accent-border divide-y divide-gray-100 dark:divide-slate-700/60 overflow-hidden">
          <div
            v-for="opt in section.items"
            :key="opt.id"
            @click="openFilterModal(opt)"
            class="group px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
            :class="{ 'opacity-50 pointer-events-none': !!exporting }"
          >
            <div class="flex items-center gap-3.5 min-w-0">
              <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div class="min-w-0">
                <h3 class="text-xs font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {{ opt.label }}
                </h3>
                <p class="text-[12px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {{ opt.description }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-shrink-0">
              <svg v-if="exporting === opt.id" class="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else class="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Riwayat Ekspor Section -->
      <div class="pt-2">
        <div class="mb-2 flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ t('admin.export.sectionRiwayat') }}
            </h2>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('admin.export.descRiwayat') }}</p>
          </div>
          <button
            type="button"
            @click="refreshHistory"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700/60 rounded transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Segarkan</span>
          </button>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg border admin-accent-border overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-xs text-left">
              <thead class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border text-gray-600 dark:text-gray-400 font-medium">
                <tr>
                  <th class="px-4 py-2.5">{{ t('admin.export.colLaporan') }}</th>
                  <th class="px-4 py-2.5">{{ t('admin.export.colFilter') }}</th>
                  <th class="px-4 py-2.5">{{ t('admin.export.colWaktu') }}</th>
                  <th class="px-4 py-2.5 text-right">{{ t('admin.export.colAksi') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-slate-700/60 text-gray-600 dark:text-gray-300">
                <tr v-if="historyPending && (!historyList || historyList.length === 0)">
                  <td colspan="4" class="px-4 py-8 text-center text-gray-400">
                    <div class="flex items-center justify-center gap-2">
                      <svg class="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Memuat riwayat...</span>
                    </div>
                  </td>
                </tr>
                <tr v-else-if="!historyList || historyList.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    {{ t('admin.export.emptyRiwayat') }}
                  </td>
                </tr>
                <tr
                  v-for="item in visibleHistoryList"
                  :key="item.id"
                  class="hover:bg-gray-50/75 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td class="px-4 py-2.5">
                    <div class="font-medium text-gray-900 dark:text-gray-100">{{ item.judul || item.jenis }}</div>
                    <div class="text-[10px] font-mono text-gray-400 truncate max-w-xs">{{ item.fileName }}</div>
                  </td>
                  <td class="px-4 py-2.5 text-gray-600 dark:text-gray-300 text-[11px]">
                    {{ item.filterLabel }}
                  </td>
                  <td class="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap text-[11px]">
                    <div>{{ formatDateDisplay(item.createdAt) }}</div>
                    <div class="text-[10px] text-gray-400">oleh {{ item.userName }}</div>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      @click="handleReDownload(item)"
                      :disabled="exporting === `re-${item.id}`"
                      :title="t('admin.export.btnUnduhUlang')"
                      class="inline-flex items-center justify-center p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                    >
                      <svg v-if="exporting === `re-${item.id}`" class="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar Riwayat -->
          <div
            v-if="(historyList || []).length > historyPageSize"
            class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3"
          >
            <p class="text-xs text-gray-400 dark:text-gray-500">
              {{ t('common.menampilkan', { from: ((historyPage - 1) * historyPageSize) + 1, to: Math.min(historyPage * historyPageSize, (historyList || []).length), total: (historyList || []).length, unit: t('admin.export.unitRiwayat') }) }}
            </p>
            <div class="ml-auto flex items-center gap-2">
              <button
                @click="historyPage--"
                :disabled="historyPage <= 1"
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                {{ t('common.sebelumnya') }}
              </button>
              <div class="flex items-center gap-1">
                <template v-for="(n, i) in historyPageNumbers" :key="i">
                  <button
                    v-if="n !== '...'"
                    @click="historyPage = n"
                    :disabled="n === historyPage"
                    :class="n === historyPage
                      ? 'w-7 h-7 rounded-md text-xs text-white bg-primary-600 ring-1 ring-primary-600 cursor-default'
                      : 'w-7 h-7 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors'"
                  >
                    {{ n }}
                  </button>
                  <span v-else class="px-0.5 text-xs text-gray-400 dark:text-gray-500 select-none">&hellip;</span>
                </template>
              </div>
              <button
                @click="historyPage++"
                :disabled="historyPage >= totalHistoryPages"
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
      </div>
    </div>

    <!-- Modal Filter Generik -->
    <ExportFilterModal
      :show="isModalOpen"
      :card="activeCard"
      :loading="!!exporting"
      @close="isModalOpen = false"
      @submit="handleModalSubmit"
    />
  </AppLayout>
</template>
