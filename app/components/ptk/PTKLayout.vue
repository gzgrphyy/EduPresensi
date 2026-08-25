<script setup lang="ts">
const { user, clear } = useUserSession()
const { pengaturan } = usePengaturan()
const { t } = useI18n()

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
          <CurtainThemeToggle />

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
