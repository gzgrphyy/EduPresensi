<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { user } = useUserSession()
const { t } = useI18n()
const collapsed = useCookie('sidebarCollapsed', { default: () => false })
const openGroups = ref<Record<string, boolean>>({})

const roleLabel = computed<Record<string, string>>(() => ({
  ADMIN: t('role.admin'),
  GURU: t('role.guru'),
  SISWA: t('role.siswa'),
  PETUGAS_PIKET: t('role.petugasPiket')
}))

interface MenuItem {
  label: string
  icon: string
  to?: string
  children?: { label: string; to: string }[]
}

const adminMenus = computed<MenuItem[]>(() => [
  { label: t('nav.beranda'), to: '/admin', icon: 'dashboard' },
  {
    label: t('nav.dataMaster'), icon: 'master-data',
    children: [
      { label: t('nav.dataPtk'), to: '/admin/guru' },
      { label: t('nav.jadwalPiket'), to: '/admin/jadwal-piket' },
      { label: t('nav.dataMurid'), to: '/admin/siswa' },
      { label: t('nav.dataKelas'), to: '/admin/kelas' },
      { label: t('nav.tahunAjaran'), to: '/admin/tahun-ajaran' },
      { label: t('nav.dataRuangan'), to: '/admin/ruangan' },
      { label: t('nav.jadwalPelajaran'), to: '/admin/jadwal-pelajaran' },
    ]
  },
  { label: t('nav.pemantauanRuangan'), to: '/admin/monitoring', icon: 'monitor' },
  { label: t('nav.rekapAbsensi'), to: '/admin/rekap', icon: 'rekap' },
  { label: t('nav.eksporLaporan'), to: '/admin/export', icon: 'export' },
  { label: t('nav.pengaturan'), to: '/admin/pengaturan', icon: 'settings' },
  { label: t('nav.profil'), to: '/admin/profil', icon: 'profile' },
])

const guruMenus = computed<MenuItem[]>(() => [
  { label: t('nav.beranda'), to: '/absensi', icon: 'dashboard' },
  { label: t('nav.scanQr'), to: '/absensi/scan', icon: 'scan' },
  { label: t('nav.riwayatAbsensi'), to: '/absensi/riwayat', icon: 'riwayat' },
  { label: t('nav.jadwal'), to: '/absensi/jadwal', icon: 'jadwal' },
  { label: t('nav.profil'), to: '/absensi/profil', icon: 'profile' },
])

const siswaMenus = computed<MenuItem[]>(() => [
  { label: t('nav.beranda'), to: '/siswa', icon: 'dashboard' },
  { label: t('nav.pindaiQr'), to: '/siswa/scan', icon: 'scan' },
  { label: t('nav.jadwal'), to: '/siswa/jadwal', icon: 'jadwal' },
  { label: t('nav.riwayatAbsensi'), to: '/siswa/riwayat', icon: 'riwayat' },
  { label: t('nav.profil'), to: '/siswa/profil', icon: 'profile' },
])

const petugasPiketMenus = computed<MenuItem[]>(() => [
  { label: t('nav.beranda'), to: '/piket/dashboard', icon: 'dashboard' },
])

const currentMenus = computed(() => {
  const role = user.value?.role
  if (role === 'ADMIN') return adminMenus.value
  if (role === 'GURU') return guruMenus.value
  if (role === 'SISWA') return siswaMenus.value
  if (role === 'PETUGAS_PIKET') return petugasPiketMenus.value
  return []
})

const isActive = (to?: string) => {
  if (!to) return false
  return route.path === to
}

const isChildActive = (children?: { to: string }[]) => {
  if (!children) return false
  return children.some(c => route.path === c.to || route.path.startsWith(c.to + '/'))
}

function toggleGroup(key: string) {
  openGroups.value[key] = !openGroups.value[key]
}

// Auto buka/tutup grup menu berdasarkan route
watch(
  [() => route.path, currentMenus],
  () => {
    for (const menu of currentMenus.value) {
      if (menu.children) {
        const isInGroup = menu.children.some(c => route.path === c.to || route.path.startsWith(c.to + '/'))
        openGroups.value[menu.icon] = isInGroup
      }
    }
  },
  { immediate: true }
)

function renderIcon(icon: string) {
  const icons: Record<string, string> = {
    dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    'master-data': 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16M9 11h6',
    monitor: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    rekap: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    export: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    sesi: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    riwayat: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    profile: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    scan: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z',
    jadwal: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  }
  return icons[icon] || icons.dashboard
}
</script>

<template>
  <aside
    :class="[
      'bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col transition-all duration-200 h-full z-40',
      collapsed ? 'w-14' : 'w-60'
    ]"
  >
    <!-- Garis aksen atas (sama dengan Header) -->
    <div class="flex flex-col">
      <div class="h-0.5 bg-red-600" />
      <div class="h-0.5 bg-white border-b border-gray-200 dark:border-slate-700" />
    </div>

    <!-- Profil Pengguna -->
    <div class="flex-shrink-0 border-b border-gray-200 dark:border-slate-700">
      <div :class="['flex items-center gap-2.5 py-2.5', collapsed ? 'justify-center px-0' : 'px-4']">
        <div v-if="user?.foto" class="w-9 h-9 rounded-full overflow-hidden border border-[#C5E3F7] dark:border-[#04355C] flex-shrink-0">
          <img :src="user.foto" class="w-full h-full object-cover" />
        </div>
        <div v-else class="w-9 h-9 rounded-full bg-[#E8F4FC] dark:bg-[#032645]/40 flex items-center justify-center text-xs  text-[#08558A] dark:text-[#6DB5E5] border border-[#C5E3F7] dark:border-[#04355C] flex-shrink-0">
          {{ user?.nama?.charAt(0)?.toUpperCase() || 'U' }}
        </div>
        <div v-if="!collapsed" class="min-w-0">
          <p class="text-sm  text-gray-900 dark:text-gray-100 truncate leading-tight">{{ user?.nama || t('common.pengguna') }}</p>
          <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate leading-tight">{{ roleLabel[user?.role] || user?.role }}</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav :class="['flex-1 overflow-y-auto scrollbar-thin py-3 space-y-0.5', collapsed ? 'px-0' : 'px-2.5']">
      <template v-for="item in currentMenus" :key="item.label">
        <!-- Menu dengan children -->
        <div v-if="item.children">
          <button
            @click="toggleGroup(item.icon)"
            :class="[
              'relative w-full flex items-center gap-2.5 py-2 text-xs transition-all duration-150 rounded-lg',
              collapsed ? 'justify-center px-0' : 'px-3',
              isChildActive(item.children)
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200',
              'rounded-lg'
            ]"
          >
            <span v-if="isChildActive(item.children)" class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary-500"></span>
            <svg class="w-5 h-5 flex-shrink-0" :class="isChildActive(item.children) ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="renderIcon(item.icon)" />
            </svg>
            <span v-if="!collapsed" class="flex-1 text-left truncate">{{ item.label }}</span>
            <svg v-if="!collapsed" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform duration-150" :class="{ 'rotate-90 text-primary-500': openGroups[item.icon] }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div v-show="!collapsed && openGroups[item.icon]" class="ml-3 mt-0.5 space-y-0.5 border-l-2 border-primary-100 dark:border-primary-900/50 pl-2">
            <NuxtLink
              v-for="child in item.children"
              :key="child.to"
              :to="child.to"
              :class="[
                'flex items-center gap-2 px-3 py-1.5 text-xs transition-all duration-150 rounded-lg',
                route.path === child.to
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200'
              ]"
            >
              <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="route.path === child.to ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'"></span>
              <span class="truncate">{{ child.label }}</span>
            </NuxtLink>
          </div>
        </div>

        <!-- Menu biasa -->
        <NuxtLink
          v-else
          :to="item.to"
          :class="[
            'relative w-full flex items-center gap-2.5 py-2 text-xs transition-all duration-150 rounded-lg',
            collapsed ? 'justify-center px-0' : 'px-3',
            isActive(item.to)
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700/60 hover:text-gray-700 dark:hover:text-gray-200'
          ]"
        >
          <span v-if="isActive(item.to)" class="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary-500"></span>
          <svg class="w-5 h-5 flex-shrink-0" :class="isActive(item.to) ? 'text-primary-500' : 'text-gray-400 dark:text-gray-500'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="renderIcon(item.icon)" />
          </svg>
          <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
        </NuxtLink>
      </template>
    </nav>

    <!-- Collapse toggle -->
    <div class="flex-shrink-0 border-t border-gray-200 dark:border-slate-700 px-2 py-2">
      <button
        @click="collapsed = !collapsed"
        :class="['w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-150 rounded-lg']"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>
    </div>
  </aside>
</template>
