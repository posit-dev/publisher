import { render, fireEvent } from '@testing-library/vue'
import Button from './Button.vue'

describe('tests', () => {
	test('normal imports as expected', async () => {
		const component = await import('./Button.vue')
		expect(component).toBeDefined()
	})

	it('increments value on click', async () => {
		const { getByText } = render(Button)
		const button = getByText('Increment')

		getByText('Times clicked: 0')

		await fireEvent.click(button)
		await fireEvent.click(button)

		getByText('Times clicked: 2')
	})
})
