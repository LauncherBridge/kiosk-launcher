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
    // Editor Panels (Platzhalter)
    // --------------------------------------------------
    renderEditorElementsPanel(container) {
        container.innerHTML = `
            <div class="editor-placeholder">
                Elemente & Werkzeuge (Tab 1)<br>
                Inhalte folgen in Schritt 6.
            </div>
        `;
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
