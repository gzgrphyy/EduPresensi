<script setup lang="ts">
const { user, clear } = useUserSession()
const { pengaturan } = usePengaturan()
const { t } = useI18n()
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const showLogoutModal = ref(false)

function openLogoutModal() {
  showLogoutModal.value = true
}

async function confirmLogout() {
  try { await clear() } catch {}
  navigateTo('/login')
}

onMounted(() => {
  usePengaturan().fetch()
})
</script>

<template>
  <div class="h-screen overflow-hidden flex flex-col bg-[#FEFEFE] dark:bg-slate-900">
    <!-- Slim App Bar -->
    <header class="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
      <div class="h-0.5 bg-primary-500 dark:bg-primary-600" />
      <div class="max-w-lg mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <NuxtLink to="/absensi" class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-[#0A66A0] flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
            <img v-if="pengaturan?.iconPath" :src="pengaturan.iconPath" class="w-full h-full object-contain p-0.5" />
            <span v-else>{{ t('app.aplikasiSkoria').charAt(0) }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{{ t('app.aplikasiSkoria') }}</p>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">{{ t('app.sistemAbsensi') }}</p>
          </div>
        </NuxtLink>

        <div class="flex items-center gap-1.5">
          <button
            @click="toggleColorMode"
            class="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            :title="isDark ? t('header.modeTerang') : t('header.modeGelap')"
          >
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          <button
            @click="openLogoutModal"
            class="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition-colors"
            :title="t('common.keluar')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Scrollable Content -->
    <main class="flex-1 overflow-y-auto min-h-0">
      <div class="max-w-lg mx-auto w-full px-4 pt-4 pb-36">
        <slot />
      </div>
    </main>

    <PTKBottomNav />

    <BaseModal :show="showLogoutModal" title="Keluar" max-w="max-w-sm" @close="showLogoutModal = false">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-400 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Yakin ingin keluar?</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Kamu akan kembali ke halaman login.</p>
        </div>
      </div>
      <template #footer>
        <button
          type="button"
          @click="showLogoutModal = false"
          class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          Batal
        </button>
        <button
          type="button"
          @click="confirmLogout"
          class="px-5 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm"
        >
          Ya, Keluar
        </button>
      </template>
    </BaseModal>
  </div>
</template>
