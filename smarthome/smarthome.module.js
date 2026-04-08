// SmartHome Module Entry Point
window.SmartHomeModule = {

    state: {
        panelId: "smarthome-canvas",
        mode: "view",              // "view" | "editor"
        defaultRoom: null,
        category: null,
        initialized: false
    },

    init() {
        // Standard‑Initialisierung, wie vom Kiosk erwartet
        this.open({
            panelId: "smarthome-canvas",
            defaultRoom: null,
            category: null
        });
    },

    open(config) {

        // Neuer Mount-Punkt für die neue UI-Struktur
        this.state.panelId = "smarthome-canvas";

        // Falls du defaultRoom/category nutzt, übernehmen wir sie weiterhin
        this.state.defaultRoom = config.defaultRoom || null;
        this.state.category = config.category || null;

        // Standardmodus: SmartHome-View
        this.setMode("view");
    },

    // --------------------------------------------------
    // Modus wechseln (SmartHome <-> Editor)
    // --------------------------------------------------
    setMode(mode) {
        if (mode !== "view" && mode !== "editor") {
            console.error("SmartHomeModule: Invalid mode:", mode);
            return;
        }

        // Zugangsschutz-Hook (noch ohne Mechanismus)
        if (mode === "editor" && !this.canEnterEditor()) {
            this.requestEditorAuth();
            return;
        }

        this.state.mode = mode;

        const viewCanvas = document.getElementById("smarthome-canvas");
        const editorCanvas = document.getElementById("roomdesigner");

        if (!viewCanvas || !editorCanvas) {
            console.error("SmartHomeModule: Canvas elements missing");
            return;
        }

        if (mode === "view") {
            // SmartHomeView aktivieren
            viewCanvas.style.display = "block";
            editorCanvas.style.display = "none";

            this._startView();
        }

        if (mode === "editor") {
            // Editor aktivieren
            viewCanvas.style.display = "none";
            editorCanvas.style.display = "block";

            if (window.RoomDesigner) {
                RoomDesigner.init();
            } else {
                console.error("RoomDesigner not found");
            }
        }
    },

    // --------------------------------------------------
    // SmartHomeView starten
    // --------------------------------------------------
    _startView() {
        const container = document.getElementById(this.state.panelId);
        if (!container) {
            console.error("SmartHomeModule: Panel container not found:", this.state.panelId);
            return;
        }

        if (window.SmartHomeView) {
            SmartHomeView.init();
        } else {
            console.error("SmartHomeView not found");
        }
    },

    // --------------------------------------------------
    // Objekt-Overlay Aktionen
    // --------------------------------------------------
    handleObjectAction(action) {
        switch (action) {

            case "edit-object":
                this.setMode("editor");
                break;

            case "select-object":
                console.log("Objekt wechseln – später implementieren");
                break;

            case "new-object":
                console.log("Neues Objekt erstellen – später implementieren");
                break;

            default:
                console.warn("Unknown object action:", action);
        }
    },

    // --------------------------------------------------
    // Zugangsschutz (Platzhalter)
    // --------------------------------------------------
    canEnterEditor() {
        // später: Passwort / Fingerabdruck / Session
        return true;
    },

    requestEditorAuth() {
        alert("Editor-Zugang ist geschützt. Authentifizierung folgt später.");
    },

    // --------------------------------------------------
    // Debug / Placeholder
    // --------------------------------------------------
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
