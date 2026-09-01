<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  locale?: string
}>(), {
  modelValue: '',
  locale: 'id-ID'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)
const calendarRef = ref<HTMLDivElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)

const today = computed(() => localDateStr(new Date()))

const selectedDate = computed(() => props.modelValue || today.value)

// Parse selected date
const selectedObj = computed(() => {
  if (!selectedDate.value) return null
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  return new Date(y, m - 1, d)
})

// Navigation month/year
const viewYear = ref(selectedObj.value?.getFullYear() ?? new Date().getFullYear())
const viewMonth = ref(selectedObj.value?.getMonth() ?? new Date().getMonth())

watch(() => props.modelValue, (val) => {
  if (val) {
    const [y, m] = val.split('-').map(Number)
    viewYear.value = y
    viewMonth.value = m - 1
  }
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

// Month/year labels
const monthLabel = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value, 1)
  return d.toLocaleDateString(props.locale, { month: 'long' })
})

const yearLabel = computed(() => viewYear.value)

// Day headers (Senin - Minggu)
const dayHeaders = computed(() => {
  const headers: string[] = []
  for (let i = 0; i < 7; i++) {
    // Jan 5 2026 = Monday
    const d = new Date(2026, 0, 5 + i)
    headers.push(d.toLocaleDateString(props.locale, { weekday: 'short' }))
  }
  return headers
})

// Calendar grid
interface CalendarDay {
  date: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

const calendarDays = computed<CalendarDay[]>(() => {
  const year = viewYear.value
  const month = viewMonth.value

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday=0 ... Sunday=6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: CalendarDay[] = []

  // Previous month padding
  const prevMonthLast = new Date(year, month, 0).getDate()
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLast - i
    const dateObj = new Date(year, month - 1, d)
    const dateStr = formatDateStr(dateObj)
    days.push({
      date: dateStr,
      day: d,
      isCurrentMonth: false,
      isToday: dateStr === today.value,
      isSelected: dateStr === selectedDate.value
    })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateObj = new Date(year, month, d)
    const dateStr = formatDateStr(dateObj)
    days.push({
      date: dateStr,
      day: d,
      isCurrentMonth: true,
      isToday: dateStr === today.value,
      isSelected: dateStr === selectedDate.value
    })
  }

  // Next month padding
  const remaining = 42 - days.length // 6 rows x 7
  for (let d = 1; d <= remaining; d++) {
    const dateObj = new Date(year, month + 1, d)
    const dateStr = formatDateStr(dateObj)
    days.push({
      date: dateStr,
      day: d,
      isCurrentMonth: false,
      isToday: dateStr === today.value,
      isSelected: dateStr === selectedDate.value
    })
  }

  return days
})

function formatDateStr(d: Date): string {
  return localDateStr(d)
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return 'Pilih tanggal'
  const [y, m, d] = dateStr.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)
  return dateObj.toLocaleDateString(props.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

function selectDate(dateStr: string) {
  emit('update:modelValue', dateStr)
  isOpen.value = false
}

function toggleOpen() {
  isOpen.value = !isOpen.value
}

function goToToday() {
  emit('update:modelValue', today.value)
  viewYear.value = new Date().getFullYear()
  viewMonth.value = new Date().getMonth()
  isOpen.value = false
}

// Click outside
function onClickOutside(e: MouseEvent) {
  if (calendarRef.value && !calendarRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false
    triggerRef.value?.focus()
  }
}

// Year dropdown
const showYearDropdown = ref(false)
const yearDropdownRef = ref<HTMLDivElement | null>(null)
const currentYear = new Date().getFullYear()
const yearRange = computed(() => {
  const years: number[] = []
  for (let y = currentYear - 5; y <= currentYear + 5; y++) {
    years.push(y)
  }
  return years
})

function selectYear(y: number) {
  viewYear.value = y
  showYearDropdown.value = false
}

// Month dropdown
const showMonthDropdown = ref(false)
const monthNames = computed(() => {
  const names: { label: string; index: number }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(2026, i, 1)
    names.push({
      label: d.toLocaleDateString(props.locale, { month: 'short' }),
      index: i
    })
  }
  return names
})

function selectMonth(m: number) {
  viewMonth.value = m
  showMonthDropdown.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  document.addEventListener('keydown', onKeydown)
  if (props.modelValue) {
    const [y, m] = props.modelValue.split('-').map(Number)
    viewYear.value = y
    viewMonth.value = m - 1
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="calendarRef" class="relative flex-shrink-0">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      type="button"
      @click="toggleOpen"
      class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 active:bg-gray-100 dark:active:bg-slate-600 transition-colors cursor-pointer select-none shadow-sm"
    >
      <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span class="text-sm">{{ formatDateDisplay(selectedDate) }}</span>
      <svg :class="['w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0', isOpen ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Popup Calendar -->
    <Transition name="calendar">
      <div
        v-if="isOpen"
        class="absolute top-full left-0 mt-2 z-50 w-[300px] bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 rounded-xl shadow-lg p-3"
      >
        <!-- Header: Month & Year -->
        <div class="flex items-center justify-between mb-3">
          <button
            type="button"
            @click="prevMonth"
            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 active:bg-gray-200 dark:active:bg-slate-600 transition-colors cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </button>

          <div class="flex items-center gap-1">
            <!-- Month button -->
            <div class="relative">
              <button
                type="button"
                @click="showMonthDropdown = !showMonthDropdown; showYearDropdown = false"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                {{ monthLabel }}
              </button>
              <Transition name="dropdown">
                <div
                  v-if="showMonthDropdown"
                  ref="monthDropdownRef"
                  class="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 rounded-lg shadow-lg p-1.5 z-10 grid grid-cols-3 gap-1"
                >
                  <button
                    v-for="m in monthNames"
                    :key="m.index"
                    type="button"
                    @click="selectMonth(m.index)"
                    :class="[
                      'px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
                      m.index === viewMonth
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                    ]"
                  >
                    {{ m.label }}
                  </button>
                </div>
              </Transition>
            </div>

            <!-- Year button -->
            <div class="relative">
              <button
                type="button"
                @click="showYearDropdown = !showYearDropdown; showMonthDropdown = false"
                class="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
              >
                {{ yearLabel }}
              </button>
              <Transition name="dropdown">
                <div
                  v-if="showYearDropdown"
                  ref="yearDropdownRef"
                  class="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 border border-gray-200/80 dark:border-slate-700/80 rounded-lg shadow-lg p-1.5 z-10 max-h-[200px] overflow-y-auto"
                >
                  <button
                    v-for="y in yearRange"
                    :key="y"
                    type="button"
                    @click="selectYear(y)"
                    :class="[
                      'block w-full px-3 py-1.5 text-xs font-medium rounded-md text-left transition-colors cursor-pointer',
                      y === viewYear
                        ? 'bg-primary-500 text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                    ]"
                  >
                    {{ y }}
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <button
            type="button"
            @click="nextMonth"
            class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 active:bg-gray-200 dark:active:bg-slate-600 transition-colors cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <!-- Day Headers -->
        <div class="grid grid-cols-7 mb-1">
          <div
            v-for="(header, i) in dayHeaders"
            :key="i"
            class="text-center text-[11px] font-medium text-gray-400 dark:text-gray-500 py-1"
          >
            {{ header }}
          </div>
        </div>

        <!-- Calendar Grid -->
        <div class="grid grid-cols-7">
          <button
            v-for="(day, i) in calendarDays"
            :key="i"
            type="button"
            @click="selectDate(day.date)"
            :class="[
              'relative flex items-center justify-center h-8 text-sm rounded-lg transition-all cursor-pointer select-none',
              day.isToday && !day.isSelected
                ? 'font-bold text-primary-600 dark:text-primary-400 ring-1 ring-primary-300 dark:ring-primary-600'
                : '',
              day.isSelected
                ? 'font-bold text-white bg-primary-500 dark:bg-primary-600 shadow-sm'
                : '',
              !day.isSelected && day.isCurrentMonth
                ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                : '',
              !day.isSelected && !day.isCurrentMonth
                ? 'text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                : ''
            ]"
          >
            {{ day.day }}
          </button>
        </div>

        <!-- Today Button -->
        <div class="flex justify-center mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
          <button
            type="button"
            @click="goToToday"
            class="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 px-3 py-1 rounded-full transition-colors cursor-pointer"
          >
            Hari Ini
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.calendar-enter-active {
  transition: all 0.15s ease-out;
}
.calendar-leave-active {
  transition: all 0.1s ease-in;
}
.calendar-enter-from,
.calendar-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.97);
}

.dropdown-enter-active {
  transition: all 0.12s ease-out;
}
.dropdown-leave-active {
  transition: all 0.08s ease-in;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-2px) scale(0.97);
}
</style>
