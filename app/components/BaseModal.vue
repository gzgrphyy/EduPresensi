<script setup lang="ts">
import { inject } from 'vue'

withDefaults(defineProps<{
  show: boolean
  title?: string
  maxWidth?: string
  closeOnBackdrop?: boolean
}>(), {
  maxWidth: 'max-w-md',
  closeOnBackdrop: true,
})

const isAdmin = inject('isAdmin', false)

const emit = defineEmits<{
  close: []
}>()

function onBackdropClick() {
  if (closeOnBackdrop) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="onBackdropClick">
        <div class="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm" @click="onBackdropClick" />
        <div v-if="isAdmin" :class="['relative bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-gray-600 w-full mx-auto', maxWidth]">
          <div v-if="title || $slots.header" class="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-300 dark:border-gray-600">
            <h2 class="text-sm  text-gray-900 dark:text-gray-100">{{ title }}</h2>
            <button @click="emit('close')" class="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="px-4 py-3 containerModal">
            <slot />
          </div>
          <div v-if="$slots.footer" class="flex justify-end gap-3 px-4 pb-4 pt-3 border-t border-gray-300 dark:border-gray-600">
            <slot name="footer" />
          </div>
        </div>
        <div v-else :class="['relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-slate-700 w-full mx-auto', maxWidth]">
          <div v-if="title || $slots.header" class="flex items-center justify-between px-6 pt-6 pb-2">
            <h2 class="text-base  text-gray-900 dark:text-gray-100">{{ title }}</h2>
            <button @click="emit('close')" class="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all duration-150">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="px-6 py-4"><slot /></div>
          <div v-if="$slots.footer" class="flex justify-end gap-3 px-6 pb-6 pt-4 border-t border-gray-50 dark:border-slate-700"><slot name="footer" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style> 
.containerModal{
  max-height: 700px;
  overflow-y: auto;
}
</style>