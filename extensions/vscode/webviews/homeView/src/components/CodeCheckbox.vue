<template>
  <div class="vscode-checkbox" :class="{ disabled: disabled }">
    <label>
      <input
        :checked="checked"
        :disabled="disabled"
        type="checkbox"
        @change="handleChange"
      />
      <span class="icon">
        <i class="codicon codicon-check icon-checked"></i>
        <i class="codicon codicon-chrome-minimize icon-indeterminate"></i>
      </span>
      <span class="text"><slot /></span>
    </label>
  </div>
</template>

<script setup lang="ts">
defineProps<{ checked: boolean; disabled?: boolean }>();

const emit = defineEmits<{
  changed: [checked: boolean];
}>();

const handleChange = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  emit("changed", checked);
};
</script>

<style lang="scss" scoped>
.vscode-checkbox {
  display: inline-flex;
  flex: 1;
  position: relative;
  user-select: none;

  &.disabled {
    opacity: var(--disabled-opacity);
  }

  input[type="checkbox"] {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  .icon {
    background-color: var(--vscode-settings-checkboxBackground);
    background-size: 16px;
    border: calc(var(--border-width) * 1px) solid var(--checkbox-border);
    border-radius: calc(var(--checkbox-corner-radius) * 1px);
    box-sizing: border-box;
    color: var(--vscode-settings-checkboxForeground);
    display: flex;
    justify-content: center;
    margin-left: 0;
    padding: 0;
    pointer-events: none;
    position: relative;
    outline: none;
    height: calc(var(--design-unit) * 4px + 2px);
    width: calc(var(--design-unit) * 4px + 2px);
    flex-shrink: 0;
  }

  .icon-checked,
  .icon-indeterminate {
    display: none;
    height: 16px;
    left: 0;
    position: absolute;
    top: 0;
    width: 16px;
  }

  input[type="checkbox"]:checked ~ .icon .icon-checked {
    display: block;
  }

  input[type="checkbox"]:indeterminate ~ .icon .icon-indeterminate {
    display: block;
  }

  input[type="checkbox"]:invalid ~ .icon,
  input[type="checkbox"].invalid ~ .icon {
    background-color: var(--vscode-inputValidation-errorBackground);
    border-color: var(--vscode-inputValidation-errorBorder, #be1100);
  }

  input[type="checkbox"]:focus ~ .icon {
    border-color: var(--vscode-focusBorder);
  }

  label {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }

  &.disabled label {
    cursor: not-allowed;
  }

  .text {
    opacity: 0.9;
    padding-inline-start: calc(var(--design-unit) * 2px + 2px);
  }
}
</style>
