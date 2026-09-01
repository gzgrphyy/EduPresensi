<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()

// activeMenu memakai key stabil, bukan label terjemahan
const activeMenu = computed(() => {
  const path = route.path
  if (path === '/admin') return 'dasbor'
  if (
    path.startsWith('/admin/guru') ||
    path.startsWith('/admin/siswa') ||
    path.startsWith('/admin/kelas') ||
    path.startsWith('/admin/tahun-ajaran') ||
    path.startsWith('/admin/ruangan') ||
    path.startsWith('/admin/jadwal-pelajaran') ||
    path.startsWith('/admin/jadwal-piket')
  ) return 'dataMaster'
  if (path.startsWith('/admin/monitoring')) return 'pemantauan'
  if (path.startsWith('/admin/rekap') || path.startsWith('/admin/export')) return 'laporan'
  if (path.startsWith('/admin/pengaturan')) return 'pengaturan'
  return ''
})

interface SubMenuItem {
  labelKey: string
  to: string
}

const subMenus: Record<string, SubMenuItem[]> = {
  dataMaster: [
    { labelKey: 'nav.dataPtk',          to: '/admin/guru' },
    { labelKey: 'nav.jadwalPiket',      to: '/admin/jadwal-piket' },
    { labelKey: 'nav.dataMurid',         to: '/admin/siswa' },
    { labelKey: 'nav.dataKelas',         to: '/admin/kelas' },
    { labelKey: 'nav.tahunAjaran',       to: '/admin/tahun-ajaran' },
    { labelKey: 'nav.dataRuangan',       to: '/admin/ruangan' },
    { labelKey: 'nav.jadwalPelajaran',   to: '/admin/jadwal-pelajaran' },
  ],
  laporan: [
    { labelKey: 'nav.rekapAbsensi',  to: '/admin/rekap' },
    { labelKey: 'nav.eksporLaporan', to: '/admin/export' },
  ],
}

const currentSubMenus = computed(() => subMenus[activeMenu.value] || [])

const isActive = (to: string) => route.path === to
</script>

<template>
  <div
    v-if="currentSubMenus.length > 0"
    class="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex-shrink-0 overflow-x-auto scrollbar-thin"
  >
    <div class="px-4 sm:px-6 h-9 flex items-center gap-1 min-w-max">
      <NuxtLink
        v-for="item in currentSubMenus"
        :key="item.to"
        :to="item.to"
        :class="[
          'px-3 py-1.5 text-sm font-medium transition-all duration-150',
          isActive(item.to)
            ? 'bg-primary-500 text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-400'
        ]"
      >
        {{ t(item.labelKey) }}
      </NuxtLink>
    </div>
  </div>
</template>