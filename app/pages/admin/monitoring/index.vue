<script setup lang="ts">
const { t } = useI18n()

interface MonitoringResponse {
  rooms: MonitoringItem[]
  totalRuangan: number
  totalSesiAktif: number
  totalMuridAktif: number
  totalSudahAbsenAktif: number
  partisipasiPersen: number
}

interface MonitoringItem {
  ruangan: string
  totalSiswa: number
  sudahAbsen: number
  belumAbsen: number
  status: string
}

const { data, pending, refresh } = useFetch<MonitoringResponse>('/api/admin/monitoring', {
  immediate: true,
  transform: (res: any) => Array.isArray(res?.rooms) ? res : { rooms: [] }
})

const displayData = computed(() => data.value?.rooms || [])

const totalRuangan = computed(() => data.value?.totalRuangan ?? 0)
const totalSesiAktif = computed(() => data.value?.totalSesiAktif ?? 0)
const partisipasiPersen = computed(() => data.value?.partisipasiPersen ?? 0)

const searchQuery = ref('')
const page = ref(1)
const pageSize = 10

const filteredData = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return displayData.value
  return displayData.value.filter((item) =>
    item.ruangan.toLowerCase().includes(q)
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / pageSize)))
const visibleData = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredData.value.slice(start, start + pageSize)
})

watch(searchQuery, () => { page.value = 1 })

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

watch(() => displayData.value.length, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

function statusLabel(status: string) {
  if (status === 'AKTIF') return t('admin.monitoring.status.AKTIF')
  if (status === 'TIDAK AKTIF') return t('admin.monitoring.status.TIDAK AKTIF')
  return status
}

// Auto-refresh every 15 seconds for real-time monitoring
onMounted(() => {
  const interval = setInterval(() => refresh(), 15000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.monitoring.title')" :description="t('admin.monitoring.desc')">
      <template #actions>
        <div class="flex items-center gap-3 text-xs text-gray-500">
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            {{ t('admin.monitoring.langsung') }}
          </div>
          <span class="text-[10px] px-1.5 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 ">{{ t('admin.monitoring.hariIni') }}</span>
        </div>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="pending" type="table" :rows="4" :columns="5" />

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-4 mb-5">
        <div class="bg-white dark:bg-slate-800 rounded-lg border admin-accent-border p-5 mb-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <p class="text-[12px] text-gray-500 dark:text-gray-400 tracking-wider">{{ t('admin.monitoring.statRuanganAktif') }}</p>
            </div>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
              <circle cx="12" cy="12" r="2" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
            </svg>
          </div>
          <p class="text-2xl text-gray-900 dark:text-gray-100 mt-2">
            {{ totalSesiAktif }} <span class="text-sm text-gray-400">{{ t('common.dari') }} {{ totalRuangan }}</span>
          </p>
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-lg border admin-accent-border p-5 mb-6">
          <p class="text-[12px] text-gray-500 dark:text-gray-400 tracking-wider">{{ t('admin.monitoring.statPartisipasiHariIni') }}</p>
          <p class="text-2xl mt-2" style="color: rgb(var(--text-accent))">{{ partisipasiPersen }}%</p>
          <div class="mt-3 h-[6px] rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" :style="{ width: partisipasiPersen + '%', backgroundColor: 'rgb(var(--fill-accent))' }"></div>
          </div>
        </div>
      </div>

      <!-- Search -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="relative flex-1 max-w-xs -mt-6">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchQuery" type="text" :placeholder="t('admin.monitoring.searchPlaceholder')"
            class="w-full pl-9 pr-3 py-2 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
        </div>
      </div>

      <BaseCard>
        <div class="overflow-x-auto scrollbar-thin">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th class="text-left px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.monitoring.colRuangan') }}</th>
                <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.monitoring.colTotalMurid') }}</th>
                <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.monitoring.colSudahAbsen') }}</th>
                <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.monitoring.colBelumAbsen') }}</th>
                <th class="text-center px-4 py-3  text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.monitoring.colStatus') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="item in visibleData" :key="item.ruangan" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="px-4 py-3  text-gray-900 dark:text-gray-100">{{ item.ruangan }}</td>
                <td class="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{{ item.totalSiswa }}</td>
                <td class="px-4 py-3 text-center text-green-600 dark:text-green-400 ">{{ item.sudahAbsen }}</td>
                <td class="px-4 py-3 text-center text-amber-600 dark:text-amber-400 ">{{ item.belumAbsen }}</td>
                <td class="px-4 py-3 text-center">
                  <BaseBadge :variant="item.status === 'AKTIF' ? 'green' : 'gray'" :dot="item.status === 'AKTIF'">
                    {{ statusLabel(item.status) }}
                  </BaseBadge>
                </td>
              </tr>
              <tr v-if="filteredData.length === 0">
                <td colspan="5" class="px-4 py-16 text-center">
                  <p class="text-gray-500 ">{{ t('admin.monitoring.empty') }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="displayData.length > pageSize"
          class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize,
            displayData.length), total: displayData.length, unit: t('admin.monitoring.unitRuangan') }) }}
          </p>
          <div class="ml-auto flex items-center gap-2">
            <button @click="page--" :disabled="page <= 1"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              {{ t('common.sebelumnya') }}
            </button>
            <div class="flex items-center gap-1">
              <template v-for="(n, i) in pageNumbers" :key="i">
                <button v-if="n !== '...'" @click="page = n" :disabled="n === page"
                  :class="n === page
                    ? 'w-7 h-7 rounded-md text-xs text-white bg-primary-600 ring-1 ring-primary-600 cursor-default'
                    : 'w-7 h-7 rounded-md text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 transition-colors'">
                  {{ n }}
                </button>
                <span v-else class="px-0.5 text-xs text-gray-400 dark:text-gray-500 select-none">&hellip;</span>
              </template>
            </div>
            <button @click="page++" :disabled="page >= totalPages"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-800 hover:bg-primary-100 dark:hover:bg-primary-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {{ t('common.selanjutnya') }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </BaseCard>
    </template>
  </AppLayout>
</template>
