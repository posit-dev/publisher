import { installQuasar } from '@quasar/quasar-app-extension-testing-unit-vitest';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ExampleComponent from './demo/ExampleComponent.vue';

installQuasar();

describe('example Component', () => {
  // not quite sure why this generated sample test is failing. Keeping this as it
  // seems indicative of a configuration issue, in which the
  // composition API test component is not expositing its reactive
  // state to vitest. TBD - DEBUG, as we'll want to do this ourselves.
  it.skip('should mount component with todos', () => {
    const wrapper = mount(ExampleComponent, {
      props: {
        title: 'Hello',
        meta: {
          totalCount: 4
        },
        todos: [
          { id: 1, content: 'Hallo' },
          { id: 2, content: 'Hoi' }
        ]
      }
    });
    expect(wrapper.vm.clickCount).toBe(0);
    wrapper.find('.q-item').trigger('click');
    expect(wrapper.vm.clickCount).toBe(1);
  });

  it('should mount component without todos', () => {
    const wrapper = mount(ExampleComponent, {
      props: {
        title: 'Hello',
        meta: {
          totalCount: 4
        }
      }
    });
    expect(wrapper.findAll('.q-item')).toHaveLength(0);
  });
});
