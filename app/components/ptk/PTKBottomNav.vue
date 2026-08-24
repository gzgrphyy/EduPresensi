<script setup lang="ts">
const route = useRoute()
const { user } = useUserSession()

const items = [
  { label: 'Beranda', to: '/absensi', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Riwayat', to: '/absensi/riwayat', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { label: 'Scan', to: '/absensi/scan', fab: true },
  { label: 'Rekap', to: '/absensi/rekap', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { label: 'Profil', to: '/absensi/profil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', avatar: true }
]

function isActive(to: string) {
  return route.path === to
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-40" aria-label="Navigasi utama">
    <div class="relative max-w-lg mx-auto">
      <!-- FAB Scan QR -->
      <NuxtLink
        to="/absensi/scan"
        title="Scan QR Ruangan"
        aria-label="Scan QR Ruangan"
        class="absolute left-1/2 -top-8 -translate-x-1/2 z-10 focus:outline-none"
      >
        <span
          class="w-16 h-16 rounded-full bg-accent-500 text-primary-900 flex flex-col items-center justify-center gap-0.5 shadow-xl shadow-accent-500/50 ring-4 transition-transform duration-150 hover:scale-105 active:scale-95"
          :class="isActive('/absensi/scan') ? 'ring-primary-100 dark:ring-primary-900' : 'ring-white dark:ring-slate-900'"
        >
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </span>
      </NuxtLink>

      <!-- Bar -->
      <div class="grid grid-cols-5 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-gray-200 dark:border-slate-700 shadow-[0_-6px_20px_rgb(0_0_0_/_0.05)] dark:shadow-[0_-6px_20px_rgb(0_0_0_/_0.35)]">
        <template v-for="item in items" :key="item.label">
          <div v-if="item.fab" class="flex flex-col items-center justify-end h-[60px] pb-[calc(0.375rem+env(safe-area-inset-bottom))]" aria-hidden="true">
            <span class="text-[11px] leading-none" :class="isActive('/absensi/scan') ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-gray-420 dark:text-gray-500'">Scan</span>
          </div>
          <NuxtLink
            v-else
            :to="item.to"
            class="relative flex flex-col items-center justify-end gap-1.5 pt-1.5 h-[60px] pb-[calc(0.375rem+env(safe-area-inset-bottom))] active:bg-gray-50 dark:active:bg-slate-700/50 transition-colors"
          >
            <span
              v-if="isActive(item.to) && !item.avatar"
              class="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-primary-500 dark:bg-primary-400"
              aria-hidden="true"
            />
            <template v-if="!item.avatar">
              <span
                class="w-11 h-7 flex items-center justify-center rounded-full transition-colors"
                :class="isActive(item.to) ? 'bg-primary-500 dark:bg-primary-500 text-white shadow-md shadow-primary-500/30' : ''"
              >
                <svg
                  class="w-6 h-6"
                  :class="isActive(item.to) ? 'text-white' : 'text-gray-400 dark:text-gray-500'"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="item.icon" />
                </svg>
              </span>
            </template>
            <template v-else>
              <span class="w-11 h-7 flex items-center justify-center">
                <span class="relative w-6 h-6">
                  <img
                    v-if="user?.foto"
                    :src="user.foto"
                    :alt="user?.nama || 'Profil'"
                    class="w-6 h-6 rounded-full object-cover"
                  />
                  <span
                    v-else
                    class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors"
                    :class="isActive(item.to) ? 'bg-primary-500 text-white' : 'bg-primary-500/15 text-primary-600 dark:text-primary-400'"
                  >
                    {{ (user?.nama || 'P').charAt(0).toUpperCase() }}
                  </span>
                  <span
                    v-if="isActive(item.to)"
                    class="absolute -inset-[3px] rounded-full border-2 border-primary-500 dark:border-primary-400"
                    aria-hidden="true"
                  />
                </span>
              </span>
            </template>
            <span class="text-[11px] leading-none" :class="isActive(item.to) ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-gray-400 dark:text-gray-500'">
              {{ item.label }}
            </span>
          </NuxtLink>
        </template>
      </div>
    </div>
  </nav>
</template>
