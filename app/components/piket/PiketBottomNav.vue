<script setup lang="ts">
const route = useRoute()

const items = [
  { label: 'Beranda', to: '/piket/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { label: 'Riwayat', to: '/piket/riwayat', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
]

function isActive(to: string) {
  return route.path === to
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-40" aria-label="Navigasi piket">
    <div class="relative max-w-lg mx-auto">
      <!-- Bar -->
      <div class="grid grid-cols-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-gray-200 dark:border-slate-700 shadow-[0_-6px_20px_rgb(0_0_0_/_0.05)] dark:shadow-[0_-6px_20px_rgb(0_0_0_/_0.35)]">
        <NuxtLink
          v-for="item in items"
          :key="item.label"
          :to="item.to"
          class="relative flex flex-col items-center justify-end gap-1.5 pt-1.5 h-[60px] pb-[calc(0.375rem+env(safe-area-inset-bottom))] px-6 active:bg-gray-50 dark:active:bg-slate-700/50 transition-colors"
        >
          <span
            v-if="isActive(item.to)"
            class="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-primary-500 dark:bg-primary-400"
            aria-hidden="true"
          />
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
          <span class="text-[11px] leading-none" :class="isActive(item.to) ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-gray-400 dark:text-gray-500'">
            {{ item.label }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>
