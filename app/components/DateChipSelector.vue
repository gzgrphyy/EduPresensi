<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  modelValue: string[]
  classId?: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const dateInputRef = ref<HTMLInputElement | null>(null)
const showRangeModal = ref(false)
const rangeStart = ref('')
const rangeEnd = ref('')

function formatDateLokal(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    const formatter = new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    return formatter.format(d)
  } catch {
    return dateStr
  }
}

function onDateChange(e: Event) {
  const target = e.target as HTMLInputElement
  const val = target.value
  if (val && !props.modelValue.includes(val)) {
    emit('update:modelValue', [...props.modelValue, val])
  }
  target.value = ''
}

function removeDate(dateStr: string) {
  emit('update:modelValue', props.modelValue.filter(d => d !== dateStr))
}

function clearAll() {
  emit('update:modelValue', [])
}

function openPicker() {
  if (dateInputRef.value) {
    if ('showPicker' in dateInputRef.value) {
      dateInputRef.value.showPicker()
    } else {
      dateInputRef.value.focus()
    }
  }
}

function applyRange() {
  if (!rangeStart.value || !rangeEnd.value) return
  const start = new Date(rangeStart.value + 'T00:00:00')
  const end = new Date(rangeEnd.value + 'T00:00:00')
  if (start > end) return

  const newDates = [...props.modelValue]
  const curr = new Date(start)
  while (curr <= end) {
    const yyyy = curr.getFullYear()
    const mm = String(curr.getMonth() + 1).padStart(2, '0')
    const dd = String(curr.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    if (!newDates.includes(dateStr)) {
      newDates.push(dateStr)
    }
    curr.setDate(curr.getDate() + 1)
  }
  emit('update:modelValue', newDates)
  showRangeModal.value = false
  rangeStart.value = ''
  rangeEnd.value = ''
}
</script>

<template>
  <div class="space-y-2">
    <!-- Box Trigger Date Picker (Gaya disamakan dengan field Kelas) -->
    <div
      @click="openPicker"
      class="relative w-full h-10 flex items-center justify-between text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 bg-white dark:bg-slate-700 dark:text-gray-100 shadow-sm cursor-pointer hover:border-gray-300 dark:hover:border-slate-500 transition-colors"
    >
      <span class="text-gray-500 dark:text-gray-400 select-none text-xs">
        Pilih tanggal kehadiran…
      </span>
      <svg class="w-4 h-4 text-gray-400 dark:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>

      <!-- Invisible Native Input Date -->
      <input
        ref="dateInputRef"
        type="date"
        @change="onDateChange"
        class="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
      />
    </div>

    <!-- Action links below box -->
    <div class="flex items-center justify-end gap-2 text-xs">
      <button
        type="button"
        @click="showRangeModal = true"
        class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
      >
        + Rentang Tanggal
      </button>
      <span v-if="modelValue.length > 0" class="text-gray-300 dark:text-slate-600">|</span>
      <button
        v-if="modelValue.length > 0"
        type="button"
        @click="clearAll"
        class="text-red-500 hover:underline font-medium"
      >
        Hapus Semua
      </button>
    </div>

    <!-- Kumpulan Chip Tanggal Terpilih (Scrollable jika banyak) -->
    <div v-if="modelValue.length > 0" class="max-h-28 overflow-y-auto flex flex-wrap gap-1.5 pt-1 pr-1">
      <span
        v-for="d in modelValue"
        :key="d"
        class="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-md text-xs font-semibold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/50 shadow-xs"
      >
        {{ formatDateLokal(d) }}
        <button
          type="button"
          @click.stop="removeDate(d)"
          class="w-4 h-4 inline-flex items-center justify-center rounded-full text-primary-400 hover:text-white hover:bg-red-500 dark:hover:bg-red-500 transition-colors"
          title="Hapus tanggal"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- Range Modal -->
    <BaseModal :show="showRangeModal" @close="showRangeModal = false">
      <template #header>
        <h3 class="text-base font-bold text-gray-900 dark:text-gray-100">Pilih Rentang Tanggal</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pilih tanggal mulai dan selesai untuk memasukkan sekaligus.</p>
      </template>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Dari Tanggal</label>
          <input
            v-model="rangeStart"
            type="date"
            class="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sampai Tanggal</label>
          <input
            v-model="rangeEnd"
            type="date"
            class="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            @click="showRangeModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            @click="applyRange"
            class="px-4 py-2 text-sm font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-lg shadow-sm transition-colors"
          >
            Terapkan
          </button>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
