import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';
import colors from 'tailwindcss/colors';

// Inside the panel's main block (.qd-scope in resources/css/panel.css) these stock Tailwind families
// read the Qadam palette from --pal-* variables; everywhere else (public pages, login, the sidebar)
// the fallback keeps the stock colour, so those screens render exactly as before.
const PANEL_THEMED_FAMILIES = [
    'slate', 'gray', 'zinc', 'neutral', 'stone',
    'red', 'rose', 'orange', 'amber', 'yellow',
    'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo',
];

const hexToRgbChannels = (hex) => {
    const value = parseInt(hex.slice(1), 16);
    return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
};

const panelThemedColors = Object.fromEntries(
    PANEL_THEMED_FAMILIES.map((family) => [
        family,
        Object.fromEntries(
            Object.entries(colors[family]).map(([shade, hex]) => [
                shade,
                `rgb(var(--pal-${family}-${shade}, ${hexToRgbChannels(hex)}) / <alpha-value>)`,
            ]),
        ),
    ]),
);

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
    	extend: {
    		fontFamily: {
    			// Qadam headings in the panel's main block
    			display: ['Literata', 'Georgia', 'Times New Roman', 'serif'],
    			sans: [
    				'Google Sans',
                    ...defaultTheme.fontFamily.sans
                ],
    			mono: [
    				'Google Sans Code',
    				'Google Sans',
                    ...defaultTheme.fontFamily.mono
                ]
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		colors: {
    			...panelThemedColors,
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			}
    		},
    		keyframes: {
    			'fade-slide-up': {
    				'0%':   { opacity: '0', transform: 'translateY(28px)' },
    				'100%': { opacity: '1', transform: 'translateY(0)' },
    			},
    			'fade-in': {
    				'0%':   { opacity: '0' },
    				'100%': { opacity: '1' },
    			},
    			'modal-in': {
    				'0%':   { opacity: '0', transform: 'translateY(18px) scale(0.97)' },
    				'100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
    			},
    		},
    		animation: {
    			'fade-slide-up': 'fade-slide-up 0.55s cubic-bezier(0.23,1,0.32,1) both',
    			'fade-in':       'fade-in 0.25s ease both',
    			'modal-in':      'modal-in 0.32s cubic-bezier(0.23,1,0.32,1) both',
    		},
    	}
    },

    plugins: [forms, require("tailwindcss-animate")],
};
