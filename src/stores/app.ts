import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface AppConfig {
  theme: "light" | "dark";
}

export const useAppStore = defineStore("app", () => {
  const isInitialized = ref(false);
  const config = ref<AppConfig>({
    theme: "light",
  });


  function applyTheme(theme: "light" | "dark") {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  watch(
    () => config.value.theme,
    (newTheme) => applyTheme(newTheme),
    { immediate: true }
  );

  return {
    isInitialized,
    config,
    applyTheme,
  };
})