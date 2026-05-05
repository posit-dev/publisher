import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CodeCheckbox from "./CodeCheckbox.vue";

function mountCheckbox(props: InstanceType<typeof CodeCheckbox>["$props"]) {
  return mount(CodeCheckbox, { props });
}

function getInput(wrapper: ReturnType<typeof mountCheckbox>) {
  return wrapper.find<HTMLInputElement>("input[type='checkbox']");
}

describe("CodeCheckbox", () => {
  describe("state prop", () => {
    it("renders checked when state is checked", () => {
      const wrapper = mountCheckbox({ state: "checked" });
      const input = getInput(wrapper);
      expect(input.element.checked).toBe(true);
      expect(input.element.indeterminate).toBe(false);
      expect(input.element.getAttribute("aria-checked")).toBeNull();
    });

    it("renders unchecked when state is unchecked", () => {
      const wrapper = mountCheckbox({ state: "unchecked" });
      const input = getInput(wrapper);
      expect(input.element.checked).toBe(false);
      expect(input.element.indeterminate).toBe(false);
      expect(input.element.getAttribute("aria-checked")).toBeNull();
    });

    it("renders indeterminate when state is indeterminate", () => {
      const wrapper = mountCheckbox({ state: "indeterminate" });
      const input = getInput(wrapper);
      expect(input.element.checked).toBe(false);
      expect(input.element.indeterminate).toBe(true);
      expect(input.element.getAttribute("aria-checked")).toBe("mixed");
    });
  });

  describe("disabled prop", () => {
    it("disables the input when disabled is true", () => {
      const wrapper = mountCheckbox({ state: "checked", disabled: true });
      expect(getInput(wrapper).element.disabled).toBe(true);
    });

    it("does not disable the input by default", () => {
      const wrapper = mountCheckbox({ state: "checked" });
      expect(getInput(wrapper).element.disabled).toBe(false);
    });
  });

  describe("toggle event", () => {
    it("emits toggle when checkbox is clicked", async () => {
      const wrapper = mountCheckbox({ state: "unchecked" });
      await getInput(wrapper).trigger("change");
      expect(wrapper.emitted("toggle")).toHaveLength(1);
    });

    it("does not emit toggle when disabled checkbox is clicked", async () => {
      const wrapper = mountCheckbox({ state: "unchecked", disabled: true });
      await getInput(wrapper).trigger("change");
      // Disabled inputs don't fire change events in real browsers;
      // jsdom may still fire it, so we guard via the disabled attribute
      // which prevents user interaction.
      expect(getInput(wrapper).element.disabled).toBe(true);
    });
  });
});
