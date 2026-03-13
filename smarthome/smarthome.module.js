// SmartHome Module Entry Point

window.SmartHome = {
    state: {
        panelId: null,
        defaultRoom: null,
        category: null,
        initialized: false
    },

    open(config) {
        // Save configuration
        this.state.panelId = config.panelId;
        this.state.defaultRoom = config.defaultRoom;
        this.state.category = config.category;

        // Mark as initialized
        this.state.initialized = true;

        // Inject base HTML template
        this._loadTemplate();

        // Placeholder: visible confirmation
        this._showPlaceholder();
    },

    _loadTemplate() {
        const container = document.getElementById(this.state.panelId);
        if (!container) {
            console.error("SmartHome: Panel container not found:", this.state.panelId);
            return;
        }

        // Load template from smarthome.html (later replaced with real UI)
        fetch("modules/smarthome/smarthome.html")
            .then(res => res.text())
            .then(html => {
                container.innerHTML = html;
                SmartHomeView.init();
            });
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

