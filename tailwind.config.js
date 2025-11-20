/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{html,js,svelte,ts}'],
    theme: {
        extend: {
            colors: {
                // Apple-style dark mode palette
                'ios-bg': '#000000',
                'ios-card': '#1c1c1e',
                'ios-blue': '#0a84ff',
                'ios-green': '#30d158',
                'ios-red': '#ff453a',
                'ios-gray': '#8e8e93',
                'ios-separator': '#38383a'
            },
            fontFamily: {
                sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
            }
        },
    },
    plugins: [],
    darkMode: 'class'
}
