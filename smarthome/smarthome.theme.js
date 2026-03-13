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

    spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px"
},

radius: {
    sm: "6px",
    md: "12px",
    lg: "20px"
},

shadow: {
    soft: "0 4px 12px rgba(0,0,0,0.25)",
    strong: "0 6px 20px rgba(0,0,0,0.35)"
},

    apply() {
        const root = document.documentElement;

        root.style.setProperty("--sh-bg", this.colors.background);
        root.style.setProperty("--sh-surface", this.colors.surface);
        root.style.setProperty("--sh-surface-light", this.colors.surfaceLight);
        root.style.setProperty("--sh-text", this.colors.text);
        root.style.setProperty("--sh-text-dim", this.colors.textDim);
        root.style.setProperty("--sh-accent", this.colors.accent);
        root.style.setProperty("--sh-space-xs", this.spacing.xs);
        root.style.setProperty("--sh-space-sm", this.spacing.sm);
        root.style.setProperty("--sh-space-md", this.spacing.md);
        root.style.setProperty("--sh-space-lg", this.spacing.lg);
        root.style.setProperty("--sh-space-xl", this.spacing.xl);
        
        root.style.setProperty("--sh-radius-sm", this.radius.sm);
        root.style.setProperty("--sh-radius-md", this.radius.md);
        root.style.setProperty("--sh-radius-lg", this.radius.lg);
        
        root.style.setProperty("--sh-shadow-soft", this.shadow.soft);
        root.style.setProperty("--sh-shadow-strong", this.shadow.strong);

    }
};

