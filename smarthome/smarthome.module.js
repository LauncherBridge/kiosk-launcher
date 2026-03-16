// SmartHome Module Entry Point

window.SmartHomeModule = {
    state: {
        panelId: null,
        defaultRoom: null,
        category: null,
        initialized: false
    },

    init() {
        // Standard‑Initialisierung, wie vom Kiosk erwartet
        this.open({
            panelId: "smarthome-root",
            defaultRoom: null,
            category: null
        });
    },

    open(config) {
        // Save configuration
        this.state.panelId = config.panelId;
        this.state.defaultRoom = config.defaultRoom;
        this.state.category = config.category;

        // Mark as initialized
        this.state.initialized = true;

        // Apply theme if available
        if (window.SmartHomeTheme) {
            SmartHomeTheme.apply();
        }

        // Direkt initialisieren – kein Template nachladen
        this._startView();
    },

    _startView() {
        const container = document.getElementById(this.state.panelId);
        if (!container) {
            console.error("SmartHomeModule: Panel container not found:", this.state.panelId);
            return;
        }

        // Starte das Rendering
        if (window.SmartHomeView) {
            SmartHomeView.init();
        } else {
            console.error("SmartHomeView not found");
        }
    },

    _showPlaceholder() {
        const container = document.getElementById(this.state.panelId);
        if (!container) return;

        container.innerHTML = `
            <div style="
                color: white;
                font-size: 20px;
                padding: 20px;
                font-family: sans-serif;
            ">
                SmartHome Modul geladen.<br>
                (Rendering folgt in Schritt 2)
            </div>
        `;
    }
};
