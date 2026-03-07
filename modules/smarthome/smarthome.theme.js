// SmartHome Theme Definition

window.SmartHomeTheme = {
    colors: {
        background: "#12100E",
        surface: "#1A1816",
        surfaceLight: "#24211F",
        text: "#FFFFFF",
        textDim: "#C8C8C8",
        accent: "#FFB86C"
    },

    apply() {
        const root = document.documentElement;

        root.style.setProperty("--sh-bg", this.colors.background);
        root.style.setProperty("--sh-surface", this.colors.surface);
        root.style.setProperty("--sh-surface-light", this.colors.surfaceLight);
        root.style.setProperty("--sh-text", this.colors.text);
        root.style.setProperty("--sh-text-dim", this.colors.textDim);
        root.style.setProperty("--sh-accent", this.colors.accent);
    }
};

