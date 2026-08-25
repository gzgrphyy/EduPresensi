<script setup lang="ts">
interface SiswaItem {
  id: number
  nisn: string
  nama: string
  nomorHp1: string | null
  nomorHp2: string | null
  namaWali: string | null
  kontakWali: string | null
  user: { id: number; nama: string; email: string; isActive: boolean; foto: string | null; jenisKelamin: string | null } | null
}

interface KelasDetail {
  id: number
  nama: string
  waliKelasId: number | null
  semesterId: number
  waliKelas: { id: number; nama: string; nip: string | null; jenisKelamin: string | null; foto: string | null } | null
  semester: { id: number; nama: string; kodeAngka: number | null; pakaiRomawi: boolean; tahunAjaran: { id: number; nama: string } }
  _count: { siswa: number; jadwalPelajaran: number }
  siswa: SiswaItem[]
}

const { t } = useI18n()

function jenisKelaminLabel(jk: string | null) {
  if (jk === 'LAKI_LAKI') return t('admin.guru.jenisKelaminL')
  if (jk === 'PEREMPUAN') return t('admin.guru.jenisKelaminP')
  return ''
}

const route = useRoute()
const kelasId = computed(() => parseInt(route.params.id as string))

const { data: kelas, pending, error } = useFetch<KelasDetail>(`/api/admin/kelas/${kelasId.value}`, {
  immediate: true
})

const allSiswa = computed(() => kelas.value?.siswa || [])
const totalSiswa = computed(() => allSiswa.value.length)
const totalJadwal = computed(() => kelas.value?._count.jadwalPelajaran || 0)

const searchSiswa = ref('')
const filteredSiswa = computed(() => {
  const q = searchSiswa.value.trim().toLowerCase()
  if (!q) return allSiswa.value
  return allSiswa.value.filter(s =>
    s.nama.toLowerCase().includes(q) ||
    s.nisn.toLowerCase().includes(q) ||
    (s.namaWali || '').toLowerCase().includes(q)
  )
})

const page = ref(1)
const pageSize = 10

const totalPages = computed(() => Math.max(1, Math.ceil(filteredSiswa.value.length / pageSize)))
const visibleSiswa = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredSiswa.value.slice(start, start + pageSize)
})

watch(searchSiswa, () => { page.value = 1 })
</script>

<template>
  <AppLayout>
    <PageHeader :title="t('admin.kelas.detailTitle')" :description="kelas?.nama" back-to="/admin/kelas" />

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="5" />

    <div
      v-else-if="error"
      class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border px-6 py-16 text-center"
    >
      <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400 font-medium">{{ t('admin.kelas.msgGagalDetail') }}</p>
    </div>

    <template v-else-if="kelas">
      <!-- Info Bar -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border p-5 mb-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('admin.kelas.labelNama') }}</p>
            <p class="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{{ kelas.nama }}</p>
          </div>
        </div>

        <dl class="space-y-1.5 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">{{ t('admin.kelas.colWali') }}</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100 truncate">
              <span>{{ kelas.waliKelas?.nama || '-' }}</span>
              <div v-if="kelas.waliKelas?.jenisKelamin" class="text-xs text-gray-400 dark:text-gray-500 font-normal">
                {{ jenisKelaminLabel(kelas.waliKelas.jenisKelamin) }}
              </div>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">{{ t('admin.kelas.colTa') }}</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ kelas.semester.tahunAjaran.nama }} ({{ semesterFullLabel(kelas.semester, t) }})</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">{{ t('admin.kelas.colMurid') }}</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ totalSiswa }} {{ t('admin.siswa.unitMurid') }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-gray-500 dark:text-gray-400">{{ t('admin.kelas.colJadwal') }}</dt>
            <dd class="font-semibold text-gray-900 dark:text-gray-100">{{ totalJadwal }}</dd>
          </div>
        </dl>
      </div>

      <!-- Siswa Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border admin-accent-border overflow-hidden">
        <div class="px-4 sm:px-6 py-3 border-b admin-accent-border flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('admin.kelas.daftarMurid') }}</h2>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ totalSiswa }} {{ t('admin.siswa.unitMurid') }}</span>
          </div>
          <div class="relative w-full sm:w-56">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input v-model="searchSiswa" type="text" :placeholder="t('admin.siswa.searchPlaceholder')"
              class="w-full pl-9 pr-3 py-1.5 border admin-accent-border rounded-lg text-xs bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400" />
          </div>
        </div>
        <div class="overflow-x-auto scrollbar-thin">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-slate-700/50 border-b admin-accent-border">
                <th class="text-left px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider w-12">No</th>
                <th class="text-left px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider">{{ t('admin.guru.colNama') }}</th>
                <th class="text-left px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden sm:table-cell">{{ t('admin.siswa.colNisn') }}</th>
                <th class="text-left px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden md:table-cell">{{ t('admin.guru.colNoHp') }}</th>
                <th class="text-left px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden lg:table-cell">{{ t('admin.siswa.labelNamaWali') }}</th>
                <th class="text-center px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tracking-wider hidden xl:table-cell">{{ t('admin.tahunAjaran.colStatus') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y admin-accent-divide">
              <tr v-for="(s, idx) in visibleSiswa" :key="s.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                <td class="px-4 py-3 text-gray-400 dark:text-gray-500">{{ ((page - 1) * pageSize) + idx + 1 }}</td>
                <td class="px-4 py-3">
                  <span class="text-gray-900 dark:text-gray-100">{{ s.nama }}</span>
                  <div class="text-xs text-gray-400 dark:text-gray-500 sm:hidden">{{ s.nisn }}</div>
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300 hidden sm:table-cell">{{ s.nisn }}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden md:table-cell">{{ s.nomorHp1 || s.nomorHp2 || '-' }}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs hidden lg:table-cell">{{ s.namaWali || '-' }}</td>
                <td class="px-4 py-3 text-center hidden xl:table-cell">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="s.user?.isActive ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'"></span>
                    <span class="text-xs text-gray-600 dark:text-gray-400">{{ s.user?.isActive ? t('admin.tahunAjaran.aktif') : t('admin.tahunAjaran.tidakAktif') }}</span>
                  </span>
                </td>
              </tr>
              <tr v-if="filteredSiswa.length === 0">
                <td colspan="6" class="px-4 py-16 text-center">
                  <svg class="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p class="text-gray-500 dark:text-gray-400">{{ allSiswa.length === 0 ? t('admin.kelas.emptyMurid') : t('admin.kelas.emptySearch') }}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="filteredSiswa.length > pageSize" class="px-4 sm:px-6 py-3 border-t admin-accent-border flex items-center justify-between gap-3">
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ t('common.menampilkan', { from: ((page - 1) * pageSize) + 1, to: Math.min(page * pageSize, filteredSiswa.length), total: filteredSiswa.length, unit: t('admin.siswa.unitMurid') }) }}
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
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ t('common.halaman', { page, total: totalPages }) }}</span>
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
    </template>
  </AppLayout>
</template>
