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
        

// ------------------------------------------------------------
// Türen aus Editor-Tab aktivieren (nutzt den alten Tür-Button)
// ------------------------------------------------------------
container.querySelectorAll("[data-element^='door-']").forEach(btn => {
    btn.addEventListener("click", () => {

        const subtype = btn.dataset.element.replace("door-", "");
        console.log("[UI] Tür-Button geklickt:", btn.dataset.element, "→ subtype:", subtype);

        // Türtyp im RoomDesigner setzen (für spätere Darstellung/Logik)
        if (RoomDesigner && typeof RoomDesigner.setTool === "function") {
            RoomDesigner.setTool("door", subtype);
        }

        // Alten, funktionierenden Tür-Button auslösen
        const doorBtn = document.getElementById("btnDoorMode");
        if (doorBtn) {
            doorBtn.click();
        }
    });
});



        
    },

renderEditorDevicesPanel(container) {
    container.innerHTML = `
        <div class="editor-section-title">SmartDevices</div>
        <div id="editor-smartdevices" class="editor-list"></div>

        <div class="editor-section-title">Szenen</div>
        <div id="editor-scenes" class="editor-list"></div>
        <button id="scene-add" class="editor-btn">Neue Szene</button>

        <div class="editor-section-title">Zeitprogramme</div>
        <div id="editor-programs" class="editor-list"></div>
        <button id="program-add" class="editor-btn">Neues Zeitprogramm</button>
    `;

    // --------------------------------------------------
    // SmartDevices anzeigen
    // --------------------------------------------------
    const smartList = container.querySelector("#editor-smartdevices");
    smartList.innerHTML = "";

    SmartHomeData.devices.forEach(dev => {
        const row = document.createElement("div");
        row.className = "editor-device-row";
        row.textContent = dev.name;

        row.addEventListener("click", () => {
            RoomDesigner.assignSmartDevice(dev.id);
        });

        smartList.appendChild(row);
    });

    // --------------------------------------------------
    // Szenen anzeigen
    // --------------------------------------------------
    const sceneList = container.querySelector("#editor-scenes");
    sceneList.innerHTML = "";

    SmartHomeData.scenes.forEach(scene => {
        const row = document.createElement("div");
        row.className = "editor-scene-row";
        row.innerHTML = `
            <span>${scene.name}</span>
            <button data-id="${scene.id}" data-action="edit">Bearbeiten</button>
            <button data-id="${scene.id}" data-action="delete">Löschen</button>
        `;

        row.querySelector("[data-action='edit']").addEventListener("click", () => {
            RoomDesigner.editScene(scene.id);
        });

        row.querySelector("[data-action='delete']").addEventListener("click", () => {
            RoomDesigner.deleteScene(scene.id);
        });

        sceneList.appendChild(row);
    });

    container.querySelector("#scene-add").addEventListener("click", () => {
        RoomDesigner.addScene();
    });

    // --------------------------------------------------
    // Zeitprogramme anzeigen
    // --------------------------------------------------
    const programList = container.querySelector("#editor-programs");
    programList.innerHTML = "";

    SmartHomeData.programs.forEach(program => {
        const row = document.createElement("div");
        row.className = "editor-program-row";
        row.innerHTML = `
            <span>${program.name}</span>
            <button data-id="${program.id}" data-action="edit">Bearbeiten</button>
            <button data-id="${program.id}" data-action="delete">Löschen</button>
        `;

        row.querySelector("[data-action='edit']").addEventListener("click", () => {
            RoomDesigner.editProgram(program.id);
        });

        row.querySelector("[data-action='delete']").addEventListener("click", () => {
            RoomDesigner.deleteProgram(program.id);
        });

        programList.appendChild(row);
    });

    container.querySelector("#program-add").addEventListener("click", () => {
        RoomDesigner.addProgram();
    });
},

renderEditorOptionsPanel(container) {
    container.innerHTML = `
        <div class="editor-section-title">Export / Import</div>
        <div class="editor-list">
            <button id="opt-export-object">Objekt exportieren</button>
            <button id="opt-import-object">Objekt importieren</button>
            <button id="opt-export-room">Raum exportieren</button>
            <button id="opt-import-room">Raum importieren</button>
            <button id="opt-export-scenes">Szenen exportieren</button>
            <button id="opt-import-scenes">Szenen importieren</button>
            <button id="opt-export-programs">Zeitprogramme exportieren</button>
            <button id="opt-import-programs">Zeitprogramme importieren</button>
        </div>

        <div class="editor-section-title">Synchronisation</div>
        <div class="editor-settings">
            <label>Sync aktiv: <input type="checkbox" id="opt-sync-enabled"></label>
            <label>Sync-Modus:
                <select id="opt-sync-mode">
                    <option value="push">Push</option>
                    <option value="pull">Pull</option>
                    <option value="both">Beides</option>
                </select>
            </label>
            <button id="opt-sync-now">Jetzt synchronisieren</button>
        </div>

        <div class="editor-section-title">Standardraum</div>
        <div class="editor-settings">
            <label>Standardraum:
                <select id="opt-default-room"></select>
            </label>
            <label>Auto-Return aktiv:
                <input type="checkbox" id="opt-autoreturn-enabled">
            </label>
            <label>Auto-Return nach (Sekunden):
                <input type="number" id="opt-autoreturn-time" min="5" max="3600">
            </label>
        </div>

        <div class="editor-section-title">Benutzerverwaltung</div>
        <div class="editor-list">
            <button id="opt-user-add">Benutzer hinzufügen</button>
            <button id="opt-user-edit">Benutzer bearbeiten</button>
            <button id="opt-user-delete">Benutzer löschen</button>
            <button id="opt-user-pin">PIN / Passwort setzen</button>
        </div>

        <div class="editor-section-title">Backup / Restore</div>
        <div class="editor-list">
            <button id="opt-backup">Backup erstellen</button>
            <button id="opt-restore">Backup wiederherstellen</button>
        </div>

        <div class="editor-section-title">Debug / Tools</div>
        <div class="editor-list">
            <button id="opt-debug-log">Debug-Log anzeigen</button>
            <button id="opt-debug-clear">Debug-Log löschen</button>
            <button id="opt-debug-performance">Performance-Profiling</button>
        </div>
    `;

    // --------------------------------------------------
    // Standardraum-Liste füllen
    // --------------------------------------------------
    const roomSelect = container.querySelector("#opt-default-room");
    SmartHomeData.rooms.forEach(room => {
        const opt = document.createElement("option");
        opt.value = room.id;
        opt.textContent = room.name;
        roomSelect.appendChild(opt);
    });

    // --------------------------------------------------
    // Events an RoomDesigner weiterleiten
    // --------------------------------------------------
    container.querySelector("#opt-export-object").addEventListener("click", () => {
        RoomDesigner.exportObject();
    });

    container.querySelector("#opt-import-object").addEventListener("click", () => {
        RoomDesigner.importObject();
    });

    container.querySelector("#opt-export-room").addEventListener("click", () => {
        RoomDesigner.exportRoom();
    });

    container.querySelector("#opt-import-room").addEventListener("click", () => {
        RoomDesigner.importRoom();
    });

    container.querySelector("#opt-export-scenes").addEventListener("click", () => {
        RoomDesigner.exportScenes();
    });

    container.querySelector("#opt-import-scenes").addEventListener("click", () => {
        RoomDesigner.importScenes();
    });

    container.querySelector("#opt-export-programs").addEventListener("click", () => {
        RoomDesigner.exportPrograms();
    });

    container.querySelector("#opt-import-programs").addEventListener("click", () => {
        RoomDesigner.importPrograms();
    });

    container.querySelector("#opt-sync-now").addEventListener("click", () => {
        RoomDesigner.syncNow();
    });

    container.querySelector("#opt-user-add").addEventListener("click", () => {
        RoomDesigner.addUser();
    });

    container.querySelector("#opt-user-edit").addEventListener("click", () => {
        RoomDesigner.editUser();
    });

    container.querySelector("#opt-user-delete").addEventListener("click", () => {
        RoomDesigner.deleteUser();
    });

    container.querySelector("#opt-user-pin").addEventListener("click", () => {
        RoomDesigner.setUserPin();
    });

    container.querySelector("#opt-backup").addEventListener("click", () => {
        RoomDesigner.backup();
    });

    container.querySelector("#opt-restore").addEventListener("click", () => {
        RoomDesigner.restore();
    });

    container.querySelector("#opt-debug-log").addEventListener("click", () => {
        RoomDesigner.showDebugLog();
    });

    container.querySelector("#opt-debug-clear").addEventListener("click", () => {
        RoomDesigner.clearDebugLog();
    });

    container.querySelector("#opt-debug-performance").addEventListener("click", () => {
        RoomDesigner.profilePerformance();
    });
}


};
