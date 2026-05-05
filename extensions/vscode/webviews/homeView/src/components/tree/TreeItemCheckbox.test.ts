import { describe, it, expect } from "vitest";
import { shallowMount } from "@vue/test-utils";
import TreeItemCheckbox from "./TreeItemCheckbox.vue";

function mountComponent(
  props: Partial<InstanceType<typeof TreeItemCheckbox>["$props"]> = {},
) {
  return shallowMount(TreeItemCheckbox, {
    props: {
      title: "test-file.txt",
      state: "unchecked",
      ...props,
    },
  });
}

function getCodeCheckbox(wrapper: ReturnType<typeof mountComponent>) {
  return wrapper.findComponent({ name: "CodeCheckbox" });
}

describe("TreeItemCheckbox", () => {
  describe("state passthrough", () => {
    it("passes checked state to CodeCheckbox", () => {
      const wrapper = mountComponent({ state: "checked" });
      expect(getCodeCheckbox(wrapper).props("state")).toBe("checked");
    });

    it("passes unchecked state to CodeCheckbox", () => {
      const wrapper = mountComponent({ state: "unchecked" });
      expect(getCodeCheckbox(wrapper).props("state")).toBe("unchecked");
    });

    it("passes indeterminate state to CodeCheckbox", () => {
      const wrapper = mountComponent({ state: "indeterminate" });
      expect(getCodeCheckbox(wrapper).props("state")).toBe("indeterminate");
    });
  });

  describe("toggle event routing", () => {
    it("emits uncheck when toggled from checked state", async () => {
      const wrapper = mountComponent({ state: "checked" });
      await getCodeCheckbox(wrapper).vm.$emit("toggle");
      expect(wrapper.emitted("uncheck")).toHaveLength(1);
      expect(wrapper.emitted("check")).toBeUndefined();
    });

    it("emits check when toggled from unchecked state", async () => {
      const wrapper = mountComponent({ state: "unchecked" });
      await getCodeCheckbox(wrapper).vm.$emit("toggle");
      expect(wrapper.emitted("check")).toHaveLength(1);
      expect(wrapper.emitted("uncheck")).toBeUndefined();
    });

    it("emits check when toggled from indeterminate state", async () => {
      const wrapper = mountComponent({ state: "indeterminate" });
      await getCodeCheckbox(wrapper).vm.$emit("toggle");
      expect(wrapper.emitted("check")).toHaveLength(1);
      expect(wrapper.emitted("uncheck")).toBeUndefined();
    });
  });

  describe("rendering", () => {
    it("passes the title prop", () => {
      const wrapper = mountComponent({ title: "my-file.py" });
      expect(wrapper.props("title")).toBe("my-file.py");
    });

    it("sets tooltip as title attribute on the container", () => {
      const wrapper = mountComponent({ tooltip: "Some tooltip text" });
      const container = wrapper.find("[title='Some tooltip text']");
      expect(container.exists()).toBe(true);
    });
  });
});
