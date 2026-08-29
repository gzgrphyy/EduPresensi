<script setup lang="ts">
interface RatingItem {
  id: number
  rating: number
  tags: string | null
  komentar: string | null
  createdAt: string
  siswa: { id: number; nama: string }
}

interface SessionRating {
  id: number
  tanggal: string
  mapel: string
  kelas: string
  average: number
  count: number
  ratings: RatingItem[]
}

const router = useRouter()

const { data: sessions, pending, error } = useFetch<SessionRating[]>('/api/absensi/ratings', { immediate: true })

const page = ref(1)
const pageSize = 10
const totalPages = computed(() => Math.max(1, Math.ceil((sessions.value?.length || 0) / pageSize)))
const visible = computed(() => {
  const start = (page.value - 1) * pageSize
  return sessions.value?.slice(start, start + pageSize) ?? []
})

function goToDetail(id: number) {
  router.push(`/absensi/detail/${id}`)
}
</script>

<template>
  <PTKLayout>
    <PageHeader title="Daftar Rating Kelas" description="Ringkasan rating tiap sesi" />

    <LoadingSkeleton v-if="pending" type="table" :rows="5" :columns="5" />

    <div v-else-if="error" class="p-6 text-center">
      <p class="text-gray-500 dark:text-gray-400">Gagal memuat data rating</p>
    </div>

    <template v-else>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-slate-700/50">
            <tr>
              <th class="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Tanggal</th>
              <th class="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Mata Pelajaran</th>
              <th class="px-4 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">Kelas</th>
              <th class="px-4 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">Rata‑rata</th>
              <th class="px-4 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">Jumlah Ulasan</th>
              <th class="px-4 py-2 text-center font-semibold text-gray-600 dark:text-gray-300">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-700">
            <tr v-for="s in visible" :key="s.id" class="hover:bg-gray-50 dark:hover:bg-slate-700/30">
              <td class="px-4 py-2 text-gray-700 dark:text-gray-300">{{ new Date(s.tanggal).toLocaleDateString('id-ID') }}</td>
              <td class="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{{ s.mapel }}</td>
              <td class="px-4 py-2 text-gray-600 dark:text-gray-400">{{ s.kelas }}</td>
              <td class="px-4 py-2 text-center text-amber-600 dark:text-amber-400">
                {{ s.average.toFixed(1) }} ★
              </td>
              <td class="px-4 py-2 text-center text-gray-600 dark:text-gray-400">{{ s.count }}</td>
              <td class="px-4 py-2 text-center">
                <button @click="goToDetail(s.id)" class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-primary-500 rounded hover:bg-primary-600">
                  Detail
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 px-4">
        <button @click="page--" :disabled="page <= 1" class="px-3 py-1 text-sm bg-gray-200 rounded disabled:opacity-50">
          Sebelumnya
        </button>
        <span class="text-sm text-gray-600 dark:text-gray-400">Halaman {{ page }} / {{ totalPages }}</span>
        <button @click="page++" :disabled="page >= totalPages" class="px-3 py-1 text-sm bg-gray-200 rounded disabled:opacity-50">
          Selanjutnya
        </button>
      </div>
    </template>
  </PTKLayout>
</template>
