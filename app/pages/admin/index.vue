<script setup lang="ts">
const { t, locale } = useI18n()

interface DashboardData {
  jumlahPtk: number
  jumlahMurid: number
  jumlahKelas: number
  totalRuangan: number
  ruanganAktif: number
  hadir: number
  sakit: number
  izin: number
  alpha: number
  persentase: number
  topAlpha: { nama: string; kelas: string; totalAlpha: number }[]
  monitoring: { ruangan: string; status: string; sesi: string; ptk: string }[]
  aktivitasTerbaru: { waktu: string; aksi: string; detail: string }[]
}

const { data, pending } = useFetch<DashboardData>('/api/admin/dashboard', { immediate: true })

const totalScan = computed(() => {
  if (!data.value) return 0
  return data.value.hadir + data.value.sakit + data.value.izin + data.value.alpha
})

const todayLabel = computed(() => new Date().toLocaleDateString(locale.value === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }))

function statusLabel(status: string) {
  if (status === 'Aktif' || status === 'Tidak Aktif') return t(`admin.beranda.status.${status}`)
  return status
}

function aksiLabel(aksi: string) {
  return aksi.includes('dibuka') ? t('admin.beranda.aksiDibuka') : t('admin.beranda.aksiDitutup')
}

const aktivitasPage = ref(1)
const aktivitasPageSize = 10

const aktivitasTotalPages = computed(() => Math.max(1, Math.ceil((data.value?.aktivitasTerbaru.length || 0) / aktivitasPageSize)))

const aktivitasPageNumbers = computed<(number | '...')[]>(() => {
  const total = aktivitasTotalPages.value
  const current = aktivitasPage.value
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

const visibleAktivitas = computed(() => {
  const list = data.value?.aktivitasTerbaru || []
  const start = (aktivitasPage.value - 1) * aktivitasPageSize
  return list.slice(start, start + aktivitasPageSize)
})
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.beranda.title')" :description="t('admin.beranda.desc')" :show-back="false">
      <template #actions>
        <div class="flex items-center gap-3 text-xs text-gray-500 self-end pb-0.5">
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            {{ t('admin.beranda.langsung') }}
          </div>
        </div>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="5" />

    <template v-else-if="data">
      <!-- SECTION 1: Data Sekolah (angka statis) -->
      <div class="mb-6">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <!-- PTK -->
          <div class="rounded-lg border admin-accent-border bg-white dark:bg-slate-800 p-3">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div class="min-w-0">
                <p class="text-[12px] text-gray-500 dark:text-gray-400 tracking-wider truncate">{{ t('admin.beranda.statJumlahPtk') }}</p>
                <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ data.jumlahPtk }}</p>
              </div>
            </div>
          </div>

          <!-- Murid -->
          <div class="rounded-lg border admin-accent-border bg-white dark:bg-slate-800 p-3">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-3.4-3.4 9.337 9.337 0 00-3.763.303m-5.354.93A4.125 4.125 0 0012 16.125a4.125 4.125 0 00-3.4 3.4 9.337 9.337 0 00-3.763-.303m5.354-.93a9.337 9.337 0 00-2.625-.372 9.337 9.337 0 00-4.121.952 4.125 4.125 0 003.4 3.4 9.337 9.337 0 003.763-.303M12 12.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
              </svg>
              <div class="min-w-0">
                <p class="text-[12px] text-gray-500 dark:text-gray-400 tracking-wider truncate">{{ t('admin.beranda.statJumlahMurid') }}</p>
                <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ data.jumlahMurid }}</p>
              </div>
            </div>
          </div>

          <!-- Kelas -->
          <div class="rounded-lg border admin-accent-border bg-white dark:bg-slate-800 p-3">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25A2.25 2.25 0 0110.5 10.5H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
              </svg>
              <div class="min-w-0">
                <p class="text-[12px] text-gray-500 dark:text-gray-400 tracking-wider truncate">{{ t('admin.beranda.statJumlahKelas') }}</p>
                <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ data.jumlahKelas }}</p>
              </div>
            </div>
          </div>

          <!-- Ruangan (dengan sub-info ruangan aktif) -->
          <div class="rounded-lg border admin-accent-border bg-white dark:bg-slate-800 p-3">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 -translate-y-1 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0v3.75a2.25 2.25 0 01-2.25 2.25h-6a2.25 2.25 0 01-2.25-2.25V9.75A2.25 2.25 0 0113.5 7.5h.75v-3h-.75A2.25 2.25 0 009.75 3H3v18h6.75a2.25 2.25 0 002.25-2.25V7.5h3v3z" />
              </svg>
              <div class="min-w-0">
                <p class="text-[12px] text-gray-500 dark:text-gray-400 tracking-wider truncate">{{ t('admin.beranda.statTotalRuangan') }}</p>
                <p class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ data.totalRuangan }}</p>
                <p class="text-[10px] text-green-600 dark:text-green-400">{{ data.ruanganAktif }} {{ t('admin.beranda.statRuanganAktif') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECTION 2: Kehadiran Hari Ini (satu card combined) -->
      <div class="bg-white dark:bg-slate-800 rounded-lg border admin-accent-border p-5 mb-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ t('admin.beranda.kehadiranHariIni') }}</h3>
            <p class="text-xs text-gray-400 dark:text-gray-500">{{ todayLabel }}</p>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-6">
          <!-- Hero Number: Persentase -->
          <div class="flex-shrink-0 flex flex-col items-center justify-center sm:w-36">
            <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ data.persentase }}%</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('admin.beranda.statPersentase') }}</p>
          </div>

          <!-- Breakdown: Stacked Bar + Legend -->
          <div class="flex-1 min-w-0">
            <!-- Stacked Bar -->
            <div v-if="totalScan > 0" class="h-4 rounded-full overflow-hidden flex mb-4">
              <div :style="{ width: (data.hadir / totalScan * 100) + '%' }" class="bg-green-500 transition-all duration-500"></div>
              <div :style="{ width: (data.sakit / totalScan * 100) + '%' }" class="bg-amber-400 transition-all duration-500"></div>
              <div :style="{ width: (data.izin / totalScan * 100) + '%' }" class="bg-amber-400 transition-all duration-500"></div>
              <div :style="{ width: (data.alpha / totalScan * 100) + '%' }" class="bg-red-500 transition-all duration-500"></div>
            </div>
            <div v-else class="h-4 rounded-full bg-gray-100 dark:bg-gray-700 mb-4"></div>

            <!-- Legend -->
            <div class="flex flex-wrap gap-x-5 gap-y-2">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('admin.beranda.statHadir') }} {{ data.hadir }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('admin.beranda.statSakit') }} {{ data.sakit }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('admin.beranda.statIzin') }} {{ data.izin }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('admin.beranda.statAlpha') }} {{ data.alpha }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tables Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <!-- Top Alpha Siswa -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border">
          <div class="px-4 py-3 border-b admin-accent-border flex items-center justify-between">
            <div>
              <h3 class="text-sm font text-gray-900 dark:text-gray-100">{{ t('admin.beranda.topAlphaTitle') }}</h3>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ t('admin.beranda.topAlphaDesc') }}</p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ data.topAlpha.length }} {{ t('admin.beranda.unitMurid') }}</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                  <th class="text-left px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colNama') }}</th>
                  <th class="text-center px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colKelas') }}</th>
                  <th class="text-center px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colTotalAlpha') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y admin-accent-divide">
                <tr v-for="(item, idx) in data.topAlpha" :key="idx" class="hover:bg-gray-50/40 dark:hover:bg-gray-700/30 transition-colors">
                  <td class="px-4 py-3 text-gray-900 dark:text-gray-100 truncate max-w-[11rem]" :title="item.nama">{{ item.nama }}</td>
                  <td class="px-4 py-3 text-gray-600 dark:text-gray-400 text-center">{{ item.kelas }}</td>
                  <td class="px-4 py-3 text-center">
                    <span
                      class="text-xs font-bold"
                      :class="item.totalAlpha >= 6 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'"
                    >{{ item.totalAlpha }}x</span>
                  </td>
                </tr>
                <tr v-if="data.topAlpha.length === 0">
                  <td colspan="3" class="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-xs">{{ t('common.belumAdaData') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-4 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
            <NuxtLink
              to="/admin/alpha"
              class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              {{ t('admin.beranda.lihatSelengkapnya') }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>

        <!-- Monitoring Ruangan -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border">
          <div class="px-4 py-3 border-b admin-accent-border flex items-center justify-between">
            <div>
              <h3 class="text-sm font text-gray-900 dark:text-gray-100">{{ t('admin.beranda.monitoringTitle') }}</h3>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ t('admin.beranda.monitoringDesc') }}</p>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              <span class="text-xs text-gray-500 dark:text-gray-400">{{ data.monitoring.filter(r => r.status === 'Aktif').length }} {{ t('admin.beranda.unitAktif') }}</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                  <th class="text-left px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colRuangan') }}</th>
                  <th class="text-center px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colStatus') }}</th>
                  <th class="text-left px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colSesi') }}</th>
                  <th class="text-left px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider hidden md:table-cell">{{ t('admin.beranda.colPtk') }}</th>
                </tr>
              </thead>
              <tbody class="divide-y admin-accent-divide">
                <tr v-for="(item, idx) in data.monitoring.slice(0, 5)" :key="idx" class="hover:bg-gray-50/40 dark:hover:bg-gray-700/30 transition-colors">
                  <td class="px-4 py-3 text-gray-900 dark:text-gray-100 truncate max-w-[7rem]" :title="item.ruangan">{{ item.ruangan }}</td>
                  <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center gap-1.5">
                      <span
                        class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        :class="item.status === 'Aktif' ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"
                      ></span>
                      <span class="text-xs text-gray-600 dark:text-gray-400">{{ statusLabel(item.status) }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-3 text-gray-700 dark:text-gray-300 truncate max-w-[8rem]" :title="item.sesi">{{ item.sesi }}</td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell truncate max-w-[10rem]" :title="item.ptk">{{ item.ptk }}</td>
                </tr>
                <tr v-if="data.monitoring.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">{{ t('common.belumAdaData') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-4 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
            <p v-if="data.monitoring.length > 5" class="text-xs text-gray-400 dark:text-gray-500">
              {{ t('admin.beranda.ruanganLainnya', { count: data.monitoring.length - 5 }) }}
            </p>
            <NuxtLink
              to="/admin/monitoring"
              class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
            >
              {{ t('admin.beranda.lihatSelengkapnya') }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Aktivitas Terbaru -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border">
        <div class="px-4 py-3 border-b admin-accent-border flex items-center justify-between">
          <h3 class="text-sm font text-gray-900 dark:text-gray-100">{{ t('admin.beranda.aktivitasTitle') }}</h3>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ data.aktivitasTerbaru.length }} {{ t('admin.beranda.unitAktivitas') }}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th class="text-left px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider w-20">{{ t('admin.beranda.colWaktu') }}</th>
                <th class="text-left px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colAksi') }}</th>
                <th class="text-left px-4 py-3  text-gray-500 dark:text-gray-400 text-xs tracking-wider">{{ t('admin.beranda.colDetail') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="(item, idx) in visibleAktivitas" :key="idx" class="hover:bg-gray-50/40 dark:hover:bg-gray-700/30 transition-colors">
                <td class="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs font-mono">{{ item.waktu }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex items-center gap-1.5">
                    <span
                      class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      :class="item.aksi.includes('dibuka') ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"
                    ></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ aksiLabel(item.aksi) }}</span>
                  </span>
                </td>
                <td class="px-5 py-3 text-gray-700 dark:text-gray-300">{{ item.detail }}</td>
              </tr>
              <tr v-if="data.aktivitasTerbaru.length === 0">
                <td colspan="3" class="px-4 py-12 text-center text-gray-400 dark:text-gray-500 text-xs">{{ t('admin.beranda.emptyAktivitas') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="(data.aktivitasTerbaru.length || 0) > aktivitasPageSize"
          class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ t('common.menampilkan', { from: ((aktivitasPage - 1) * aktivitasPageSize) + 1, to: Math.min(aktivitasPage * aktivitasPageSize, data.aktivitasTerbaru.length), total: data.aktivitasTerbaru.length, unit: t('admin.beranda.unitAktivitas') }) }}
          </p>
          <div class="ml-auto flex items-center gap-2">
            <button @click="aktivitasPage--" :disabled="aktivitasPage <= 1"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              {{ t('common.sebelumnya') }}
            </button>
            <div class="flex items-center gap-1">
              <template v-for="(n, i) in aktivitasPageNumbers" :key="i">
                <button v-if="n !== '...'" @click="aktivitasPage = n" :disabled="n === aktivitasPage"
                  :class="n === aktivitasPage
                    ? 'w-7 h-7 rounded-md text-xs text-white bg-primary-600 ring-1 ring-primary-600 cursor-default'
                    : 'w-7 h-7 rounded-md text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors'">
                  {{ n }}
                </button>
                <span v-else class="px-0.5 text-xs text-gray-400 dark:text-gray-500 select-none">&hellip;</span>
              </template>
            </div>
            <button @click="aktivitasPage++" :disabled="aktivitasPage >= aktivitasTotalPages"
              class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {{ t('common.selanjutnya') }}
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>
  </AppLayout>
</template>
