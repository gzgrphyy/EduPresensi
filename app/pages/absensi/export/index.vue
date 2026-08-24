<script setup lang="ts">
const exporting = ref<string | null>(null)
const successMsg = ref('')

const options = [
  { id: 'rekap-saya', label: 'Rekap Saya', description: 'Rekap absensi pribadi', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { id: 'rekap-kelas', label: 'Rekap Kelas', description: 'Rekap absensi seluruh murid kelas', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
]

async function handleExport(id: string) {
  exporting.value = id
  successMsg.value = ''
  try {
    await $fetch(`/api/absensi/export/${id}`, { responseType: 'blob' })
  } catch {}
  successMsg.value = `Export "${options.find(o => o.id === id)?.label}" berhasil`
  exporting.value = null
}
</script>

<template>
  <PTKLayout>
    <PageHeader title="Export Data" description="Unduh data absensi" :show-back="false" />

    <Notification type="success" :message="successMsg" :show="!!successMsg" @dismiss="successMsg = ''" />

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div v-for="opt in options" :key="opt.id"
        @click="handleExport(opt.id)"
        class="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card p-5 hover:shadow-card-hover dark:hover:shadow-dark-card hover:border-primary-200 dark:hover:border-primary-700 transition-all cursor-pointer flex items-center gap-4 active:scale-[0.98]"
        :class="{ 'opacity-50 pointer-events-none': !!exporting }">
        <div class="p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl text-green-600 dark:text-green-400 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="opt.icon" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ opt.label }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ opt.description }}</p>
        </div>
        <svg v-if="exporting === opt.id" class="w-5 h-5 text-primary-600 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <svg v-else class="w-5 h-5 text-gray-300 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
      </div>
    </div>

    <div class="mt-4 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-card dark:shadow-dark-card">
      <div class="flex items-center gap-3 p-4">
        <div class="p-2.5 rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-500 dark:text-primary-400 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">File diunduh dalam format Excel (.xlsx). Lihat riwayat lengkap di halaman <NuxtLink to="/absensi/riwayat" class="text-primary-600 dark:text-primary-400 font-medium">Riwayat Absensi</NuxtLink>.</p>
      </div>
    </div>
  </PTKLayout>
</template>
