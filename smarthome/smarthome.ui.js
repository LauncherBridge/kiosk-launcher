window.SmartHomeUI = {

    init() {
        this.bindObjectHeader();
        this.renderSidebar();
        this.bindSmartHomeEvents();
        this.initRightTabs(); // Standard: View-Modus Tabs
    },

    // --------------------------------------------------
    // Objekt-Header (O3 Overlay)
    // --------------------------------------------------
    bindObjectHeader() {
        const header = document.getElementById("sh-object-header");
        const overlay = document.getElementById("sh-object-overlay");

        header.addEventListener("click", () => {
            overlay.classList.toggle("hidden");
        });

        overlay.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", () => {
                const action = btn.dataset.action;
                SmartHomeModule.handleObjectAction(action);
                overlay.classList.add("hidden");
            });
        });

        document.addEventListener("click", (e) => {
            if (!overlay.contains(e.target) && !header.contains(e.target)) {
                overlay.classList.add("hidden");
            }
        });
    },

    // --------------------------------------------------
    // Sidebar Rendering
    // --------------------------------------------------
    renderSidebar() {
        this.renderFloors();
        this.renderRooms();
        this.renderStatus();
        this.renderFavorites();
    },

    renderFloors() {
        const container = document.getElementById("sh-floors");
        container.innerHTML = "";

        SmartHomeData.floors.forEach(floor => {
            const div = document.createElement("div");
            div.className = "sh-floor-item";
            div.textContent = floor.name;

            div.addEventListener("click", () => {
                SmartHomeView.setFloor(floor.id);
                this.renderRooms();
                this.updateBreadcrumb();
            });

            container.appendChild(div);
        });
    },

    renderRooms() {
        const container = document.getElementById("sh-rooms");
        container.innerHTML = "";

        const activeFloor = SmartHomeView.activeFloor;
        if (!activeFloor) return;

        const rooms = SmartHomeData.rooms.filter(r => r.floor === activeFloor);

        rooms.forEach(room => {
            const div = document.createElement("div");
            div.className = "sh-room-item";
            div.textContent = room.name;

            div.addEventListener("click", () => {
                SmartHomeView.setRoom(room.id);
                this.updateBreadcrumb();
            });

            container.appendChild(div);
        });
    },

    renderStatus() {
        document.getElementById("sh-status-devices").textContent =
            SmartHomeData.devices.length;

        document.getElementById("sh-status-conn").textContent =
            SmartHomeData.connectionStatus || "OK";

        document.getElementById("sh-status-warn").textContent =
            SmartHomeData.warnings.length;
    },

    renderFavorites() {
        const container = document.querySelector("#sh-favorites .fav-list");
        container.innerHTML = "";

        SmartHomeData.favorites.forEach(roomId => {
            const room = SmartHomeData.rooms.find(r => r.id === roomId);
            if (!room) return;

            const div = document.createElement("div");
            div.className = "sh-fav-item";
            div.textContent = room.name;

            div.addEventListener("click", () => {
                SmartHomeView.setRoom(room.id);
                this.updateBreadcrumb();
            });

            container.appendChild(div);
        });
    },

    // --------------------------------------------------
    // Breadcrumbs
    // --------------------------------------------------
    updateBreadcrumb() {
        const bc = document.getElementById("sh-breadcrumb");

        const floor = SmartHomeData.floors.find(f => f.id === SmartHomeView.activeFloor);
        const room = SmartHomeData.rooms.find(r => r.id === SmartHomeView.activeRoom);

        bc.textContent = floor && room
            ? `${floor.name} → ${room.name}`
            : "";
    },

    // --------------------------------------------------
    // SmartHomeView Events
    // --------------------------------------------------
    bindSmartHomeEvents() {
        document.addEventListener("SmartHomeView:roomChanged", () => {
            this.updateBreadcrumb();
        });

        document.addEventListener("SmartHomeView:floorChanged", () => {
            this.renderRooms();
            this.updateBreadcrumb();
        });
    },

    // --------------------------------------------------
    // Rechte Sidebar: View-Modus Tabs
    // --------------------------------------------------
    initRightTabs() {
        const tabsContainer = document.getElementById("sh-right-tabs");
        const content = document.getElementById("sh-right-content");

        const tabs = [
            { id: "devices", label: "Geräte" },
            { id: "actions", label: "Aktionen" },
            { id: "info",    label: "Info" }
        ];

        tabsContainer.innerHTML = "";
        content.innerHTML = "";

        tabs.forEach(tab => {
            const btn = document.createElement("button");
            btn.className = "sh-right-tab";
            btn.dataset.tab = tab.id;
            btn.textContent = tab.label;

            btn.addEventListener("click", () => {
                this.setRightTab(tab.id);
            });

            tabsContainer.appendChild(btn);
        });

        // Standard-Tab
        this.setRightTab("devices");
    },

    setRightTab(tabId) {
        const content = document.getElementById("sh-right-content");

        document.querySelectorAll(".sh-right-tab").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tabId);
        });

        if (tabId === "devices") {
            this.renderDevicesPanel(content);
        } else if (tabId === "actions") {
            this.renderActionsPanel(content);
        } else if (tabId === "info") {
            this.renderInfoPanel(content);
        }
    },

    renderDevicesPanel(container) {
        container.innerHTML = "";

        const roomId = SmartHomeView.activeRoom;
        if (!roomId) {
            container.textContent = "Kein Raum ausgewählt.";
            return;
        }

        const devices = SmartHomeData.devices.filter(d => d.room === roomId);

        if (!devices.length) {
            container.textContent = "Keine Geräte in diesem Raum.";
            return;
        }

        const list = document.createElement("div");
        list.className = "sh-device-list";

        devices.forEach(dev => {
            const row = document.createElement("div");
            row.className = "sh-device-row";
            row.textContent = dev.name;
            list.appendChild(row);
        });

        container.appendChild(list);
    },

    renderActionsPanel(container) {
        container.innerHTML = `
            <div class="sh-actions-placeholder">
                Aktionen für diesen Raum / dieses Objekt folgen später.
            </div>
        `;
    },

    renderInfoPanel(container) {
        const roomId = SmartHomeView.activeRoom;
        const room = SmartHomeData.rooms.find(r => r.id === roomId);

        container.innerHTML = "";

        if (!room) {
            container.textContent = "Keine Raum-Informationen verfügbar.";
            return;
        }

        const div = document.createElement("div");
        div.className = "sh-info-panel";
        div.innerHTML = `
            <div><strong>Raum:</strong> ${room.name}</div>
            <div><strong>ID:</strong> ${room.id}</div>
            <div><strong>Etage:</strong> ${room.floor}</div>
        `;
        container.appendChild(div);
    },

    // --------------------------------------------------
    // Rechte Sidebar: Umschalten View <-> Editor
    // --------------------------------------------------
    setRightPanelForMode(mode) {
        if (mode === "view") {
            this.initRightTabs();
        }

        if (mode === "editor") {
            this.initEditorTabs();
        }
    },

    // --------------------------------------------------
    // Editor-Modus Tabs
    // --------------------------------------------------
    initEditorTabs() {
        const tabsContainer = document.getElementById("sh-right-tabs");
        const content = document.getElementById("sh-right-content");

        const tabs = [
            { id: "editor-elements", label: "Elemente" },
            { id: "editor-devices",  label: "SmartDevices" },
            { id: "editor-options",  label: "Optionen" }
        ];

        tabsContainer.innerHTML = "";
        content.innerHTML = "";

        tabs.forEach(tab => {
            const btn = document.createElement("button");
            btn.className = "sh-right-tab";
            btn.dataset.tab = tab.id;
            btn.textContent = tab.label;

            btn.addEventListener("click", () => {
                this.setEditorTab(tab.id);
            });

            tabsContainer.appendChild(btn);
        });

        // Standard-Tab
        this.setEditorTab("editor-elements");
    },

    setEditorTab(tabId) {
        const content = document.getElementById("sh-right-content");

        document.querySelectorAll(".sh-right-tab").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tabId);
        });

        if (tabId === "editor-elements") {
            this.renderEditorElementsPanel(content);
        } else if (tabId === "editor-devices") {
            this.renderEditorDevicesPanel(content);
        } else if (tabId === "editor-options") {
            this.renderEditorOptionsPanel(content);
        }
    },

    // --------------------------------------------------
    // Schritt 6: Editor Panels (mit Werkzeugen)
    // --------------------------------------------------
    renderEditorElementsPanel(container) {
        container.innerHTML = `
            <div class="editor-section-title">Werkzeuge</div>
            <div class="editor-tools">
                <button data-tool="select">Auswahl</button>
                <button data-tool="move">Verschieben</button>
                <button data-tool="delete">Löschen</button>
                <button data-tool="undo">Undo</button>
                <button data-tool="redo">Redo</button>
            </div>

            <div class="editor-section-title">Türen</div>
            <div class="editor-list">
                <button data-element="door-front">Haustür</button>
                <button data-element="door-room">Zimmertür</button>
                <button data-element="door-fold">Falttür</button>
                <button data-element="door-slide">Schiebetür</button>
                <button data-element="door-terrace">Terrassentür</button>
                <button data-element="door-garage">Garagentor</button>
                <button data-element="door-garden">Gartentörchen</button>
                <button data-element="door-roof">Dachluke</button>
            </div>

            <div class="editor-section-title">Fenster</div>
            <div class="editor-list">
                <button data-element="window-normal">Fenster</button>
                <button data-element="window-double">Doppelfenster</button>
                <button data-element="window-tilt">Kippfenster</button>
                <button data-element="window-slide">Schiebefenster</button>
                <button data-element="window-round">Rundfenster</button>
                <button data-element="window-roof">Dachfenster</button>
                <button data-element="window-shutter">Fenster + Rolladen</button>
            </div>

            <div class="editor-section-title">Möbel</div>
            <div class="editor-list">
                <button data-element="furniture-sofa">Sofa</button>
                <button data-element="furniture-table">Tisch</button>
                <button data-element="furniture-bed">Bett</button>
                <button data-element="furniture-wardrobe">Schrank</button>
                <button data-element="furniture-kitchen">Küchenmodul</button>
            </div>

            <div class="editor-section-title">E-Geräte</div>
            <div class="editor-list">
                <button data-element="device-fridge">Kühlschrank</button>
                <button data-element="device-stove">Herd</button>
                <button data-element="device-tv">Fernseher</button>
                <button data-element="device-washer">Waschmaschine</button>
            </div>

            <div class="editor-section-title">SmartDevice-Container</div>
            <div class="editor-list">
                <button data-element="smart-box">SmartDevice-Box</button>
            </div>

            <div class="editor-section-title">Gartenelemente</div>
            <div class="editor-list">
                <button data-element="garden-plant">Pflanze</button>
                <button data-element="garden-awning">Markise</button>
                <button data-element="garden-furniture">Gartenmöbel</button>
            </div>

            <div class="editor-section-title">Darstellung</div>
            <div class="editor-settings">
                <label>Farbe: <input type="color" id="editor-color"></label>
                <label>Transparenz: <input type="range" min="0" max="100" id="editor-alpha"></label>
                <label>Wandstärke: <input type="number" min="1" max="50" id="editor-wall"></label>
                <label>Punkte anzeigen: <input type="checkbox" id="editor-showpoints"></label>
            </div>

            <div class="editor-section-title">Snap & Grid</div>
            <div class="editor-settings">
                <label>Snap aktiv: <input type="checkbox" id="editor-snap"></label>
                <label>Grid anzeigen: <input type="checkbox" id="editor-grid"></label>
                <label>Grid-Größe: <input type="number" min="5" max="200" id="editor-gridsize"></label>
            </div>
        `;

        // Events an RoomDesigner weiterleiten
        container.querySelectorAll("[data-tool]").forEach(btn => {
            btn.addEventListener("click", () => {
                RoomDesigner.setTool(btn.dataset.tool);
            });
        });

        container.querySelectorAll("[data-element]").forEach(btn => {
            btn.addEventListener("click", () => {
                RoomDesigner.setElement(btn.dataset.element);
            });
        });
    },

    renderEditorDevicesPanel(container) {
        container.innerHTML = `
            <div class="editor-placeholder">
                SmartDevices, Szenen & Zeitprogramme (Tab 2)<br>
                Inhalte folgen in Schritt 7.
            </div>
        `;
    },

    renderEditorOptionsPanel(container) {
        container.innerHTML = `
            <div class="editor-placeholder">
                Allgemeine Optionen (Tab 3)<br>
                Inhalte folgen in Schritt 8.
            </div>
        `;
    }

};
