<script setup lang="ts">
// Root path — langsung redirect ke login.
// Auth middleware akan handle redirect lebih lanjut kalau user sudah login.
navigateTo('/login', { replace: true })
</script>

<template>
  <StudentLayout>
    <div class="p-4 space-y-4">
      <!-- Rating Overview Card -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 shadow-card dark:shadow-dark-card">
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Rating Kelas</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Lihat rata‑rata rating dan ulasan murid untuk kelas yang telah selesai.
        </p>
        <NuxtLink to="/ptk/ratings" class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-500 rounded hover:bg-primary-600">
          Lihat Semua Rating
        </NuxtLink>
      </div>
    </div>
  </StudentLayout>
</template>

