<script setup lang="ts">
import ThemeSwitcher from "@/components/theme-switcher.vue"
</script>

<template>
  <div class="border-b">
    <div class="flex justify-between h-16 items-center px-4">
      <div class="scroll-m-20 text-2xl font-semibold tracking-tight select-none">
        Alarm
      </div>
      <ThemeSwitcher />
    </div>
  </div>
  <div class="p-4">
    Hello
  </div>
</template>
