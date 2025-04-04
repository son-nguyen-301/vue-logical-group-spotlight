// Process color with opacity
export function processColor(color: string, defaultOpacity: number, isGroupName: boolean = false): string {
    // If the color already includes opacity (rgba or hsla), use it as is
    if (color.includes('rgba') || color.includes('hsla')) {
        if (isGroupName) {
            return color.replace(/[0-9.]+\)$/, '1.0)'); // Full opacity for group name
        }
        return color;
    }
    
    // For hex colors (#RRGGBB)
    if (color.match(/^#[0-9A-Fa-f]{6}$/)) {
        const opacity = Math.round((isGroupName ? 1.0 : defaultOpacity) * 255).toString(16).padStart(2, '0');
        return `${color}${opacity}`;
    }
    
    // For rgb colors
    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${isGroupName ? 1.0 : defaultOpacity})`);
    }
    
    // For hsl colors
    if (color.startsWith('hsl(')) {
        return color.replace('hsl(', 'hsla(').replace(')', `, ${isGroupName ? 1.0 : defaultOpacity})`);
    }

    return color;
} 