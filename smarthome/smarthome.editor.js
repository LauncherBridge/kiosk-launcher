migrateProjectsToID(); 
// ------------------------------------------------------------
//  ECHTE Fallback-Variante - JSON sind migriert
//  Create New Project klappt hier endlich.
// ------------------------------------------------------------


// ------------------------------------------------------------
// Globale Projekt-Daten (Persistenz-Grundstruktur)
// ------------------------------------------------------------
const project = {
    meta: {
        version: 1,
        created: Date.now(),
        modified: Date.now()
    },

    objects: {},     // Häuser/Wohnungen (später)
    floors: {},      // Etagen
    rooms: {},       // Räume
    doors: {},       // Türen
    windows: {},     // Fenster
    furniture: {},   // Möbel
    devices: {},     // Smart-Home-Geräte

    names: {}        // Alias-Namen für Titelzeile/Breadcrumbs



};



/* ---------------------------------------------------------
   GLOBAL CONTEXT MENU SYSTEM
--------------------------------------------------------- */

let contextMenuEl = null;
let contextMenuOutsideHandler = null;

// Globale Editor-States (bulletproof)
let activeMode = "editor";
let activeFloorId = null;
let activeRoomId = null;


function sanitizeProject(proj) {
    if (!proj || typeof proj !== "object") {
        console.warn("⚠️ Projekt ungültig – neu erzeugt.");
        return { meta:{}, floors:{}, rooms:{}, doors:{}, windows:{}, furniture:{}, devices:{} };
    }

    // Basisfelder sicherstellen
    proj.meta = proj.meta || {};
    proj.floors = proj.floors || {};
    proj.rooms = proj.rooms || {};
    proj.doors = proj.doors || {};
    proj.windows = proj.windows || {};
    proj.furniture = proj.furniture || {};
    proj.devices = proj.devices || {};

    // Etagen absichern (Etagen ohne Räume sind erlaubt!)
    for (const fid in proj.floors) {
        const f = proj.floors[fid];
        if (!f || typeof f !== "object") {
            proj.floors[fid] = { id: fid, name: "Etage", rooms: [] };
            continue;
        }
        f.rooms = Array.isArray(f.rooms) ? f.rooms : [];
    }

    // Räume absichern
    for (const rid in proj.rooms) {
        const r = proj.rooms[rid];
        if (!r || typeof r !== "object") {
            delete proj.rooms[rid];
            continue;
        }

        // floorId reparieren (wenn Etagen existieren)
        if (!r.floorId) {
            const floorIds = Object.keys(proj.floors);
            r.floorId = floorIds.length > 0 ? floorIds[0] : null;
        }

        // Punkte/Türen/Fenster absichern
        r.points = Array.isArray(r.points) ? r.points : [];
        r.doors = Array.isArray(r.doors) ? r.doors : [];
        r.windows = Array.isArray(r.windows) ? r.windows : [];
    }

    return proj;
}




function initContextMenuSystem() {
    contextMenuEl = document.getElementById("context-menu");
}





/**
 * Öffnet ein Kontextmenü an Position (x, y)
 * items = [{ label: "Text", action: () => {} }, ...]
 */
function openContextMenu(x, y, items) {
    if (!contextMenuEl) initContextMenuSystem();

    // Vorheriges Menü schließen
    closeContextMenu();

    // Inhalt aufbauen
    contextMenuEl.innerHTML = "";
    for (const item of items) {
        if (item.separator) {
            const sep = document.createElement("div");
            sep.className = "context-menu-separator";
            contextMenuEl.appendChild(sep);
            continue;
        }

        const el = document.createElement("div");
        el.className = "context-menu-item";
        el.textContent = item.label;

        el.addEventListener("click", () => {
            closeContextMenu();
            item.action();
        });

        contextMenuEl.appendChild(el);
    }

    // Position setzen
    contextMenuEl.style.left = x + "px";
    contextMenuEl.style.top = y + "px";

    // Sichtbar machen
    contextMenuEl.classList.add("visible");

    // Klick außerhalb → Menü schließen
    contextMenuOutsideHandler = (ev) => {
        if (!contextMenuEl.contains(ev.target)) {
            closeContextMenu();
        }
    };
    document.addEventListener("mousedown", contextMenuOutsideHandler);
}

/**
 * Schließt das Kontextmenü
 */
function closeContextMenu() {
    if (!contextMenuEl) return;

    contextMenuEl.classList.remove("visible");
    contextMenuEl.innerHTML = "";

    if (contextMenuOutsideHandler) {
        document.removeEventListener("mousedown", contextMenuOutsideHandler);
        contextMenuOutsideHandler = null;
    }
}

function attachFloorCrumbMenu() {
    const icon = document.querySelector(".crumb-floor-icon");
    if (!icon) return;

    icon.addEventListener("click", (ev) => {
        ev.stopPropagation();

        const rect = icon.getBoundingClientRect();
        const x = rect.left;
        const y = rect.bottom + 4;

        openContextMenu(x, y, [
            {
                label: "Neue Etage",
                action: () => editorCreateFloor()
            },
            {
                label: "Etage löschen",
                action: () => editorDeleteFloor(activeFloorId)
            }
        ]);
    });
}


// ------------------------------------------------------------
// Runtime-Generierung von SmartHomeData aus project
// ------------------------------------------------------------
function generateSmartHomeDataFromProject() {
    const data = {
        floors: [],
        rooms: [],
        doors: [],
        windows: [],
        furniture: [],
        devices: []
    };

    // ---------------------------------------------------------
    // 1) Etagen sammeln
    // ---------------------------------------------------------
    for (const fid in project.floors) {
        const f = project.floors[fid];
        if (!f || typeof f !== "object") continue;

        data.floors.push({
            id: f.id,
            name: f.name || "Etage",
            rooms: Array.isArray(f.rooms) ? [...f.rooms] : []
        });
    }

    // ---------------------------------------------------------
    // 2) Räume sammeln
    // ---------------------------------------------------------
    for (const rid in project.rooms) {
        const r = project.rooms[rid];
        if (!r || typeof r !== "object") continue;

        // Räume ohne Etage ignorieren
        if (!r.floorId || !project.floors[r.floorId]) {
            console.warn("[generateSmartHomeData] Raum ohne gültige Etage ignoriert:", rid);
            continue;
        }

        data.rooms.push({
            id: r.id,
            name: r.name || "Raum",
            floorId: r.floorId,
            polygon: Array.isArray(r.points) ? r.points.map(p => ({ x: p.x, y: p.y })) : [],
            doors: Array.isArray(r.doors) ? [...r.doors] : [],
            windows: Array.isArray(r.windows) ? [...r.windows] : []
        });
    }

    // ---------------------------------------------------------
    // 3) Türen sammeln
    // ---------------------------------------------------------
    for (const did in project.doors) {
        const d = project.doors[did];
        if (!d || typeof d !== "object") continue;

        data.doors.push({ ...d });
    }

    // ---------------------------------------------------------
    // 4) Fenster sammeln
    // ---------------------------------------------------------
    for (const wid in project.windows) {
        const w = project.windows[wid];
        if (!w || typeof w !== "object") continue;

        data.windows.push({ ...w });
    }

    // ---------------------------------------------------------
    // 5) Möbel sammeln
    // ---------------------------------------------------------
    for (const fid in project.furniture) {
        const f = project.furniture[fid];
        if (!f || typeof f !== "object") continue;

        data.furniture.push({ ...f });
    }

    // ---------------------------------------------------------
    // 6) Geräte sammeln
    // ---------------------------------------------------------
    for (const did in project.devices) {
        const d = project.devices[did];
        if (!d || typeof d !== "object") continue;

        data.devices.push({ ...d });
    }

    return data;
}



// ======================================================
// Persistenz: Projekt speichern & laden (localStorage)
// ======================================================

const STORAGE_KEY = "smarthome_project_v1";





// ------------------------------------------------------------
// ID-Generator (für Räume, Türen, Fenster, Geräte, etc.)
// ------------------------------------------------------------
function createId(prefix) {
    return prefix + "_" + Math.random().toString(36).substr(2, 9);
}

// ------------------------------------------------------------
// Datenmodelle für persistente Objekte
// ------------------------------------------------------------

// Raum
function createRoomModel(id, name = null, floorId = null) {
    return {
        id,
        name,
        floorId,            // ⭐ jetzt korrekt
        type: "room",
        points: [],
        walls: [],
        doors: [],
        windows: [],
        furniture: [],
        devices: [],
        color: "#AABBCC",
        floorTexture: "default",
        isClosed: false
    };
}


function createFloorModel(id, name = null) {
    return {
        id,        // unveränderbare ID
        name,      // editierbarer Name
        type: "floor",
        rooms: []  // Liste der Raum-IDs, die zu dieser Etage gehören
    };
}



// Tür
function createDoorModel(id, type, x, y, wallIndex, t, width) {
    return {
        id,
        type,
        x,
        y,
        wallIndex,
        t,
        width,
        hinge: null,
        side: 1,
        isOpen: true,
        connectsToRoom: null,
        color: "#ffffff",
        customName: null
    };
}

// Fenster
function createWindowModel(id, type, x, y, wallIndex, t, width, height = 100) {
    return {
        id,
        type,
        x,
        y,
        wallIndex,
        t,
        width,
        height,
        hasRolladen: false,
        color: "#ffffff",
        customName: null
    };
}

// Möbel
function createFurnitureModel(id, type, x, y, rotation, width, height, depth) {
    return {
        id,
        type,
        x,
        y,
        rotation,
        width,
        height,
        depth,
        color: "#333333",
        customName: null
    };
}

// Smart-Home-Gerät
function createDeviceModel(id, type, model, deviceId, roomId, x, y, rotation) {
    return {
        id,
        type,
        model,
        deviceId,
        roomId,
        x,
        y,
        rotation,
        state: {},
        customName: null
    };
}




function getAllProjects() {
    const list = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key.startsWith("project_")) {
            const json = localStorage.getItem(key);

            try {
                const data = JSON.parse(json);

                // ID aus meta oder aus Key ableiten
                const id = data.meta?.id || key.replace("project_", "");

                // Name aus meta
                const name = data.meta?.name || "(Unbenannt)";

                list.push({ id, name });

            } catch (e) {
                console.warn("⚠️ Ungültiges Projekt im Storage:", key);
            }
        }
    }

    return list;
}


function openProjectMenu(x, y) {
    const items = [];

    // ⭐ Nur im Editor sichtbar
    if (document.body.classList.contains("editor-mode")) {
        items.push({ label: "Projekt umbenennen", action: renameProject });
        items.push({ label: "Projekt kopieren", action: copyProject });
        items.push({ label: "Neue Etage", action: createNewFloor });
        items.push({ label: "Neues Projekt", action: createNewProject });
        items.push({ label: "Projekt löschen", action: deleteProject });
        items.push({ separator: true });
    }

    // ⭐ Immer sichtbar (SmartHome + Editor)
    items.push({ label: "Projekt wechseln", action: switchProject });

    openContextMenu(x, y, items);
}

function renameProject() {
    startProjectRename();
}
function startProjectRename() {
    const nameEl = document.getElementById("editor-project-name-sidebar");
    if (!nameEl) return;

    const oldName = project.meta?.name || "Projekt";

    const input = document.createElement("input");
    input.type = "text";
    input.value = oldName;
    input.className = "project-rename-input";

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            ev.preventDefault();
            finishProjectRename(input.value.trim());
        }
        if (ev.key === "Escape") {
            ev.preventDefault();
            finishProjectRename(oldName);
        }
    });

    input.addEventListener("blur", () => {
        finishProjectRename(input.value.trim());
    });
}
function finishProjectRename(newName) {
    if (!newName) {
        renderEditorProjectSidebar();
        updateEditorTitle();
        return;
    }

    project.meta.name = newName;

    // Sidebar neu rendern (entfernt das Input-Feld)
    renderEditorProjectSidebar();

    // Titelzeile aktualisieren
    updateEditorTitle();

    // Projekt speichern
    saveProject();
}



function copyProject() {
    // ⭐ Tiefenkopie des aktuellen Projekts
    const clone = JSON.parse(JSON.stringify(project));

    // ⭐ Neuer Name
    clone.meta.name = project.meta.name + " (Kopie)";

    // ⭐ Neue ID erzeugen
    clone.meta.id = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    clone.meta.created = Date.now();
    clone.meta.modified = Date.now();

    // ⭐ Speichern unter neuer ID
    const key = "project_" + clone.meta.id;
    localStorage.setItem(key, JSON.stringify(clone));

    // ⭐ Kopie zum aktiven Projekt machen
    Object.keys(project).forEach(k => delete project[k]);
    Object.assign(project, clone);

    // ⭐ last_project aktualisieren
    localStorage.setItem("last_project", clone.meta.id);

    // ⭐ UI aktualisieren
    updateEditorTitle();
    renderEditorProjectSidebar();

    // ⭐ SmartHomeData neu generieren
    SmartHomeData = generateSmartHomeDataFromProject();

    alert("Projekt wurde kopiert.");
}




function createNewProject() {
    const name = prompt("Name des neuen Projekts:");
    if (!name) return;

    const projectId = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const floorId   = "floor_" + Date.now();
    const roomId    = "room_" + Date.now() + "_main";

    const newProject = {
        meta: {
            id: projectId,
            name: name,
            version: 1,
            created: Date.now(),
            modified: Date.now()
        },
        floors: {
            [floorId]: {
                id: floorId,
                name: "Erdgeschoss",
                rooms: [roomId]
            }
        },
        rooms: {
            [roomId]: {
                id: roomId,
                name: "Raum",
                floorId: floorId,
                points: [],
                isClosed: false,
                doors: [],
                windows: []
            }
        }
    };

    // Projekt speichern
    const key = "project_" + newProject.meta.id;
    localStorage.setItem(key, JSON.stringify(newProject));

    // Globales Projekt ersetzen
    Object.keys(project).forEach(k => delete project[k]);
    Object.assign(project, newProject);

    // Aktive IDs setzen
    activeFloorId = floorId;
    activeRoomId  = roomId;

    // last_project aktualisieren
    localStorage.setItem("last_project", newProject.meta.id);

    // NEUEN Raum laden (Canvas wird dabei geleert)
    if (RoomDesigner && typeof RoomDesigner.loadRoom === "function") {
        RoomDesigner.loadRoom(activeRoomId);
    }

    // Titelzeile & Sidebar aktualisieren
    updateEditorTitle();
    renderEditorProjectSidebar();
}



function createNewFloor() {
    const name = prompt("Name der neuen Etage:");
    if (!name) return;

    const floorId = "floor_" + Date.now();

    // Neue Etage erzeugen (ohne Räume)
    project.floors[floorId] = {
        id: floorId,
        name: name,
        rooms: []   // Etage startet leer
    };

    // Neue Etage aktivieren
 //   activeFloorId = floorId;

    // Raum bleibt wie er ist (activeRoomId NICHT ändern)

    // Speichern
    saveProject();

    // UI aktualisieren
    renderEditorProjectSidebar();
    updateEditorTitle();
}




function deleteProject() {
    if (!confirm("Projekt wirklich löschen?")) return;

    const currentId = project.meta.id;
    const key = "project_" + currentId;

    // 1) Projekt löschen
    localStorage.removeItem(key);

    // 2) Alle verbleibenden Projekte ermitteln
    const all = getAllProjects(); // liefert [{id, name}, ...]

    // 3) Wenn noch Projekte existieren → nächstes laden
    if (all.length > 0) {
        const next = all[0].id; // nimm das erste verbleibende Projekt
        loadProject(next);
        localStorage.setItem("last_project", next);

        importToEditor();
        updateEditorTitle();
        renderEditorProjectSidebar();
        SmartHomeData = generateSmartHomeDataFromProject();
        return;
    }

    // 4) Wenn KEIN Projekt mehr existiert → neues leeres Projekt erzeugen
    const newId = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    Object.keys(project).forEach(k => delete project[k]);
    Object.assign(project, {
        meta: {
            id: newId,
            name: "Neues Projekt",
            version: 1,
            created: Date.now(),
            modified: Date.now()
        },
        floors: {},
        rooms: {}
    });

    saveProject();
    localStorage.setItem("last_project", newId);

    importToEditor();
    updateEditorTitle();
    renderEditorProjectSidebar();
    SmartHomeData = generateSmartHomeDataFromProject();
}




function deleteProjectFromStorage(name) {
    const key = "project_" + name;
    localStorage.removeItem(key);
}



function switchProject() {
    const projects = getAllProjects();

    if (projects.length === 0) {
        alert("Keine weiteren Projekte vorhanden.");
        return;
    }

    const modal = document.getElementById("project-switcher");
    const list = document.getElementById("project-list");
    const loadBtn = document.getElementById("project-load-btn");
    const cancelBtn = document.getElementById("project-cancel-btn");

    // Liste füllen (ID als value, Name als Anzeige)
    list.innerHTML = "";
    projects.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;        // ID
        opt.textContent = p.name; // Name
        list.appendChild(opt);
    });

    // Modal anzeigen
    modal.classList.remove("hidden");

    // Laden
    loadBtn.onclick = () => {
        const id = list.value;
        if (!id) return;

        const loaded = loadProject(id);
        if (!loaded) {
            alert("Projekt konnte nicht geladen werden.");
            return;
        }

        // Modal schließen
        modal.classList.add("hidden");

        // ---------------------------------------------------------
        // ⭐ Bulletproof Reset nach Projektwechsel
        // ---------------------------------------------------------

        // 1) Aktive IDs zurücksetzen
        activeFloorId = null;
        activeRoomId = null;

        // 2) Falls Etagen existieren → erste Etage aktivieren
        const floorIds = Object.keys(project.floors || {});
        if (floorIds.length > 0) {
            activeFloorId = floorIds[0];
        }

        // 3) Falls Räume existieren → ersten Raum aktivieren
        const roomIds = Object.keys(project.rooms || {});
        if (roomIds.length > 0) {
            activeRoomId = roomIds[0];
        }

        // 4) Editor neu initialisieren
        importToEditor();

        // 5) SmartHome-Daten NUR aus dem Projekt generieren
        SmartHomeData = generateSmartHomeDataFromProject();

        // 6) SmartHomeData.structure zurücksetzen
        SmartHomeData.structure = {
            activeFloor: activeFloorId,
            activeRoom: activeRoomId
        };

        // 7) Editor-Raum laden, aber NUR wenn er existiert
        if (activeRoomId && project.rooms?.[activeRoomId]) {
            RoomDesigner.loadRoom(activeRoomId);
        } else {
            // Canvas leeren, falls kein Raum existiert
            if (RoomDesigner && typeof RoomDesigner.clear === "function") {
                RoomDesigner.clear();
            }
        }

        // 8) Sidebar aktualisieren
        renderEditorProjectSidebar();
        updateEditorTitle();
    };

    // Abbrechen
    cancelBtn.onclick = () => {
        modal.classList.add("hidden");
    };

    // ESC schließt
    document.onkeydown = (ev) => {
        if (ev.key === "Escape") {
            modal.classList.add("hidden");
            document.onkeydown = null;
        }
    };
}


function switchFloor(floorId) {
    if (!project.floors[floorId]) return;

    // Etage aktiv setzen
    activeFloorId = floorId;

    const floor = project.floors[floorId];
    const rooms = floor.rooms || [];

    // Wenn der aktuell aktive Raum NICHT zu dieser Etage gehört → Raum auf null
    if (!activeRoomId || !rooms.includes(activeRoomId)) {
        activeRoomId = null;

        // Canvas leeren
        RoomDesigner.loadRoom(null);
    }

    // Titel + Sidebar aktualisieren
    updateEditorTitle();
    renderEditorProjectSidebar();
}





// ------------------------------------------------------------
// Projekt speichern & laden
// ------------------------------------------------------------
function saveProject() {
    project.meta.modified = Date.now();

    // ID sicherstellen
    if (!project.meta.id) {
        project.meta.id = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        console.warn("⚠️ Projekt hatte keine ID – neue ID vergeben:", project.meta.id);
    }

    // Neuer ID-basierter Key
    const key = "project_" + project.meta.id;

    // Speichern
    localStorage.setItem(key, JSON.stringify(project));
}



function saveProjectAs(proj) {
    // ⭐ Neue ID erzeugen
    proj.meta.id = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    proj.meta.created = Date.now();
    proj.meta.modified = Date.now();

    // ⭐ Speichern unter ID-Key
    const key = "project_" + proj.meta.id;
    localStorage.setItem(key, JSON.stringify(proj));

    // ⭐ Projekt aktiv machen
    Object.keys(project).forEach(k => delete project[k]);
    Object.assign(project, proj);

    // ⭐ last_project aktualisieren
    localStorage.setItem("last_project", proj.meta.id);

    // ⭐ UI aktualisieren
    updateEditorTitle();
    renderEditorProjectSidebar();

    // ⭐ SmartHomeData neu generieren
    SmartHomeData = generateSmartHomeDataFromProject();
}




function loadProject(id) {
    const key = "project_" + id;
    const json = localStorage.getItem(key);

    if (!json) {
        console.warn("⚠️ Projekt nicht gefunden:", id);
        return false;
    }

    try {
        let data = JSON.parse(json);

        // 🔥 Reparatur: ID sicherstellen 
        if (!data.meta.id) {
            const newId = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            data.meta.id = newId;

            // alten Key löschen, neuen Key speichern
            localStorage.removeItem(key);
            localStorage.setItem("project_" + newId, JSON.stringify(data));

            console.warn("⚠️ Projekt hatte keine ID – neue ID vergeben:", newId);
        }

        // Projekt-Objekt sauber ersetzen
        Object.keys(project).forEach(k => delete project[k]);
        Object.assign(project, data);

        // last_project aktualisieren
        localStorage.setItem("last_project", project.meta.id);

        console.log("✔ Projekt geladen:", project.meta.name);
        return true;

    } catch (e) {
        console.error("❌ Fehler beim Laden des Projekts:", e);
        return false;
    }
}


function migrateProjectsToID() {
    console.group("🔧 Migration: Name-basierte Keys → ID-basierte Keys");

    const toDelete = [];
    const toCreate = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (!key.startsWith("project_")) continue;

        const json = localStorage.getItem(key);
        if (!json) continue;

        try {
            const data = JSON.parse(json);

            // ID aus meta oder aus Key ableiten
            let id = data.meta?.id;

            if (!id) {
                // Neue ID erzeugen
                id = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
                data.meta.id = id;
                console.warn("⚠️ Projekt ohne ID gefunden – neue ID vergeben:", id);
            }

            const newKey = "project_" + id;

            // Wenn alter Key != neuer Key → Migration nötig
            if (key !== newKey) {
                toCreate.push({ key: newKey, data });
                toDelete.push(key);
            }

        } catch (e) {
            console.error("❌ Fehler beim Migrieren von:", key, e);
        }
    }

    // Neue Keys anlegen
    toCreate.forEach(entry => {
        localStorage.setItem(entry.key, JSON.stringify(entry.data));
        console.log("✔ Neues Projekt gespeichert:", entry.key);
    });

    // Alte Keys löschen
    toDelete.forEach(key => {
        localStorage.removeItem(key);
        console.log("🗑️ Alter Key gelöscht:", key);
    });

    console.groupEnd();
}



// Projekt → Editor
function importToEditor() {
    try {
        // 1) Projekt absichern
        if (!project || typeof project !== "object") {
            project = { meta: {}, floors: {}, rooms: {} };
        }
        if (!project.rooms) project.rooms = {};
        if (!project.floors) project.floors = {};

        // ❌ WICHTIG:
        // KEIN automatisches "ersten Raum wählen" mehr!
        // activeRoomId wird von switchFloor / Sidebar gesetzt.

        // 2) Kein aktiver Raum → Etage anzeigen, Raum leer, Canvas leer
        if (!activeRoomId) {

            const projectEl = document.getElementById("editor-project-name");
            if (projectEl) projectEl.textContent = project.meta?.name || "Projekt";

            const floorEl = document.getElementById("editor-floor-name");
            if (floorEl) {
                const floor = activeFloorId ? project.floors[activeFloorId] : null;
                floorEl.textContent = floor?.name || "Etage";
            }

            const roomEl = document.getElementById("editor-room-name");
            if (roomEl) roomEl.textContent = "";

            // Canvas leeren
            RoomDesigner.points = [];
            RoomDesigner.doors = [];
            RoomDesigner.windows = [];
            RoomDesigner.isClosed = false;
            RoomDesigner.updateWalls();
            RoomDesigner.render();

            renderEditorProjectSidebar();
            return;
        }

        // 3) Raum laden
        const room = project.rooms[activeRoomId];
        if (!room) return;

        // Floor synchronisieren
        activeFloorId = room.floorId;

        // 4) Titel setzen
        const projectEl = document.getElementById("editor-project-name");
        if (projectEl) projectEl.textContent = project.meta?.name || "Projekt";

        const floorEl = document.getElementById("editor-floor-name");
        if (floorEl) {
            const floor = project.floors[room.floorId];
            floorEl.textContent = floor?.name || "Etage";
        }

        const roomEl = document.getElementById("editor-room-name");
        if (roomEl) roomEl.textContent = room.name || room.id;

        // 5) Raumdaten übertragen
        RoomDesigner.points = (room.points || []).map(p => ({ x: p.x, y: p.y }));
        RoomDesigner.isClosed = room.isClosed || false;

        RoomDesigner.doors = (room.doors || [])
            .map(id => project.doors?.[id])
            .filter(Boolean)
            .map(d => ({ ...d }));

        RoomDesigner.windows = (room.windows || [])
            .map(id => project.windows?.[id])
            .filter(Boolean)
            .map(w => ({ ...w }));

        RoomDesigner.updateWalls();
        RoomDesigner.render();

        // 6) Sidebar aktualisieren
        renderEditorProjectSidebar();
    }
    catch (err) {
        console.error("❌ importToEditor Fehler:", err);
    }
}




// ------------------------------------------------------------
// Manuelles Speichern des aktuellen Editor-Zustands
// ------------------------------------------------------------
function saveCurrentRoom() {
    this.exportFromEditor();
    saveProject();
    console.log("[Persistenz] Projekt gespeichert.");
}

// ------------------------------------------------------------
// Manuelles Laden des aktuellen Projekts
// ------------------------------------------------------------
function loadCurrentRoom() {
    const id = localStorage.getItem("last_project");

    if (!id) {
        console.log("[Persistenz] Kein last_project gefunden.");
        return false;
    }

    const loaded = loadProject(id);

    if (loaded) {
        importToEditor();
        console.log("[Persistenz] Projekt geladen:", id);
        return true;
    } else {
        console.log("[Persistenz] Projekt konnte nicht geladen werden:", id);
        return false;
    }
}


    
const RoomDesigner = {
    canvas: null,
    ctx: null,

    points: [],
    walls: [],
    doors: [],
    windows: [],

hoverTarget: null,

    
    hover: { x: 0, y: 0 },

    selectedPoint: null,
    selectedDoorIndex: null,
    selectedWindowIndex: null,

    isDragging: false,
    _initialized: false,

    floorColor: "rgba(255,255,255,0.03)",


    // --------------------------------------------------
    // Grid-Konfiguration
    // --------------------------------------------------
    gridSize: 40,          // Standard-Rasterweite in Pixeln
    gridColor: "#444",     // dezentes Grau
    gridAlpha: 0.25,       // normale Sichtbarkeit
    gridAlphaSnap: 0.45,   // deutlicher bei aktivem Snap
    snapEnabled: false,    // Snap zunächst aus

    // --------------------------------------------------
    // Zoom & Pan
    // --------------------------------------------------
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    
    isPanning: false,
    lastPanX: 0,
    lastPanY: 0,

    isPanCandidate: false,
    panStartX: 0,
    panStartY: 0,


    _lastClickTime: 0,
    _pendingNewPoint: null,
    _suppressNextClick: false,
    _justSnapped: false,
    
    // Touch-Zustand für Pinch-Zoom
    touchState: {
        active: false,
        startDistance: 0,
        startZoom: 1,
        lastCenterX: 0,
        lastCenterY: 0
    },

    _closingByButton: false,
    _contextJustClosed: false,

    mode: "points",   // "points" | "doors" | "windows"
    isClosed: false,

    draggingDoorIndex: null,
    draggingWindowIndex: null,

    PIXELS_PER_METER: 40,

    // Kontext-Menü
    contextMenuEl: null,
    contextTarget: null,

    // Delete-Toast
    _toastEl: null,
    _toastConfirmFn: null,

    // --------------------------------------------------
    // NEU: Editor-API-Zustand
    // --------------------------------------------------
    currentTool: "select",          // z.B. "select", "draw", "door", "window"
    currentElement: null,           // z.B. "wall", "door-single", "window-standard"
    smartDeviceAssignments: {},     // { boxId: deviceId }

    scenes: [],                     // Fallback, falls SmartHomeData.scenes nicht existiert
    programs: [],                   // Fallback, falls SmartHomeData.programs nicht existiert
    users: [],                      // Fallback, falls kein User-Store existiert
    debugLog: [],                   // einfache Debug-Sammlung

// --------------------------------------------------
// Initialisierung
// --------------------------------------------------
init() {

    if (this._initialized) return;
    this._initialized = true;

    // ------------------------------------------------------------
    // 1) Letztes Projekt (ID-basiert)
    // ------------------------------------------------------------
    let last = localStorage.getItem("last_project");
    if (!last || last === "undefined") last = null;

    // ------------------------------------------------------------
    // 2) Projekt laden
    // ------------------------------------------------------------
    let loaded = false;
    if (last) {
        loaded = loadProject(last);
    }

    // ------------------------------------------------------------
    // 3) Falls kein Projekt existiert → neues Default-Projekt
    // ------------------------------------------------------------
    if (!loaded) {

        const newId = "proj_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

        Object.keys(project).forEach(k => delete project[k]);
        Object.assign(project, {
            meta: {
                id: newId,
                name: "Neues Projekt",
                version: 1,
                created: Date.now(),
                modified: Date.now()
            },
            floors: {},
            rooms: {}
        });

        // Etage erzeugen
        const floorId = "floor_1";
        project.floors[floorId] = createFloorModel(floorId, "Erdgeschoss");

        // Raum erzeugen
        activeRoomId = "room_1";
        project.rooms[activeRoomId] = createRoomModel(activeRoomId, "Neuer Raum", floorId);
        project.floors[floorId].rooms = [activeRoomId];

        // Speichern
        saveProject();

        // last_project setzen
        localStorage.setItem("last_project", newId);

        loaded = true;
    }

    // ------------------------------------------------------------
    // 4) Editor laden
    // ------------------------------------------------------------
    importToEditor();
    this.exportFromEditor();
    SmartHomeData = generateSmartHomeDataFromProject();

    // ------------------------------------------------------------
    // 5) Canvas & Events
    // ------------------------------------------------------------
    this.canvas = document.getElementById("roomdesigner");
    this.ctx = this.canvas.getContext("2d");

    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("mousemove", (e) => this.onMove(e));
    this.canvas.addEventListener("mousedown", (e) => this.onDown(e));
    this.canvas.addEventListener("mouseup", () => this.onUp());
    this.canvas.addEventListener("contextmenu", (e) => this.onRightClick(e));
    this.canvas.addEventListener("wheel", (e) => this.onWheelZoom(e), { passive: false });
    this.canvas.addEventListener("dblclick", (e) => this.onDoubleClickZoom(e));
    this.canvas.addEventListener("touchstart", (e) => this.onTouchStart(e), { passive: false });
    this.canvas.addEventListener("touchmove", (e) => this.onTouchMove(e), { passive: false });
    this.canvas.addEventListener("touchend", (e) => this.onTouchEnd(e));

    this.createContextMenu();
    this.setupSnapButton();
    this.setupGridSlider();
    this.setupResetButton();

    const projMenuBtn = document.getElementById("editor-project-menu-btn-sidebar");
    if (projMenuBtn) {
        projMenuBtn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const rect = ev.target.getBoundingClientRect();
            openProjectMenu(rect.left, rect.bottom + 4);
        });
    }

    this.resize();
    this.render();
}
,


    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    },

    // --------------------------------------------------
    // Rechtsklick verhindern
    // --------------------------------------------------
    onRightClick(e) {
        e.preventDefault();
        this.hideContextMenu();
    },

    // --------------------------------------------------
    // Kontext-Menü
    // --------------------------------------------------
    createContextMenu() {
        const el = document.createElement("div");
        el.id = "rd-context-menu";
        el.style.position = "fixed";
        el.style.display = "none";
        el.style.background = "rgba(0,0,0,0.85)";
        el.style.padding = "6px";
        el.style.borderRadius = "6px";
        el.style.zIndex = "20000";
        el.style.gap = "6px";

        document.body.appendChild(el);
        this.contextMenuEl = el;
    },

    hideContextMenu() {
        if (!this.contextMenuEl) return;

        // Nur wenn das Menü wirklich offen ist UND nicht durch Button geschlossen wird
        if (this.contextMenuEl.style.display === "flex" && !this._closingByButton) {
            this._contextJustClosed = true;
        }

        this.contextMenuEl.style.display = "none";
        this.contextTarget = null;
    },
    
showContextMenu(x, y, type, index) {
    const menu = this.contextMenuEl;
    menu.innerHTML = "";
    this.contextTarget = { type, index };

    // ------------------------------------------------------------
    // ⭐ POINT
    // ------------------------------------------------------------
    if (type === "point") {

        this.addContextButton("🗑", () => {

            const prevWall = index - 1;
            const nextWall = index;

            const affectedDoors = this.doors.filter(d => d.wallIndex === prevWall || d.wallIndex === nextWall);
            const affectedWindows = this.windows.filter(w => w.wallIndex === prevWall || w.wallIndex === nextWall);

            const p = this.points[index];
            this.points = this.points.filter(pt => pt !== p);

            if (this.points.length < 3) {
                this.isClosed = false;
            }

            this.updateWalls();

            const newWallIndex = prevWall;

            for (const d of affectedDoors) {
                const w = this.walls[newWallIndex];
                if (!w) continue;
                const proj = this.projectOnWall(d.x, d.y, w);
                d.wallIndex = newWallIndex;
                d.t = proj.t;
                d.x = proj.x;
                d.y = proj.y;
            }

            for (const win of affectedWindows) {
                const w = this.walls[newWallIndex];
                if (!w) continue;
                const proj = this.projectOnWall(win.x, win.y, w);
                win.wallIndex = newWallIndex;
                win.t = proj.t;
                win.x = proj.x;
                win.y = proj.y;
            }

            this.render();

            // ⭐ Autosave
            this.saveRoom(activeRoomId);

        }, true);
    }


    // ------------------------------------------------------------
    // ⭐ DOOR (ALLE Türen inkl. Dachluke)
    // ------------------------------------------------------------
    if (type === "door") {

        const d = this.doors[index];

        // ⭐ DACHLUKE → eigenes Menü + Scharnier neu setzen
        if (d.type === "dachluke") {

            // Zustand ändern (offen/geschlossen)
            this.addContextButton(d.isOpen ? "🔒" : "🔓", () => {
                d.isOpen = !d.isOpen;
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave
            }, false);

            // Scharnier neu setzen
            this.addContextButton("⟲", () => {
                this.mode = "setHinge";
                this._hingeDoorIndex = index;
                this.hideContextMenu();
                this.render();
                // ⭐ Autosave (Hinge-Wechsel ist final)
                this.saveRoom(activeRoomId);
            }, true);

            // Breite +
            this.addContextButton("＋", () => {
                d.width += 10;
                this.updateWalls();
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave
            }, false);

            // Breite –
            this.addContextButton("－", () => {
                d.width = Math.max(20, d.width - 10);
                this.updateWalls();
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave
            }, false);

            // Löschen
            this.addContextButton("🗑", () => {
                this.doors.splice(index, 1);
                this.updateWalls();
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave
            }, true);
        }

        // ⭐ NORMALE TÜREN
        else {

            if (d.type !== "durchgang") {
                this.addContextButton(d.isOpen ? "🔒" : "🔓", () => {
                    d.isOpen = !d.isOpen;
                    this.render();
                    this.saveRoom(activeRoomId);   // ⭐ Autosave
                }, false);
            }

            const hingeSupported = [
                "zimmertuer",
                "haustuer",
                "falttuer",
                "schiebetuer",
                "terrassentuer",
                "garagentor",
                "gartentor"
            ];

            if (hingeSupported.includes(d.type)) {
                this.addContextButton("⟲", () => {
                    this.mode = "setHinge";
                    this._hingeDoorIndex = index;
                    this.hideContextMenu();
                    this.render();
                    this.saveRoom(activeRoomId);   // ⭐ Autosave
                }, true);
            }

            this.addContextButton("＋", () => {
                d.width += 10;
                this.updateWalls();
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave
            }, false);

            this.addContextButton("－", () => {
                d.width = Math.max(20, d.width - 10);
                this.updateWalls();
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave
            }, false);

            this.addContextButton("🗑", () => {
                this.doors.splice(index, 1);
                this.updateWalls();
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave
            }, true);
        }
    }

    // ------------------------------------------------------------
    // ⭐ WINDOW
    // ------------------------------------------------------------
    if (type === "window") {

        const w = this.windows[index];

        this.addContextButton("＋", () => {
            w.width += 10;
            this.updateWalls();
            this.render();
            this.saveRoom(activeRoomId);   // ⭐ Autosave
        }, false);

        this.addContextButton("－", () => {
            w.width = Math.max(20, w.width - 10);
            this.updateWalls();
            this.render();
            this.saveRoom(activeRoomId);   // ⭐ Autosave
        }, false);

        this.addContextButton("🗑", () => {
            this.windows.splice(index, 1);
            this.updateWalls();
            this.render();
            this.saveRoom(activeRoomId);   // ⭐ Autosave
        }, true);
    }

    // ------------------------------------------------------------
    // ⭐ Menü anzeigen + korrekt positionieren
    // ------------------------------------------------------------
    menu.style.display = "flex";

    const rect = menu.getBoundingClientRect();
    const offset = 20;

    let left = x + offset;
    let top = y + offset;

    if (left + rect.width > window.innerWidth) {
        left = x - rect.width - offset;
    }

    if (top + rect.height > window.innerHeight) {
        top = y - rect.height - offset;
    }

    if (left < 0) {
        left = x + offset;
    }

    if (top < 0) {
        top = y + offset;
    }

    menu.style.left = left + "px";
    menu.style.top = top + "px";
}
,
    

addContextButton(label, fn, closeMenu = false) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.width = "32px";
    btn.style.height = "32px";
    btn.style.fontSize = "18px";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.background = "#444";
    btn.style.color = "#fff";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", () => {

        // PLUS / MINUS → Menü bleibt offen
        if (!closeMenu) {
            fn && fn();

            // ⭐ Autosave für alle Änderungen
            this.saveRoom(activeRoomId);

            return;
        }

        // DELETE / HINGE → Menü schließen
        this._closingByButton = true;

        fn && fn();

        // ⭐ Autosave für alle finalen Aktionen
        this.saveRoom(activeRoomId);

        this.hideContextMenu();
        this._closingByButton = false;
    });

    this.contextMenuEl.appendChild(btn);
}
,

    onMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX / this.zoom) - this.offsetX;
        const worldY = (mouseY / this.zoom) - this.offsetY;

        // Pan starten
        if (this.isPanCandidate && !this.isPanning) {
            const dx = mouseX - this.panStartX;
            const dy = mouseY - this.panStartY;

            if (Math.hypot(dx, dy) > 6) {
                this.isPanning = true;
                this.lastPanX = mouseX;
                this.lastPanY = mouseY;
                this.isPanCandidate = false;
                this._clickedEmpty = false;
                this._pendingNewPoint = null;
            }
        }

        // Pan bewegen
        if (this.isPanning) {
            const dx = mouseX - this.lastPanX;
            const dy = mouseY - this.lastPanY;

            this.offsetX += dx / this.zoom;
            this.offsetY += dy / this.zoom;

            this.lastPanX = mouseX;
            this.lastPanY = mouseY;

            this.render();
            return;
        }

        // Drag starten?
        if (this._pendingContext) {
            const dx = worldX - this._pendingContext.x;
            const dy = worldY - this._pendingContext.y;

            if (Math.hypot(dx, dy) > 3) {
                const c = this._pendingContext;

                if (c.type === "point") this.selectedPoint = this.points[c.index];
                if (c.type === "door") this.draggingDoorIndex = c.index;
                if (c.type === "window") this.draggingWindowIndex = c.index;

                this._pendingContext = null;
                this.isDragging = true;
            }
        }

        // Drag bewegen
        if (this.isDragging) {

            if (this.selectedPoint) {

                let px = worldX;
                let py = worldY;

                // Grid-Snap
                if (this.snapEnabled) {
                    px = this.snap(px);
                    py = this.snap(py);
                }

                // MOVE-SNAP nur optisch, nicht verschmelzen
                this._snapCandidate = false;

                if (!this.isClosed && this.points.length > 2) {
                    const first = this.points[0];
                    const lastIndex = this.points.length - 1;
                    const last = this.points[lastIndex];

                    if (this.selectedPoint === last) {
                        const dist = Math.hypot(px - first.x, py - first.y);

                        if (dist < 20) {
                            // Optischer Snap
                            px = first.x;
                            py = first.y;

                            // Merken für onUp
                            this._snapCandidate = true;
                        }
                    }
                }

                // Normales Draggen
                this.selectedPoint.x = px;
                this.selectedPoint.y = py;

                this.updateWalls();
            }

// Türen bewegen
if (this.draggingDoorIndex !== null) {
    const d = this.doors[this.draggingDoorIndex];

// ⭐ DACHLUKE → frei bewegen, aber exakt an der Innenkante stoppen
if (d.type === "dachluke") {

    const radius = d.width / 2;

    // 1) Wenn der äußere Rand im Raum bleibt → normal bewegen
    if (this._circleInsideRoom(worldX, worldY, radius)) {
        d.x = worldX;
        d.y = worldY;
        this.render();
        return;
    }

    // 2) Wenn nicht → an Wandkante zurückprojizieren
    let bestProj = null;
    let bestDist = Infinity;

    for (const w of this.walls) {
        const proj = this.projectOnWall(worldX, worldY, w);

        const dx = worldX - proj.x;
        const dy = worldY - proj.y;
        const dist = Math.hypot(dx, dy);

        const diff = Math.abs(dist - radius);

        if (diff < bestDist) {
            bestDist = diff;
            bestProj = proj;
        }
    }

    if (bestProj) {

        // Mittelpunkt so setzen, dass der Rand die Wand berührt
        const dx = worldX - bestProj.x;
        const dy = worldY - bestProj.y;
        const len = Math.hypot(dx, dy) || 1;

        const newX = bestProj.x + (dx / len) * radius;
        const newY = bestProj.y + (dy / len) * radius;

        // ⭐ WICHTIG: Nur akzeptieren, wenn der neue Kreis IM Raum liegt
        if (this._circleInsideRoom(newX, newY, radius)) {
            d.x = newX;
            d.y = newY;
        }
        // sonst: NICHT bewegen
    }

    this.render();
    return;
}





    // ⭐ Normale Türen → wie bisher entlang der Wand verschieben
    const w = this.walls[d.wallIndex];
    if (!w) return; // Sicherheitscheck

    const proj = this.projectOnWall(worldX, worldY, w);
    d.t = proj.t;
    d.x = proj.x;
    d.y = proj.y;

    this.render();
    return;
}

            // Fenster bewegen
            if (this.draggingWindowIndex !== null) {
                const wObj = this.windows[this.draggingWindowIndex];
                const w = this.walls[wObj.wallIndex];
                const proj = this.projectOnWall(worldX, worldY, w);
                wObj.t = proj.t;
                wObj.x = proj.x;
                wObj.y = proj.y;
            }

            this.render();
            return;
        }

        // ------------------------------------------------------------
        // ⭐ HOVER-ERKENNUNG + CURSOR-WECHSEL (ohne Leuchten)
        // ------------------------------------------------------------
        const hit = this.hitTest(mouseX, mouseY);

        if (hit.type !== "empty") {
            this.hoverTarget = hit;

            if (hit.type === "point") {
                this.canvas.style.cursor = "pointer";   // Punkt anklickbar
            } 
            else if (hit.type === "door" || hit.type === "window") {
                this.canvas.style.cursor = "grab";      // Tür/Fenster greifbar
            } 
            else {
                this.canvas.style.cursor = "pointer";
            }

        } else {
            this.hoverTarget = null;
            this.canvas.style.cursor = "default";        // nichts getroffen
        }

        // Hover aktualisieren
        this.hover.x = mouseX;
        this.hover.y = mouseY;
        this.render();
    },


    // --------------------------------------------------
    // HIT-DETECTION REIHENFOLGE (wichtig!)
    // --------------------------------------------------
    hitTest(x, y) {
        // x, y kommen im Moment als Screen-Koordinaten rein
        const worldX = (x / this.zoom) - this.offsetX;
        const worldY = (y / this.zoom) - this.offsetY;

        const doorIndex = this.getDoorIndexAt(worldX, worldY);
        if (doorIndex !== null) return { type: "door", index: doorIndex };

        const windowIndex = this.getWindowIndexAt(worldX, worldY);
        if (windowIndex !== null) return { type: "window", index: windowIndex };

        const point = this.getPointAt(worldX, worldY);
        if (point) return { type: "point", index: this.points.indexOf(point) };

        const wall = this.getWallAt(worldX, worldY);
        if (wall) return { type: "wall", data: wall };

        return { type: "empty" };
    },

    getPointAt(x, y) {
        // x, y im Welt-Raum
        return this.points.find(p => Math.hypot(p.x - x, p.y - y) < 10);
    },

    getDoorIndexAt(x, y) {
        // x, y im Welt-Raum
        for (let i = 0; i < this.doors.length; i++) {
            const d = this.doors[i];
            if (Math.hypot(d.x - x, d.y - y) < 15) return i;
        }
        return null;
    },

    getWindowIndexAt(x, y) {
        // x, y im Welt-Raum
        for (let i = 0; i < this.windows.length; i++) {
            const w = this.windows[i];
            if (Math.hypot(w.x - x, w.y - y) < 15) return i;
        }
        return null;
    },

saveRoom(roomId) {
    // optional: falls du roomId mal brauchst
    if (roomId && roomId !== activeRoomId) {
        activeRoomId = roomId;
    }

    // Editor → Projekt (inkl. Türen/Fenster/Points/isClosed)
    this.exportFromEditor();

    // Projekt persistieren
    saveProject();

    console.log("[RoomDesigner] Autosave für Raum:", activeRoomId);
}
,


    
onDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX / this.zoom) - this.offsetX;
    const worldY = (mouseY / this.zoom) - this.offsetY;

    // Rechtsklick → Menü schließen
    if (e.button === 2) {
        this.hideContextMenu();
        return;
    }

    // ------------------------------------------------------------
    // ⭐ SCHARNIER NEU SETZEN (für normale Türen, NICHT Dachluke)
    // ------------------------------------------------------------
    if (this.mode === "setHinge") {

        const d = this.doors[this._hingeDoorIndex];

        if (!d) {
            this.mode = "points";
            this._hingeDoorIndex = null;
            return;
        }

        // ⭐ Dachluke → hingeAngle setzen
        if (d.type === "dachluke") {

            const dx = worldX - d.x;
            const dy = worldY - d.y;
            d.hingeAngle = Math.atan2(dy, dx);

            this.mode = "points";
            this._hingeDoorIndex = null;
            this.render();

            // ⭐ Autosave
            this.saveRoom(activeRoomId);

            return;
        }

        // ⭐ Normale Türen → setDoorHingeFromTap
        const w = this.walls[d.wallIndex];
        if (w) {
            this.setDoorHingeFromTap(d, worldX, worldY, w);
        }

        this.mode = "points";
        this._hingeDoorIndex = null;
        this.render();

        // ⭐ Autosave
        this.saveRoom(activeRoomId);

        return;
    }

    // ------------------------------------------------------------
    // ⭐ DACHLUKE: 1. Klick = Luke setzen, 2. Klick = Scharnier setzen
    // ------------------------------------------------------------
    if (this.mode === "dachluke") {

        // 1. Klick → Luke setzen
        if (!this._placingDachluke) {

            if (!this.isClosed) {
                alert("Dachluken können nur in einem geschlossenen Raum platziert werden.");
                return;
            }

            if (!this.isPointInsideRoom(worldX, worldY)) {
                alert("Dachluken müssen innerhalb des Raumes platziert werden.");
                return;
            }

            this.doors.push({
                type: "dachluke",
                x: worldX,
                y: worldY,
                width: 60,
                isOpen: true,
                hingeAngle: 0
            });

            this._placingDachluke = true;
            this.render();

            // ⭐ Autosave
            this.saveRoom(activeRoomId);

            return;
        }

        // 2. Klick → hingeAngle setzen
        const d = this.doors[this.doors.length - 1];

        const dx = worldX - d.x;
        const dy = worldY - d.y;
        d.hingeAngle = Math.atan2(dy, dx);

        this._placingDachluke = false;
        this.mode = "points";
        this.render();

        // ⭐ Autosave
        this.saveRoom(activeRoomId);

        return;
    }

    // ------------------------------------------------------------
    // ⭐ HIT-TEST
    // ------------------------------------------------------------
    const hit = this.hitTest(mouseX, mouseY);
    const clickingObject =
        hit.type === "point" ||
        hit.type === "door" ||
        hit.type === "window";

    const menuWasOpen =
        this.contextMenuEl &&
        this.contextMenuEl.style.display === "flex";

    this.hideContextMenu();

    if (this._contextJustClosed && !clickingObject) {
        this._contextJustClosed = false;
        return;
    }

    if (this._contextJustClosed && clickingObject) {
        this._contextJustClosed = false;
    }

    // ------------------------------------------------------------
    // ⭐ Raum schließen durch Klick auf ersten Punkt
    // ------------------------------------------------------------
    if (!this.isClosed && this.points.length >= 2) {
        const first = this.points[0];
        if (Math.hypot(worldX - first.x, worldY - first.y) < 20) {

            this.isClosed = true;

            this.selectedPoint = first;
            this.isDragging = true;

            this.updateWalls();
            this.render();

            this.isDragging = false;
            this.selectedPoint = null;

            // ⭐ Autosave
            this.saveRoom(activeRoomId);

            return;
        }
    }

    // ------------------------------------------------------------
    // ⭐ FENSTER-MODUS
    // ------------------------------------------------------------
    if (this.mode === "windows") {

        if (hit.type === "window") {
            this._pendingContext = { x: worldX, y: worldY, type: "window", index: hit.index };
            return;
        }

        if (hit.type === "wall") {
            const w = hit.data;
            this.windows.push({
                wallIndex: w.index,
                t: w.t,
                x: w.x,
                y: w.y,
                width: 80
            });
            this.updateWalls();
            this.render();

            // ⭐ Autosave
            this.saveRoom(activeRoomId);
        }

        this.mode = "points";
        return;
    }

    // ------------------------------------------------------------
    // ⭐ TÜR-MODUS (ALLE Türtypen)
    // ------------------------------------------------------------
    if (this.mode === "doors") {

        const type = this.currentDoorType || "default";

        // ⭐ Durchgang → 1 Klick
        if (type === "durchgang") {

            if (hit.type !== "wall") return;

            const w = hit.data;
            const defaultWidth = 100;

            const cx = w.x;
            const cy = w.y;

            const dx = w.x2 - w.x1;
            const dy = w.y2 - w.y1;
            const len = Math.hypot(dx, dy) || 1;

            const tx = dx / len;
            const ty = dy / len;

            this.doors.push({
                type: "durchgang",
                wallIndex: w.index,
                t: w.t,
                x: cx,
                y: cy,
                width: defaultWidth,
                hingeAngle: 0,
                side: null
            });

            this.render();
            this.mode = "points";

            // ⭐ Autosave
            this.saveRoom(activeRoomId);

            return;
        }

        // ⭐ Normale Türen → Wandgebunden
        if (!this._placingDoor) {
            if (hit.type === "wall") {
                const w = hit.data;
                this.doors.push({
                    wallIndex: w.index,
                    t: w.t,
                    x: w.x,
                    y: w.y,
                    width: 36,
                    hinge: null,
                    side: 1,
                    type: type
                });
                this._placingDoor = true;
                this.render();

                // ⭐ Autosave
                this.saveRoom(activeRoomId);

                return;
            }
        }

        // ⭐ Hinge setzen (normale Türen)
        if (this._placingDoor) {
            const lastDoor = this.doors[this.doors.length - 1];
            const w = this.walls[lastDoor.wallIndex];
            this.setDoorHingeFromTap(lastDoor, worldX, worldY, w);

            this._placingDoor = false;
            this.mode = "points";
            this.render();

            // ⭐ Autosave
            this.saveRoom(activeRoomId);

            return;
        }
    }

    // ------------------------------------------------------------
    // ⭐ Kontextmenü für Türen
    // ------------------------------------------------------------
    if (hit.type === "door") {
        this._pendingContext = { x: worldX, y: worldY, type: "door", index: hit.index };
        return;
    }

    // ------------------------------------------------------------
    // ⭐ Kontextmenü für Fenster
    // ------------------------------------------------------------
    if (hit.type === "window") {
        this._pendingContext = { x: worldX, y: worldY, type: "window", index: hit.index };
        return;
    }

    // ------------------------------------------------------------
    // ⭐ Kontextmenü für Punkte
    // ------------------------------------------------------------
    if (hit.type === "point") {
        this._pendingContext = { x: worldX, y: worldY, type: "point", index: hit.index };
        return;
    }

    // ------------------------------------------------------------
    // ⭐ Punkt auf Wand einfügen
    // ------------------------------------------------------------
    if (hit.type === "wall") {
        const w = hit.data;
        const insertPoint = { x: w.x, y: w.y };

        this.points.splice(w.index + 1, 0, insertPoint);

        this.updateWalls();
        this.render();

        // ⭐ Autosave
        this.saveRoom(activeRoomId);

        return;
    }

    // ------------------------------------------------------------
    // ⭐ Punkt-Kandidat im leeren Raum
    // ------------------------------------------------------------
    if (!this.isClosed && hit.type === "empty") {
        let px = worldX;
        let py = worldY;

        if (this.snapEnabled) {
            px = this.snap(px);
            py = this.snap(py);
        }

        this._pendingNewPoint = { x: px, y: py };
    }

    // ------------------------------------------------------------
    // ⭐ PAN-Kandidat
    // ------------------------------------------------------------
    if (hit.type === "empty" || hit.type === "wall") {
        this.isPanCandidate = true;
        this.panStartX = mouseX;
        this.panStartY = mouseY;
    }
}
,


onUp(e) {
    // Wenn gerade gesnapped wurde → Klick komplett ignorieren
    if (this._justSnapped) {
        this._justSnapped = false;
        this._pendingNewPoint = null;
        return;
    }

    this.isPanCandidate = false;

    // PAN END
    if (this.isPanning) {
        this.isPanning = false;
        return;
    }

    // ------------------------------------------------------------
    // ⭐ DRAG END
    // ------------------------------------------------------------
    if (this.isDragging) {

        // --- SNAP beim Loslassen ---
        if (this._snapCandidate) {
            const first = this.points[0];
            const lastIndex = this.points.length - 1;

            // letzten Punkt entfernen
            this.points.splice(lastIndex, 1);

            // erster Punkt wird der aktive Punkt
            this.selectedPoint = first;

            this.isClosed = true;
            this._snapCandidate = false;

            this.updateWalls();
            this.render();

            this.isDragging = false;

            // ⭐ Autosave: Polygon geschlossen
            this.saveRoom(activeRoomId);

            return;
        }

        // Normaler Drag-Ende
        this.isDragging = false;
        this.selectedPoint = null;
        this.draggingDoorIndex = null;
        this.draggingWindowIndex = null;
        this._pendingContext = null;

        // ⭐ Autosave: Punkt/Tür/Fenster final verschoben
        this.saveRoom(activeRoomId);

        return;
    }

    // ------------------------------------------------------------
    // ⭐ Kontext / Klick auf Elemente
    // ------------------------------------------------------------
    if (this._pendingContext) {
        const c = this._pendingContext;
        this._pendingContext = null;

        // ⭐ Dachluke: NICHT ins Kontextmenü → Zustand toggeln
        if (c.type === "dachluke") {
            const d = this.doors[c.index];
            if (d && d.type === "dachluke") {
                d.isOpen = !d.isOpen;   // Zustand wechseln
                this.render();
                this.saveRoom(activeRoomId);   // ⭐ Autosave

                // ⭐ Autosave: Dachluke toggeln
                this.saveRoom(activeRoomId);
            }
            return;
        }

        // ⭐ Alle anderen Elemente → Kontextmenü wie bisher
        const screenX = (c.x + this.offsetX) * this.zoom;
        const screenY = (c.y + this.offsetY) * this.zoom;

        this.showContextMenu(screenX, screenY, c.type, c.index);
        return;
    }

    // ------------------------------------------------------------
    // ⭐ Doppelklick → Zoom übernimmt
    // ------------------------------------------------------------
    if (this._clickTimer) {
        clearTimeout(this._clickTimer);
        this._clickTimer = null;
        this._pendingNewPoint = null;
        return;
    }

    // ------------------------------------------------------------
    // ⭐ Einfacher Klick → Punkt setzen
    // ------------------------------------------------------------
    this._clickTimer = setTimeout(() => {

        this._clickTimer = null;

        if (!this.isClosed && this._pendingNewPoint) {

            let px = this._pendingNewPoint.x;
            let py = this._pendingNewPoint.y;

            // Snap auf ersten Punkt beim Setzen
            if (this.points.length > 0) {
                const first = this.points[0];
                if (Math.hypot(px - first.x, py - first.y) < 20) {
                    px = first.x;
                    py = first.y;
                }
            }

            this.points.push({ x: px, y: py });
            this._pendingNewPoint = null;
            this.updateWalls();
            this.render();

            // ⭐ Autosave: Punkt final gesetzt
            this.saveRoom(activeRoomId);
        }

        this._pendingNewPoint = null;

    }, 220); // 220ms = Standard-Doppelklick-Fenster
}
,

    // --------------------------------------------------
    // Zoom per Mausrad
    // --------------------------------------------------
    onWheelZoom(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX / this.zoom) - this.offsetX;
        const worldY = (mouseY / this.zoom) - this.offsetY;

        const zoomFactor = 1.1;
        if (e.deltaY < 0) {
            this.zoom *= zoomFactor;
        } else {
            this.zoom /= zoomFactor;
        }

        this.zoom = Math.max(0.2, Math.min(4.0, this.zoom));

        this.offsetX = (mouseX / this.zoom) - worldX;
        this.offsetY = (mouseY / this.zoom) - worldY;

        this.render();
    },

    // --------------------------------------------------
    // Doppelklick-Zoom (Toggle)
    // --------------------------------------------------
    onDoubleClickZoom(e) {
        e.preventDefault();
        e.stopPropagation(); // verhindert Kontext-Kollision

        // Signal an onUp: diesen Klick NICHT als Punkt interpretieren
        this._suppressNextClick = true;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX / this.zoom) - this.offsetX;
        const worldY = (mouseY / this.zoom) - this.offsetY;

        if (this.zoom < 1.5) {
            this.zoom *= 1.5;
        } else {
            this.zoom /= 1.5;
        }

        this.zoom = Math.max(0.2, Math.min(4.0, this.zoom));

        this.offsetX = (mouseX / this.zoom) - worldX;
        this.offsetY = (mouseY / this.zoom) - worldY;

        this.render();
    },

    // --------------------------------------------------
    // TOUCH START
    // --------------------------------------------------
    onTouchStart(e) {
        e.preventDefault();

        const touches = e.touches;

        // Ein Finger → Pan
        if (touches.length === 1) {
            const rect = this.canvas.getBoundingClientRect();
            const x = touches[0].clientX - rect.left;
            const y = touches[0].clientY - rect.top;

            this.isPanning = true;
            this.lastPanX = x;
            this.lastPanY = y;
            this.touchState.active = false;
            return;
        }

        // Zwei Finger → Pinch-Zoom
        if (touches.length === 2) {
            this.touchState.active = true;

            const rect = this.canvas.getBoundingClientRect();

            const x1 = touches[0].clientX - rect.left;
            const y1 = touches[0].clientY - rect.top;
            const x2 = touches[1].clientX - rect.left;
            const y2 = touches[1].clientY - rect.top;

            const dx = x2 - x1;
            const dy = y2 - y1;

            this.touchState.startDistance = Math.hypot(dx, dy);
            this.touchState.startZoom = this.zoom;

            this.touchState.lastCenterX = (x1 + x2) / 2;
            this.touchState.lastCenterY = (y1 + y2) / 2;

            this.isPanning = false;
        }
    },

    // --------------------------------------------------
    // TOUCH MOVE
    // --------------------------------------------------
    onTouchMove(e) {
        e.preventDefault();

        const touches = e.touches;
        const rect = this.canvas.getBoundingClientRect();

        // Ein Finger → Pan
        if (touches.length === 1 && !this.touchState.active) {
            const x = touches[0].clientX - rect.left;
            const y = touches[0].clientY - rect.top;

            const dx = x - this.lastPanX;
            const dy = y - this.lastPanY;

            this.offsetX += dx / this.zoom;
            this.offsetY += dy / this.zoom;

            this.lastPanX = x;
            this.lastPanY = y;

            this.render();
            return;
        }

        // Zwei Finger → Pinch-Zoom
        if (touches.length === 2) {
            const x1 = touches[0].clientX - rect.left;
            const y1 = touches[0].clientY - rect.top;
            const x2 = touches[1].clientX - rect.left;
            const y2 = touches[1].clientY - rect.top;

            const dx = x2 - x1;
            const dy = y2 - y1;

            const newDist = Math.hypot(dx, dy);
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;

            const worldX = (centerX / this.zoom) - this.offsetX;
            const worldY = (centerY / this.zoom) - this.offsetY;

            this.zoom = this.touchState.startZoom * (newDist / this.touchState.startDistance);
            this.zoom = Math.max(0.2, Math.min(4.0, this.zoom));

            this.offsetX = (centerX / this.zoom) - worldX;
            this.offsetY = (centerY / this.zoom) - worldY;

            this.render();
        }
    },

    onTouchEnd(e) {
        if (e.touches.length === 0) {
            this.isPanning = false;
            this.touchState.active = false;
        }
    },

    // --------------------------------------------------
    // Hilfsfunktionen
    // --------------------------------------------------
    getPointAt(x, y) {
        return this.points.find(p => Math.hypot(p.x - x, p.y - y) < 10);
    },

        getDoorIndexAt(x, y) {
            for (let i = 0; i < this.doors.length; i++) {
                const d = this.doors[i];
                if (Math.hypot(d.x - x, d.y - y) < 15) return i;
            }
            return null;
        },


    getWindowIndexAt(x, y) {
        for (let i = 0; i < this.windows.length; i++) {
            const w = this.windows[i];
            if (Math.hypot(w.x - x, w.y - y) < 15) return i;
        }
        return null;
    },

    // --------------------------------------------------
    // Snap auf Grid
    // --------------------------------------------------
    snap(value) {
        return Math.round(value / this.gridSize) * this.gridSize;
    },

    // --------------------------------------------------
    // Grid-Größe ändern
    // --------------------------------------------------
    setGridSize(size) {
        this.gridSize = Math.max(5, size); // Mindestgröße
        this.render();
    },
   
    getWallAt(x, y) {
        // Wände IMMER prüfen – auch wenn der Raum offen ist

        for (let i = 0; i < this.walls.length; i++) {
            const w = this.walls[i];

            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };

            const ABx = B.x - A.x;
            const ABy = B.y - A.y;
            const APx = x - A.x;
            const APy = y - A.y;

            const abLen = Math.hypot(ABx, ABy);
            if (abLen === 0) continue;

            const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / (abLen * abLen)));

            const cx = A.x + t * ABx;
            const cy = A.y + t * ABy;

            if (Math.hypot(x - cx, y - cy) < 10) {
                return { index: i, t, x: cx, y: cy };
            }
        }
        return null;
    },

    isPointInsideRoom(x, y) {
    // Raum muss geschlossen sein
    if (!this.isClosed || this.points.length < 3) return false;

    let inside = false;

    // Raycasting: prüft, ob der Punkt innerhalb des Polygons liegt
    for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
        const xi = this.points[i].x, yi = this.points[i].y;
        const xj = this.points[j].x, yj = this.points[j].y;

        const intersect =
            ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
    },

    projectOnWall(x, y, w) {
        const A = { x: w.x1, y: w.y1 };
        const B = { x: w.x2, y: w.y2 };

        const ABx = B.x - A.x;
        const ABy = B.y - A.y;
        const APx = x - A.x;
        const APy = y - A.y;

        const abLen2 = ABx * ABx + ABy * ABy;
        if (abLen2 === 0) return { t: 0, x: A.x, y: A.y };

        let t = (APx * ABx + APy * ABy) / abLen2;
        t = Math.max(0, Math.min(1, t));

        return {
            t,
            x: A.x + t * ABx,
            y: A.y + t * ABy
        };
    },

    // --------------------------------------------------
    // Tür-Scharnier (alte Logik, exakt wie früher)
    // --------------------------------------------------
    setDoorHingeFromTap(door, tapX, tapY, wall) {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const tx = dx / len;
        const ty = dy / len;

        const cx = door.x;
        const cy = door.y;
        const half = door.width / 2;

        const x1 = cx - tx * half;
        const y1 = cy - ty * half;

        const x2 = cx + tx * half;
        const y2 = cy + ty * half;

        const d1 = Math.hypot(tapX - x1, tapY - y1);
        const d2 = Math.hypot(tapX - x2, tapY - y2);

        let hx, hy, ox, oy;
        if (d1 <= d2) {
            door.hinge = "start";
            hx = x1; hy = y1;
            ox = x2; oy = y2;
        } else {
            door.hinge = "end";
            hx = x2; hy = y2;
            ox = x1; oy = y1;
        }

        const ex = ox - hx;
        const ey = oy - hy;
        const elen = Math.hypot(ex, ey);
        if (elen === 0) return;

        const vx = tapX - hx;
        const vy = tapY - hy;

        const cross = ex * vy - ey * vx;
        door.side = cross >= 0 ? 1 : -1;
    },

    // --------------------------------------------------
    // Wände aktualisieren
    // --------------------------------------------------
    updateWalls() {
      
        this.walls = [];

        if (this.points.length < 2) return;

        // --------------------------------------------------
        // Wände neu aufbauen
        // --------------------------------------------------
        for (let i = 0; i < this.points.length - 1; i++) {
            const a = this.points[i];
            const b = this.points[i + 1];
            this.walls.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }

        if (this.isClosed && this.points.length > 2) {
            const last = this.points[this.points.length - 1];
            const first = this.points[0];
            this.walls.push({ x1: last.x, y1: last.y, x2: first.x, y2: first.y });
        }

        // --------------------------------------------------
        // Türen neu zuordnen (robust gegen Punkt-Einfügen)
        // --------------------------------------------------
        for (const d of this.doors) {
        if (d.type === "dachluke") continue; // ⭐ NICHT an Wände binden
            let bestWall = null;
            let bestDist = Infinity;
            let bestT = 0;

            for (let i = 0; i < this.walls.length; i++) {
                const w = this.walls[i];
                const proj = this.projectOnWall(d.x, d.y, w);
                const dist = Math.hypot(d.x - proj.x, d.y - proj.y);

                if (dist < bestDist) {
                    bestDist = dist;
                    bestWall = i;
                    bestT = proj.t;
                }
            }

            if (bestWall !== null) {
                d.wallIndex = bestWall;
                d.t = bestT;

                const w = this.walls[bestWall];
                const A = { x: w.x1, y: w.y1 };
                const B = { x: w.x2, y: w.y2 };
                d.x = A.x + (B.x - A.x) * d.t;
                d.y = A.y + (B.y - A.y) * d.t;
            }
        }

        // --------------------------------------------------
        // Fenster neu zuordnen
        // --------------------------------------------------
        for (const win of this.windows) {
            let bestWall = null;
            let bestDist = Infinity;
            let bestT = 0;

            for (let i = 0; i < this.walls.length; i++) {
                const w = this.walls[i];
                const proj = this.projectOnWall(win.x, win.y, w);
                const dist = Math.hypot(win.x - proj.x, win.y - proj.y);

                if (dist < bestDist) {
                    bestDist = dist;
                    bestWall = i;
                    bestT = proj.t;
                }
            }

            if (bestWall !== null) {
                win.wallIndex = bestWall;
                win.t = bestT;

                const w = this.walls[bestWall];
                const A = { x: w.x1, y: w.y1 };
                const B = { x: w.x2, y: w.y2 };
                win.x = A.x + (B.x - A.x) * win.t;
                win.y = A.y + (B.y - A.y) * win.t;
            }
        }
        // ⭐ Raumzentrum für nächste Bewegung merken
this._roomCenterBeforeMove = this._computeRoomCenter();

    },

  
// ------------------------------------------------------------
// ⭐ Hilfsfunktion: Raumzentrum berechnen
// ------------------------------------------------------------    
    _computeRoomCenter() {
    let sx = 0, sy = 0;
    for (const p of this.points) {
        sx += p.x;
        sy += p.y;
    }
    return {
        x: sx / this.points.length,
        y: sy / this.points.length
    };
},



    // ------------------------------------------------------------
// ⭐ Hilfsfunktion: Dachlukengröße berücksichtigen
// ------------------------------------------------------------   
    _circleInsideRoom(cx, cy, r) {
    // Prüfe 8 Punkte auf dem Kreis
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (!this.isPointInsideRoom(x, y)) return false;
    }
    return true;
},

  
    // --------------------------------------------------
    // Canvas-Transform (für zukünftigen Zoom/Pan vorbereitet)
    // --------------------------------------------------
    applyTransform() {
        const ctx = this.ctx;
        if (!ctx) return;

        // Welt → Screen:
        // screen = (world + offset) * zoom
        ctx.translate(this.offsetX * this.zoom, this.offsetY * this.zoom);
        ctx.scale(this.zoom, this.zoom);
    },
   
    // --------------------------------------------------
    // Rendering
    // --------------------------------------------------
    render() {
        const ctx = this.ctx;
        if (!ctx || !this.canvas) return;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        this.applyTransform();   // Transform aktiv

        this.drawGrid();         // Grid im Welt-Raum
        this.drawFloor();
        this.drawPolygon();
        this.drawWalls();
        this.drawWallLengths();
        this.drawWindows();
        this.drawDoors();

        // Winkelanzeige beim Drag
        if (this.isDragging && this.selectedPoint) {
            const idx = this.points.indexOf(this.selectedPoint);
            const affected = new Set([idx]);

            if (this.isClosed) {
                affected.add((idx - 1 + this.points.length) % this.points.length);
                affected.add((idx + 1) % this.points.length);
            } else {
                if (idx > 0) affected.add(idx - 1);
                if (idx < this.points.length - 1) affected.add(idx + 1);
            }

            for (const i of affected) {
                const prev = this.isClosed
                    ? this.points[(i - 1 + this.points.length) % this.points.length]
                    : this.points[i - 1];

                const next = this.isClosed
                    ? this.points[(i + 1) % this.points.length]
                    : this.points[i + 1];

                if (prev && next) {
                    this.drawAngleAtPoint(this.points[i], prev, next);
                }
            }
        }

        ctx.restore();

        // Hover-Kreuz im Screen-Space
        this.drawHoverCross();
    },

    drawGrid() {
        const ctx = this.ctx;
        if (!ctx || !this.canvas) return;

        const size = this.gridSize;

        ctx.save();

        ctx.strokeStyle = this.gridColor;
        ctx.globalAlpha = this.snapEnabled ? this.gridAlphaSnap : this.gridAlpha;
        ctx.lineWidth = 1;

        // Sichtbarer Bereich im Welt-Raum
        const widthWorld = this.canvas.width / this.zoom;
        const heightWorld = this.canvas.height / this.zoom;

        const left = -this.offsetX;
        const top = -this.offsetY;
        const right = left + widthWorld;
        const bottom = top + heightWorld;

        const startX = Math.floor(left / size) * size;
        const endX = Math.ceil(right / size) * size;

        const startY = Math.floor(top / size) * size;
        const endY = Math.ceil(bottom / size) * size;

        // Vertikale Linien
        for (let x = startX; x <= endX; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();
        }

        // Horizontale Linien
        for (let y = startY; y <= endY; y += size) {
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
        }

        ctx.restore();
    },
    
    // --------------------------------------------------
    // Boden zeichnen
    // --------------------------------------------------
    drawFloor() {
        if (this.points.length < 3) return;

        const ctx = this.ctx;
        
    this._floorColor = "rgba(255,255,255,0.03)";
    ctx.fillStyle = this._floorColor;
        
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }

        if (this.isClosed) ctx.closePath();
        ctx.fill();
    },

    // --------------------------------------------------
    // Polygon zeichnen
    // --------------------------------------------------
    drawPolygon() {
        if (this.points.length === 0) return;

        const ctx = this.ctx;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);

        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }

        if (this.isClosed) ctx.closePath();
        ctx.stroke();

        // Punkte zeichnen
        for (const p of this.points) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    // --------------------------------------------------
    // Wände zeichnen
    // --------------------------------------------------
    drawWalls() {
        const ctx = this.ctx;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;

        for (const w of this.walls) {
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.stroke();
        }
    },

    // --------------------------------------------------
    // Wandlängen
    // --------------------------------------------------
    drawWallLengths() {
        if (!this.isDragging || !this.selectedPoint) return;

        const ctx = this.ctx;
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 3;

        for (const w of this.walls) {
            const isEnd =
                (w.x1 === this.selectedPoint.x && w.y1 === this.selectedPoint.y) ||
                (w.x2 === this.selectedPoint.x && w.y2 === this.selectedPoint.y);

            if (!isEnd) continue;

            const dx = w.x2 - w.x1;
            const dy = w.y2 - w.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            const meters = len / this.PIXELS_PER_METER;
            const text = meters.toFixed(2) + " m";

            const mx = (w.x1 + w.x2) / 2;
            const my = (w.y1 + w.y2) / 2;

            ctx.save();
            ctx.translate(mx, my - 10);

            ctx.strokeText(text, 0, 0);
            ctx.fillText(text, 0, 0);

            ctx.restore();
        }
    },

    // --------------------------------------------------
    // Winkelanzeige
    // --------------------------------------------------
    drawAngleAtPoint(P, A, B) {
        const ctx = this.ctx;

        const v1x = A.x - P.x;
        const v1y = A.y - P.y;
        const v2x = B.x - P.x;
        const v2y = B.y - P.y;

        const dot = v1x * v2x + v1y * v2y;
        const len1 = Math.sqrt(v1x*v1x + v1y*v1y);
        const len2 = Math.sqrt(v2x*v2x + v2y*v2y);

        if (len1 === 0 || len2 === 0) return;

        const angle = Math.acos(dot / (len1 * len2));
        const deg = (angle * 180 / Math.PI).toFixed(1);

        ctx.font = "14px sans-serif";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 3;

        ctx.strokeText(deg + "°", P.x + 12, P.y - 12);
        ctx.fillText(deg + "°", P.x + 12, P.y - 12);
    },

    // --------------------------------------------------
    // Türen zeichnen (alte Darstellung)
    // --------------------------------------------------
    drawDoors() {
        const DOOR_TYPES_WITH_ARC = new Set([
            "zimmertuer",
            "haustuer",
            "terrassentuer",
            "gartentor"
        ]);

        const ctx = this.ctx;
        for (const d of this.doors) {
        
            // ⭐ Dachluke: frei im Raum, braucht keine Wandgeometrie
            if (d.type === "dachluke") {
                // drawDoorByType nutzt bei Dachluke nur d.x/d.y, die Geometrie ist egal
                this.drawDoorByType(ctx, d, {});
                continue;
            }
        
            const w = this.walls[d.wallIndex];
            if (!w) continue;
        
            const dx = w.x2 - w.x1;
            const dy = w.y2 - w.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;
        
            const tx = dx / len;
            const ty = dy / len;
        
            const cx = d.x;
            const cy = d.y;
        
            const half = d.width / 2;
        
            const x1 = cx - tx * half;
            const y1 = cy - ty * half;
        
            const x2 = cx + tx * half;
            const y2 = cy + ty * half;
        
            // ------------------------------------------------------------
            // ⭐ Tür nach Typ zeichnen
            // ------------------------------------------------------------
            this.drawDoorByType(ctx, d, {
                w, x1, y1, x2, y2, hx: null, hy: null, ox: null, oy: null, px: null, py: null, elen: null
            });
            
            // Wenn kein Scharnier → fertig (z.B. Schiebetür, Durchgang)
            if (!d.hinge) continue;
            
            // ------------------------------------------------------------
            // ⭐ Scharnierberechnung wie bisher
            // ------------------------------------------------------------
            let hx, hy, ox, oy;
            if (d.hinge === "start") {
                hx = x1; hy = y1;
                ox = x2; oy = y2;
            } else {
                hx = x2; hy = y2;
                ox = x1; oy = y1;
            }
            
            const ex = ox - hx;
            const ey = oy - hy;
            const elen = Math.sqrt(ex*ex + ey*ey);
            if (elen === 0) continue;
            
            const px = -ey / elen;
            const py = ex / elen;
            
            const side = d.side || 1;
            
            const sx = hx + px * elen * side;
            const sy = hy + py * elen * side;
            
            // ------------------------------------------------------------
            // ⭐ Scharnier-Strich NUR für klassische Türen
            // ------------------------------------------------------------
            if (DOOR_TYPES_WITH_ARC.has(d.type)) {
                ctx.strokeStyle = "rgba(0,255,200,0.4)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                ctx.lineTo(sx, sy);
                ctx.stroke();
            }
        
            // Viertelkreis (nur für normale Türen)
            if (DOOR_TYPES_WITH_ARC.has(d.type)) {
                this.drawDoorArc(ctx, d, hx, hy, px, py, elen, side);
            }
        }

    },

drawDoorByType(ctx, d, geo) {

    const { x1, y1, x2, y2 } = geo;

    switch (d.type) {

        // ------------------------------------------------------------
        // ⭐ Zimmertür
        // ------------------------------------------------------------
case "zimmertuer": {

 //   d.isOpen = true;  nur zum Testen

    // Drehpunkt bestimmen
    const hx = (d.hinge === "start") ? x1 : x2;
    const hy = (d.hinge === "start") ? y1 : y2;

    const ox = (d.hinge === "start") ? x2 : x1;
    const oy = (d.hinge === "start") ? y2 : y1;

    const dx = ox - hx;
    const dy = oy - hy;
    const len = Math.hypot(dx, dy);

    const nx = dx / len;
    const ny = dy / len;

    const px = -ny;
    const py = nx;

    const side = d.side || 1;

    // ------------------------------------------------------------
    // 1. Türschwelle bei offener Tür (wie bei Haustür, nur ohne Glow)
    // ------------------------------------------------------------
    if (d.isOpen) {

        const wallThickness = 12;
        const extra = 8;
        const half = (wallThickness + extra) / 2;

        const s1x = hx + px * half;
        const s1y = hy + py * half;

        const s2x = ox + px * half;
        const s2y = oy + py * half;

        const s3x = ox - px * half;
        const s3y = oy - py * half;

        const s4x = hx - px * half;
        const s4y = hy - py * half;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s1x, s1y);
        ctx.lineTo(s2x, s2y);
        ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.restore();
    }

    // ------------------------------------------------------------
    // 2. Türblatt (offen/geschlossen) – Zimmertür filigraner
    // ------------------------------------------------------------
    ctx.strokeStyle = "#00ffc8";  // Zimmertürfarbe
    ctx.lineWidth = 5;            // dünner als Haustür
    ctx.shadowColor = "transparent"; // kein Glow
    ctx.shadowBlur = 0;

    if (d.isOpen) {
        const angle = Math.PI / 2 * side;

        const rx = nx * Math.cos(angle) - ny * Math.sin(angle);
        const ry = nx * Math.sin(angle) + ny * Math.cos(angle);

        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + rx * len, hy + ry * len);
        ctx.stroke();

    } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    return;
}


        // ------------------------------------------------------------
        // ⭐ Haustür
        // ------------------------------------------------------------
case "haustuer": {

//    d.isOpen = true;  nur zum Testen

    // Drehpunkt bestimmen (Scharnier)
    const hx = (d.hinge === "start") ? x1 : x2;
    const hy = (d.hinge === "start") ? y1 : y2;

    // anderer Endpunkt (Türblatt-Ende)
    const ox = (d.hinge === "start") ? x2 : x1;
    const oy = (d.hinge === "start") ? y2 : y1;

    // Türblatt-Vektor
    const dx = ox - hx;
    const dy = oy - hy;
    const len = Math.hypot(dx, dy);

    const nx = dx / len;   // entlang der Tür
    const ny = dy / len;

    const px = -ny;        // senkrecht zur Tür
    const py = nx;

    const side = d.side || 1;

    // ------------------------------------------------------------
    // 1. Türschwelle bei offener Tür
    // ------------------------------------------------------------
    if (d.isOpen) {

        const wallThickness = 12;
        const extra = 8;
        const half = (wallThickness + extra) / 2;

        const s1x = hx + px * half;
        const s1y = hy + py * half;

        const s2x = ox + px * half;
        const s2y = oy + py * half;

        const s3x = ox - px * half;
        const s3y = oy - py * half;

        const s4x = hx - px * half;
        const s4y = hy - py * half;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s1x, s1y);
        ctx.lineTo(s2x, s2y);
        ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.restore();
    }

    // ------------------------------------------------------------
    // 2. Türblatt (offen/geschlossen) – Haustür dicker + Glow
    // ------------------------------------------------------------

    ctx.strokeStyle = "#00d4a8";   // Haustürfarbe
    ctx.lineWidth = 9;             // dicker als Zimmertür
    ctx.shadowColor = "rgba(0, 212, 168, 0.35)"; // dezentes Leuchten
    ctx.shadowBlur = 12;

    if (d.isOpen) {
        const angle = Math.PI / 2 * side;

        const rx = nx * Math.cos(angle) - ny * Math.sin(angle);
        const ry = nx * Math.sin(angle) + ny * Math.cos(angle);

        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + rx * len, hy + ry * len);
        ctx.stroke();

    } else {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    return;
}


    // ------------------------------------------------------------
    // 3. Haussymbol auf GEGENÜBERLIEGENDER Seite
    // ------------------------------------------------------------

 //   const mx = (x1 + x2) / 2;
  //  const my = (y1 + y2) / 2;

 //   const iconOffset = 18;

//    const ix = mx + px * (-side) * iconOffset;
//    const iy = my + py * (-side) * iconOffset;

//    ctx.save();
//    ctx.translate(ix, iy);
//    ctx.rotate(Math.atan2(ny, nx));
//    drawDoorIcon(ctx, 0, 0, 24);
//    ctx.restore();

//    return;
//}




        // ------------------------------------------------------------
        // ⭐ Dachluke → rund, frei platzierbar
        // ------------------------------------------------------------
//        case "dachluke":
//            ctx.strokeStyle = "#00b7ff";
 //           ctx.lineWidth = 3;
  //          ctx.beginPath();
   //         ctx.arc(d.x, d.y, d.width / 2, 0, Math.PI * 2);
    //        ctx.stroke();
        
    //        ctx.fillStyle = "rgba(0,183,255,0.15)";
     //       ctx.beginPath();
      //      ctx.arc(d.x, d.y, d.width / 2.5, 0, Math.PI * 2);
       //     ctx.fill();
        //    return;



// ------------------------------------------------------------
// ⭐ Schiebetür → kein Viertelkreis
// ------------------------------------------------------------
case "schiebetuer": {
 //   d.isOpen = true;  nur zum Testen

    // ------------------------------------------------------------
    // 1. Türschwelle (identisch zur Falttür)
    // ------------------------------------------------------------

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (!len) return;

    const nx = dx / len;
    const ny = dy / len;

    const px = -ny;
    const py = nx;

    const wallThickness = 12;
    const extra = 8;
    const half = (wallThickness + extra) / 2;

    const t1x = x1 + px * half;
    const t1y = y1 + py * half;

    const t2x = x2 + px * half;
    const t2y = y2 + py * half;

    const t3x = x2 - px * half;
    const t3y = y2 - py * half;

    const t4x = x1 - px * half;
    const t4y = y1 - py * half;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(t1x, t1y);
    ctx.lineTo(t2x, t2y);
    ctx.lineTo(t3x, t3y);
    ctx.lineTo(t4x, t4y);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.restore();


    // ------------------------------------------------------------
    // 2. Schiebetür-Linie: offen/geschlossen
    // ------------------------------------------------------------

    // 1. Scharnier-Ende bestimmen
    let hx, hy, ox, oy;
    if (d.hinge === "start") {
        hx = x1; hy = y1;
        ox = x2; oy = y2;
    } else {
        hx = x2; hy = y2;
        ox = x1; oy = y1;
    }

    // 2. Richtungsvektoren entlang der Tür
    const dx2 = ox - hx;
    const dy2 = oy - hy;
    const len2 = Math.hypot(dx2, dy2);
    if (!len2) return;

    const nx2 = dx2 / len2;   // entlang der Tür
    const ny2 = dy2 / len2;

    const px2 = -ny2;         // senkrecht zur Tür
    const py2 = nx2;

    const side = d.side || 1;
    const offset = 4; // Abstand von der Schwelle (wie bisher)

    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;

    if (d.isOpen) {
        // --------------------------------------------------------
        // OFFENE SCHIEBETÜR (DEIN BISHERIGER CODE, UNVERÄNDERT)
        // Mittelpunkt am Scharnier, volle Länge, seitlich versetzt
        // --------------------------------------------------------

        const mx = hx + px2 * offset * side;
        const my = hy + py2 * offset * side;

        const halfLen = len2 / 2;

        const sx = mx - nx2 * halfLen;
        const sy = my - ny2 * halfLen;

        const ex2 = mx + nx2 * halfLen;
        const ey2 = my + ny2 * halfLen;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex2, ey2);
        ctx.stroke();

    } else {
        // --------------------------------------------------------
        // GESCHLOSSENE SCHIEBETÜR
        // gleiche Seite, gleicher offset,
        // aber NICHT mehr hälftig verschoben:
        // Türblatt startet am Scharnier und läuft bis zum anderen Ende
        // --------------------------------------------------------

        const bx = hx + px2 * offset * side;
        const by = hy + py2 * offset * side;

        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + nx2 * len2, by + ny2 * len2);
        ctx.stroke();
    }

    ctx.restore();
    return;
}


        // ------------------------------------------------------------
        // ⭐ Falttür → segmentiert
        // ------------------------------------------------------------
case "falttuer": {
  //  d.isOpen = true;  nur zum Testen

    // Wandvektor
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (!len) return;

    const nx = dx / len;
    const ny = dy / len;

    // Senkrechter Vektor
    const px = -ny;
    const py = nx;

    // Wanddicke + etwas breiter für Falttür
    const wallThickness = 5;
    const extra = 0;
    const half = (wallThickness + extra) / 2;

    // Türblatt-/Schwellen-Ecken
    const t1x = x1 + px * half;
    const t1y = y1 + py * half;

    const t2x = x2 + px * half;
    const t2y = y2 + py * half;

    const t3x = x2 - px * half;
    const t3y = y2 - py * half;

    const t4x = x1 - px * half;
    const t4y = y1 - py * half;

    // ------------------------------------------------------------
    // 1. Schwelle / Türfläche (immer sichtbar)
    // ------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(t1x, t1y);
    ctx.lineTo(t2x, t2y);
    ctx.lineTo(t3x, t3y);
    ctx.lineTo(t4x, t4y);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.restore();

    // ------------------------------------------------------------
    // 2. Geschlossene Falttür: dünne Linie in der MITTE der Schwelle
    // ------------------------------------------------------------
    if (!d.isOpen) {
        // Mittelpunkt der Schwelle in Querrichtung
        const c1x = (t1x + t4x) / 2;
        const c1y = (t1y + t4y) / 2;

        const c2x = (t2x + t3x) / 2;
        const c2y = (t2y + t3y) / 2;

        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1; // sehr dünn
        ctx.beginPath();
        ctx.moveTo(c1x, c1y);
        ctx.lineTo(c2x, c2y);
        ctx.stroke();
        ctx.restore();

        return;
    }

    // ------------------------------------------------------------
    // 3. Offene Falttür – dein bisheriger Code (Zacken)
    // ------------------------------------------------------------

    // Scharnier-Ende bestimmen
    let hx, hy, ox, oy;
    if (d.hinge === "start") {
        hx = x1; hy = y1;
        ox = x2; oy = y2;
    } else {
        hx = x2; hy = y2;
        ox = x1; oy = y1;
    }

    const dx2 = ox - hx;
    const dy2 = oy - hy;
    const len2 = Math.hypot(dx2, dy2);
    if (!len2) return;

    const nx2 = dx2 / len2;
    const ny2 = dy2 / len2;

    const px2 = -ny2;
    const py2 = nx2;

    const step = 2;
    const height = 4;
    const count = 8;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(Math.atan2(dy2, dx2));

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(0, 0);

    for (let i = 1; i <= count; i++) {
        const x = i * step;
        const y = (i % 2 === 0) ? -height : 0;
        ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();

    return;
}




        // ------------------------------------------------------------
        // ⭐ Terrassentür → Glas
        // ------------------------------------------------------------
case "terrassentuer": {
 //   d.isOpen = false;  nur zum Testen

    // ------------------------------------------------------------
    // 0. Drehpunkt bestimmen (IDENTISCH zur Zimmertür)
    // ------------------------------------------------------------
    const hx = (d.hinge === "start") ? x1 : x2;
    const hy = (d.hinge === "start") ? y1 : y2;

    const ox = (d.hinge === "start") ? x2 : x1;
    const oy = (d.hinge === "start") ? y2 : y1;

    const dx = ox - hx;
    const dy = oy - hy;
    const len = Math.hypot(dx, dy);
    if (!len) return;

    const nx = dx / len;
    const ny = dy / len;

    const px = -ny;
    const py = nx;

    const side = d.side || 1;

    // ------------------------------------------------------------
    // 1. Türschwelle bei offener Tür (IDENTISCH zur Zimmertür)
    // ------------------------------------------------------------
    if (d.isOpen) {

        const wallThickness = 12;
        const extra = 8;
        const half = (wallThickness + extra) / 2;

        const s1x = hx + px * half;
        const s1y = hy + py * half;

        const s2x = ox + px * half;
        const s2y = oy + py * half;

        const s3x = ox - px * half;
        const s3y = oy - py * half;

        const s4x = hx - px * half;
        const s4y = hy - py * half;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s1x, s1y);
        ctx.lineTo(s2x, s2y);
        ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.restore();
    }

    // ------------------------------------------------------------
    // 2. Türblatt (offen/geschlossen) – DESIGN BLEIBT TERRASSENTÜR
    // ------------------------------------------------------------

    // OFFEN → geschwenktes Türblatt (wie Zimmertür)
    if (d.isOpen) {

        const angle = Math.PI / 2 * side;

        const rx = nx * Math.cos(angle) - ny * Math.sin(angle);
        const ry = nx * Math.sin(angle) + ny * Math.cos(angle);

        const ex = hx + rx * len;
        const ey = hy + ry * len;

        // Rahmen (Terrassentür-Design)
        ctx.strokeStyle = "#00ffc8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Glasfüllung (Terrassentür-Design)
        ctx.strokeStyle = "rgba(0, 180, 255, 0.7)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

    } else {

        // GESCHLOSSEN → Linie auf der Wand (wie Zimmertür)
        ctx.strokeStyle = "#00ffc8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 180, 255, 0.7)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    return;
}


        // ------------------------------------------------------------
        // ⭐ Garagentor → dicke Linie
        // ------------------------------------------------------------
case "garagentor": {
   // d.isOpen = true;  nur zum Testen

    // ------------------------------------------------------------
    // 0. Drehpunkt bestimmen (Scharnierseite)
    // ------------------------------------------------------------
    const hx = (d.hinge === "start") ? x1 : x2;
    const hy = (d.hinge === "start") ? y1 : y2;

    const ox = (d.hinge === "start") ? x2 : x1;
    const oy = (d.hinge === "start") ? y2 : y1;

    const dx = ox - hx;
    const dy = oy - hy;
    const len = Math.hypot(dx, dy);
    if (!len) return;

    const nx = dx / len;
    const ny = dy / len;

    // Normalenvektor (senkrecht zur Wand)
    const px = -ny;
    const py = nx;

    const side = d.side || 1;

    // ------------------------------------------------------------
    // 1. Schwelle bei offen
    // ------------------------------------------------------------
    if (d.isOpen) {

        const wallThickness = 16;
        const extra = 10;
        const half = (wallThickness + extra) / 2;

        const s1x = hx + px * half;
        const s1y = hy + py * half;

        const s2x = ox + px * half;
        const s2y = oy + py * half;

        const s3x = ox - px * half;
        const s3y = oy - py * half;

        const s4x = hx - px * half;
        const s4y = hy - py * half;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s1x, s1y);
        ctx.lineTo(s2x, s2y);
        ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.restore();
    }

    // ------------------------------------------------------------
    // 2. Torblatt (offen = dick + transparent, geschlossen = dünn)
    // ------------------------------------------------------------

    let bx1 = x1;
    let by1 = y1;
    let bx2 = x2;
    let by2 = y2;

    if (d.isOpen) {
        // Tor wird parallel zur Schwelle verschoben
        const offset = 40 * side; // Öffnungsweite

        bx1 = x1 + px * offset;
        by1 = y1 + py * offset;

        bx2 = x2 + px * offset;
        by2 = y2 + py * offset;
    }

    if (d.isOpen) {

        // --- OFFEN: dickes, transparentes Torblatt
        ctx.strokeStyle = "rgba(0,255,200,0.25)";
        ctx.lineWidth = 80;
        ctx.beginPath();
        ctx.moveTo(bx1, by1);
        ctx.lineTo(bx2, by2);
        ctx.stroke();

        // --- Strukturstreifen
        ctx.strokeStyle = "rgba(0,255,200,0.3)";
        ctx.lineWidth = 2;

        const steps = 3;
        for (let i = 1; i <= steps; i++) {
            const t = i / (steps + 1);

            const sx = bx1 + (bx2 - bx1) * t;
            const sy = by1 + (by2 - by1) * t;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(
                sx + (y1 - y2) * 0.15,
                sy + (x2 - x1) * 0.15
            );
            ctx.stroke();
        }

    } else {

        // --- GESCHLOSSEN: dünne Linie auf der Schwelle
        ctx.strokeStyle = "#00ffc8";
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    return;
}



        // ------------------------------------------------------------
        // ⭐ Gartentörchen → schmal
        // ------------------------------------------------------------
case "gartentor": {

//    d.isOpen = true;  nur zum Testen

    // ------------------------------------------------------------
    // 0. Drehpunkt bestimmen (Scharnier)
    // ------------------------------------------------------------
    const hx = (d.hinge === "start") ? x1 : x2;
    const hy = (d.hinge === "start") ? y1 : y2;

    const ox = (d.hinge === "start") ? x2 : x1;
    const oy = (d.hinge === "start") ? y2 : y1;

    const dx = ox - hx;
    const dy = oy - hy;
    const len = Math.hypot(dx, dy);
    if (!len) return;

    // Basisvektor entlang des geschlossenen Tores
    const nx = dx / len;
    const ny = dy / len;

    // Normalenvektor (senkrecht zur Wand)
    const px = -ny;
    const py = nx;

    const side = d.side || 1;

    // ------------------------------------------------------------
    // 1. Rotation für Torblatt UND Normalenvektor
    // ------------------------------------------------------------
    let rx = nx;
    let ry = ny;

    let px2 = px;
    let py2 = py;

    if (d.isOpen) {
        const angle = Math.PI / 2 * side;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Torblatt drehen
        rx = nx * cosA - ny * sinA;
        ry = nx * sinA + ny * cosA;

        // Normalenvektor mitdrehen (wichtig für offene Darstellung)
        px2 = px * cosA - py * sinA;
        py2 = px * sinA + py * cosA;
    }

    // ------------------------------------------------------------
    // 2. Türschwelle (wie bei allen anderen Türen)
    // ------------------------------------------------------------
    {
        const wallThickness = 16;
        const extra = 10;
        const half = (wallThickness + extra) / 2;

        const s1x = hx + px * half;
        const s1y = hy + py * half;

        const s2x = ox + px * half;
        const s2y = oy + py * half;

        const s3x = ox - px * half;
        const s3y = oy - py * half;

        const s4x = hx - px * half;
        const s4y = hy - py * half;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s1x, s1y);
        ctx.lineTo(s2x, s2y);
        ctx.lineTo(s3x, s3y);
        ctx.lineTo(s4x, s4y);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.restore();
    }

    // ------------------------------------------------------------
    // 3. Parameter des Gartentors
    // ------------------------------------------------------------
    const torBreite = len;
    const torHoehe = 4;
    const streben = 6;
    const strebenBreite = 4;
    const querBreite = 6;

    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#8b5a2b";
    ctx.fillStyle = "#8b5a2b";

    // ------------------------------------------------------------
    // 4. Querlatte oben (rotiert korrekt)
    // ------------------------------------------------------------
    const q1x = hx;
    const q1y = hy;

    const q2x = hx + rx * torBreite;
    const q2y = hy + ry * torBreite;

    ctx.lineWidth = querBreite;
    ctx.beginPath();
    ctx.moveTo(q1x, q1y);
    ctx.lineTo(q2x, q2y);
    ctx.stroke();

    // ------------------------------------------------------------
    // 5. Senkrechte Latten
    //    → immer auf der GEGENÜBERLIEGENDEN Seite des Viertelkreises
    //    → korrekt rotiert im offenen Zustand
    // ------------------------------------------------------------
    ctx.lineWidth = strebenBreite;

    const lattenSide = -side; // andere Seite als Scharnier/Viertelkreis

    for (let i = 0; i <= streben; i++) {
        const t = i / streben;

        // Startpunkt der Latte entlang des gedrehten Torblatts
        const sx = hx + rx * (t * torBreite);
        const sy = hy + ry * (t * torBreite);

        // Endpunkt der Latte: senkrecht zum gedrehten Torblatt
        const ex = sx + px2 * torHoehe * lattenSide;
        const ey = sy + py2 * torHoehe * lattenSide;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }

    ctx.restore();
    return;
}


         // ------------------------------------------------------------
        // ⭐ Durchgang
        // ------------------------------------------------------------           
case "durchgang": {

    // ------------------------------------------------------------
    // 0. Drehpunkt bestimmen (Scharnier irrelevant, aber wir brauchen hx/ox)
    // ------------------------------------------------------------
    const hx = x1;
    const hy = y1;

    const ox = x2;
    const oy = y2;

    const dx = ox - hx;
    const dy = oy - hy;
    const len = Math.hypot(dx, dy);
    if (!len) return;

    // Wandnormalen bestimmen
    const nx = dx / len;
    const ny = dy / len;

    const px = -ny;
    const py = nx;

    // ------------------------------------------------------------
    // 1. Schwelle zeichnen (identisch zu allen anderen Türen)
    // ------------------------------------------------------------
    const wallThickness = 16;
    const extra = 10;
    const half = (wallThickness + extra) / 2;

    const s1x = hx + px * half;
    const s1y = hy + py * half;

    const s2x = ox + px * half;
    const s2y = oy + py * half;

    const s3x = ox - px * half;
    const s3y = oy - py * half;

    const s4x = hx - px * half;
    const s4y = hy - py * half;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s1x, s1y);
    ctx.lineTo(s2x, s2y);
    ctx.lineTo(s3x, s3y);
    ctx.lineTo(s4x, s4y);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.restore();

    return;
}


// ------------------------------------------------------------
// ⭐ Dachluke
// ------------------------------------------------------------     
case "dachluke": {
    // d.isOpen = false;  nur zum Testen

    const r = d.width / 2;

    // -------------------------------
    // Geschlossen
    // -------------------------------
    if (!d.isOpen) {
        ctx.strokeStyle = "#00b7ff";
        ctx.lineWidth = 3;

        // Außenkreis
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // Innenfüllung
        ctx.fillStyle = "rgba(0,183,255,0.15)";
        ctx.beginPath();
        ctx.arc(d.x, d.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Scharnier anzeigen (Tangente)
        if (d.hingeAngle !== undefined) {
            const hingeX = d.x + Math.cos(d.hingeAngle) * r;
            const hingeY = d.y + Math.sin(d.hingeAngle) * r;

            const hingeLen = r * 1.2;
            const tx = Math.cos(d.hingeAngle + Math.PI / 2);
            const ty = Math.sin(d.hingeAngle + Math.PI / 2);

            ctx.beginPath();
            ctx.moveTo(hingeX - tx * hingeLen / 2, hingeY - ty * hingeLen / 2);
            ctx.lineTo(hingeX + tx * hingeLen / 2, hingeY + ty * hingeLen / 2);
            ctx.stroke();
        }

        return;
    }

    // -------------------------------
    // Offen → Ellipse als Klappe
    // -------------------------------

    ctx.strokeStyle = "#00b7ff";
    ctx.lineWidth = 3;

    // 1) Hauptkreis (Loch)
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // 2) Ellipse (Deckel)
    const angle = d.hingeAngle || 0;

    // Ellipsen-Radien → quer
    const rx = r;          // breit
    const ry = r * 0.35;   // flach

    // ⭐ Abstand exakt so, dass Ellipse tangential am Kreis anliegt
    const offsetX = Math.cos(angle) * (r + ry);
    const offsetY = Math.sin(angle) * (r + ry);

    ctx.save();
    ctx.translate(d.x + offsetX, d.y + offsetY);

    // ⭐ Ellipse um 90° versetzt drehen, damit breite Seite am Kreis anliegt
    ctx.rotate(angle + Math.PI / 2);

    // Füllung
    ctx.fillStyle = "rgba(0,183,255,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kontur
    ctx.strokeStyle = "#00b7ff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    // 3) Scharnier-Strich → TANGENTE
    const hingeX = d.x + Math.cos(angle) * r;
    const hingeY = d.y + Math.sin(angle) * r;

    const hingeLen = r * 1.2;
    const tx = Math.cos(angle + Math.PI / 2);
    const ty = Math.sin(angle + Math.PI / 2);

    ctx.beginPath();
    ctx.moveTo(hingeX - tx * hingeLen / 2, hingeY - ty * hingeLen / 2);
    ctx.lineTo(hingeX + tx * hingeLen / 2, hingeY + ty * hingeLen / 2);
    ctx.stroke();

    return;
}

            

}
},


drawDoorArc(ctx, d, hx, hy, px, py, elen, side) {
    const baseVecX = px * elen * side;
    const baseVecY = py * elen * side;

    const steps = 24;
    ctx.strokeStyle = "rgba(0,255,200,0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const angle = -side * (Math.PI / 2) * t;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const rx = baseVecX * cosA - baseVecY * sinA;
        const ry = baseVecX * sinA + baseVecY * cosA;

        const px2 = hx + rx;
        const py2 = hy + ry;

        if (i === 0) ctx.moveTo(px2, py2);
        else ctx.lineTo(px2, py2);
    }

    ctx.stroke();
},
    
    
    drawWindows() {
        const ctx = this.ctx;

        ctx.strokeStyle = "#4aa3ff";
        ctx.lineWidth = 4;

        for (const w of this.windows) {
            const wall = this.walls[w.wallIndex];
            if (!wall) continue;

            const dx = wall.x2 - wall.x1;
            const dy = wall.y2 - wall.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            const tx = dx / len;
            const ty = dy / len;

            const cx = w.x;
            const cy = w.y;

            const half = w.width / 2;

            const x1 = cx - tx * half;
            const y1 = cy - ty * half;

            const x2 = cx + tx * half;
            const y2 = cy + ty * half;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    },

    // --------------------------------------------------
    // Hover-Kreuz
    // --------------------------------------------------
    drawHoverCross() {
        const ctx = this.ctx;
        const { x, y } = this.hover;

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
    },

    // --------------------------------------------------
    // Buttons (Tür/Fenster EINMALIG)
    // --------------------------------------------------
    setupDoorButton() {
        const btn = document.getElementById("btnDoorMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.hideContextMenu();
            this.mode = "doors";
            this._placingDoor = false;
        });
    },

    setupWindowButton() {
        const btn = document.getElementById("btnWindowMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.hideContextMenu();
            this.mode = "windows";
        });
    },

    // --------------------------------------------------
    // Grid-Size Slider
    // --------------------------------------------------
    setupGridSlider() {
        const slider = document.getElementById("gridSizeSlider");
        if (!slider) return;
    
        slider.addEventListener("input", () => {
            this.setGridSize(parseInt(slider.value));
        });
    },

    // --------------------------------------------------
    // Snap-Toggle
    // --------------------------------------------------
    setupSnapButton() {
        const btn = document.getElementById("btnSnapToggle");
        if (!btn) return;
    
        btn.addEventListener("click", () => {
            this.snapEnabled = !this.snapEnabled;
    
            // Optional: Button visuell hervorheben
            btn.style.background = this.snapEnabled ? "#66bb6a" : "#444";
    
            this.render();
        });
    },

    setupResetButton() {
        const btn = document.getElementById("btnResetView");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.resetView();
        });
    },

    // --------------------------------------------------
    // Delete-Toast
    // --------------------------------------------------
    showDeleteToast(message, onConfirm) {
        this._toastConfirmFn = onConfirm;

        if (!this._toastEl) {
            const el = document.createElement("div");
            el.style.position = "fixed";
            el.style.left = "50%";
            el.style.bottom = "20px";
            el.style.transform = "translateX(-50%)";
            el.style.background = "rgba(0,0,0,0.85)";
            el.style.color = "#fff";
            el.style.padding = "16px 20px";
            el.style.borderRadius = "10px";
            el.style.display = "flex";
            el.style.alignItems = "center";
            el.style.gap = "12px";
            el.style.zIndex = "10000";
            el.style.fontSize = "16px";

            const textSpan = document.createElement("span");
            textSpan.id = "rd-toast-text";

            const btnYes = document.createElement("button");
            btnYes.textContent = "Löschen";
            btnYes.style.padding = "10px 16px";
            btnYes.style.border = "none";
            btnYes.style.borderRadius = "6px";
            btnYes.style.background = "#e74c3c";
            btnYes.style.color = "#fff";
            btnYes.style.fontSize = "16px";

            const btnNo = document.createElement("button");
            btnNo.textContent = "Abbrechen";
            btnNo.style.padding = "10px 16px";
            btnNo.style.border = "none";
            btnNo.style.borderRadius = "6px";
            btnNo.style.background = "#555";
            btnNo.style.color = "#fff";
            btnNo.style.fontSize = "16px";

            btnYes.addEventListener("click", () => {
                if (this._toastConfirmFn) this._toastConfirmFn();
                this._contextJustClosed = false;
                this.hideToast();
            });

            btnNo.addEventListener("click", () => {
                this.hideToast();
            });

            el.appendChild(textSpan);
            el.appendChild(btnYes);
            el.appendChild(btnNo);

            document.body.appendChild(el);
            this._toastEl = el;
        }

        const textSpan = this._toastEl.querySelector("#rd-toast-text");
        if (textSpan) textSpan.textContent = message;

        this._toastEl.style.display = "flex";
    },

    resetView() {
        this.zoom = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.render();
    },

    hideToast() {
        if (this._toastEl) {
            this._toastEl.style.display = "none";
        }
        this._toastConfirmFn = null;
    },

    // --------------------------------------------------
    // NEU: Editor-API (Schritt 9)
    // --------------------------------------------------

// Werkzeug setzen (z.B. "select", "draw", "door", "window", "smartdevice")
setTool(tool, subtype = null) {

    this.currentTool = tool;


    // ------------------------------------------------------------
    // ⭐ Dachluke
    // ------------------------------------------------------------    
if (tool === "dachluke") {
    this.mode = "dachluke";
    this.currentDoorType = "dachluke";
    this._placingDoor = false;
    return;
}


    
    // ------------------------------------------------------------
    // ⭐ Türmodus aktivieren
    // ------------------------------------------------------------
    if (tool === "door") {

        // Türtyp setzen
        this.currentDoorType = subtype || "default";

        // Modus aktivieren
        this.mode = "doors";

        // Platzierungszustand zurücksetzen
        this._placingDoor = false;

        console.log("[RoomDesigner] setTool: DOOR-MODE aktiviert →", subtype);
        return;
    }




    
    // ------------------------------------------------------------
    // ⭐ Fenster-Modus aktivieren
    // ------------------------------------------------------------
    if (tool === "window") {
        this.mode = "windows";
        this._placingWindow = false;
        console.log("[RoomDesigner] setTool: WINDOW-MODE aktiviert");
        return;
    }

    // ------------------------------------------------------------
    // ⭐ Standard-Tools
    // ------------------------------------------------------------
    this.mode = "points";
    console.log("[RoomDesigner] setTool:", tool, "subtype:", subtype);
},



    // Element-Typ setzen (z.B. "wall", "door-single", "window-standard", "smart-box")
    setElement(elementKey) {
        this.currentElement = elementKey;
        console.log("[RoomDesigner] setElement:", elementKey);
    },

    // SmartDevice einem virtuellen Behälter zuweisen
    assignSmartDevice(deviceId) {
        console.log("[RoomDesigner] assignSmartDevice:", deviceId);
        // Hier später: Zuordnung zu einer Box im Canvas
        // Aktuell nur Debug-Log
        this.debugLog.push({ type: "assignDevice", deviceId, time: Date.now() });
    },

    // Hilfsfunktionen für Szenen/Programme/User-Store
    _getSceneStore() {
        if (window.SmartHomeData && Array.isArray(SmartHomeData.scenes)) {
            return SmartHomeData.scenes;
        }
        return this.scenes;
    },

    _getProgramStore() {
        if (window.SmartHomeData && Array.isArray(SmartHomeData.programs)) {
            return SmartHomeData.programs;
        }
        return this.programs;
    },

    _getUserStore() {
        if (window.SmartHomeData && Array.isArray(SmartHomeData.users)) {
            return SmartHomeData.users;
        }
        return this.users;
    },

    // --------------------------------------------------
    // ⭐ NEU: Türtyp-Logik (Schritt B)
    // --------------------------------------------------
    getDoorProperties(type) {
        switch (type) {
            case "schiebetuer": return { hasArc:false, color:"#fff", width:36, free:false };
            case "falttuer": return { hasArc:false, color:"#fff", width:36, free:false };
            case "terrassentuer": return { hasArc:true, color:"rgba(0,150,255,0.5)", width:36, free:false };
            case "garagentor": return { hasArc:false, color:"#ccc", width:120, free:false };
            case "gartentoerchen": return { hasArc:true, color:"#88cc88", width:28, free:false };
            case "dachluke": return { hasArc:false, color:"#fff", width:36, free:true };
            case "haustuer":
            case "zimmertuer":
            default: return { hasArc:true, color:"#fff", width:36, free:false };
        }
    },

    // --------------------------------------------------
    // Szenen
    // --------------------------------------------------
    addScene() {
        const store = this._getSceneStore();
        const name = prompt("Name der neuen Szene:");
        if (!name) return;

        const id = "scene-" + Date.now();
        store.push({ id, name });

        console.log("[RoomDesigner] Szene hinzugefügt:", id, name);
        this.debugLog.push({ type: "addScene", id, name, time: Date.now() });
    },

    editScene(id) {
        const store = this._getSceneStore();
        const scene = store.find(s => s.id === id);
        if (!scene) {
            alert("Szene nicht gefunden.");
            return;
        }

        const name = prompt("Neuer Name für Szene:", scene.name);
        if (!name) return;

        scene.name = name;
        console.log("[RoomDesigner] Szene bearbeitet:", id, name);
        this.debugLog.push({ type: "editScene", id, name, time: Date.now() });
    },

    deleteScene(id) {
        const store = this._getSceneStore();
        const idx = store.findIndex(s => s.id === id);
        if (idx === -1) {
            alert("Szene nicht gefunden.");
            return;
        }

        if (!confirm("Szene wirklich löschen?")) return;

        const removed = store.splice(idx, 1)[0];
        console.log("[RoomDesigner] Szene gelöscht:", removed);
        this.debugLog.push({ type: "deleteScene", id, time: Date.now() });
    },

    // --------------------------------------------------
    // Zeitprogramme
    // --------------------------------------------------
    addProgram() {
        const store = this._getProgramStore();
        const name = prompt("Name des neuen Zeitprogramms:");
        if (!name) return;

        const id = "program-" + Date.now();
        store.push({ id, name });

        console.log("[RoomDesigner] Zeitprogramm hinzugefügt:", id, name);
        this.debugLog.push({ type: "addProgram", id, name, time: Date.now() });
    },

    editProgram(id) {
        const store = this._getProgramStore();
        const program = store.find(p => p.id === id);
        if (!program) {
            alert("Zeitprogramm nicht gefunden.");
            return;
        }

        const name = prompt("Neuer Name für Zeitprogramm:", program.name);
        if (!name) return;

        program.name = name;
        console.log("[RoomDesigner] Zeitprogramm bearbeitet:", id, name);
        this.debugLog.push({ type: "editProgram", id, name, time: Date.now() });
    },

    deleteProgram(id) {
        const store = this._getProgramStore();
        const idx = store.findIndex(p => p.id === id);
        if (idx === -1) {
            alert("Zeitprogramm nicht gefunden.");
            return;
        }

        if (!confirm("Zeitprogramm wirklich löschen?")) return;

        const removed = store.splice(idx, 1)[0];
        console.log("[RoomDesigner] Zeitprogramm gelöscht:", removed);
        this.debugLog.push({ type: "deleteProgram", id, time: Date.now() });
    },

    // --------------------------------------------------
    // Export / Import
    // --------------------------------------------------
    _exportToClipboard(label, data) {
        const json = JSON.stringify(data, null, 2);
        console.log(`[RoomDesigner] Export ${label}:`, json);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(() => {
                alert(label + " wurde in die Zwischenablage kopiert.");
            }).catch(() => {
                alert(label + " konnte nicht in die Zwischenablage kopiert werden. Siehe Konsole.");
            });
        } else {
            alert(label + " siehe Konsole (Clipboard nicht verfügbar).");
        }
    },

    exportObject() {
        const data = {
            points: this.points,
            doors: this.doors,
            windows: this.windows
        };
        this._exportToClipboard("Objekt", data);
    },

    importObject() {
        const json = prompt("JSON für Objekt einfügen:");
        if (!json) return;

        try {
            const data = JSON.parse(json);
            this.points = Array.isArray(data.points) ? data.points : [];
            this.doors = Array.isArray(data.doors) ? data.doors : [];
            this.windows = Array.isArray(data.windows) ? data.windows : [];
            this.updateWalls();
            this.render();
            alert("Objekt importiert.");
        } catch (e) {
            alert("Fehler beim Import: " + e.message);
        }
    },

    exportRoom() {
        // aktuell identisch zu Objekt
        this.exportObject();
    },

    importRoom() {
        // aktuell identisch zu Objekt
        this.importObject();
    },

    exportScenes() {
        const store = this._getSceneStore();
        this._exportToClipboard("Szenen", store);
    },

    importScenes() {
        const json = prompt("JSON für Szenen einfügen:");
        if (!json) return;

        try {
            const data = JSON.parse(json);
            const store = this._getSceneStore();
            if (Array.isArray(data)) {
                store.length = 0;
                data.forEach(s => store.push(s));
                alert("Szenen importiert.");
            } else {
                alert("Ungültiges Format (erwartet Array).");
            }
        } catch (e) {
            alert("Fehler beim Import: " + e.message);
        }
    },

    exportPrograms() {
        const store = this._getProgramStore();
        this._exportToClipboard("Zeitprogramme", store);
    },

    importPrograms() {
        const json = prompt("JSON für Zeitprogramme einfügen:");
        if (!json) return;

        try {
            const data = JSON.parse(json);
            const store = this._getProgramStore();
            if (Array.isArray(data)) {
                store.length = 0;
                data.forEach(p => store.push(p));
                alert("Zeitprogramme importiert.");
            } else {
                alert("Ungültiges Format (erwartet Array).");
            }
        } catch (e) {
            alert("Fehler beim Import: " + e.message);
        }
    },

    // ------------------------------------------------------------
// Editor <-> Projekt Mapping
// ------------------------------------------------------------

// Editor → Projekt
exportFromEditor() {

    if (!activeRoomId) return;

    // Raum erzeugen falls nicht vorhanden
    if (!project.rooms[activeRoomId]) {

        // ⭐ floorId korrekt setzen
        const defaultFloorId = Object.keys(project.floors)[0] || "floor_0";

        project.rooms[activeRoomId] = createRoomModel(
            activeRoomId,
            "Raum",
            defaultFloorId
        );

        // Raum in Etage eintragen
        if (!project.floors[defaultFloorId].rooms.includes(activeRoomId)) {
            project.floors[defaultFloorId].rooms.push(activeRoomId);
        }
    }

    const room = project.rooms[activeRoomId];

    // ⭐ Raumname speichern
    const el = document.getElementById("editor-room-name");
    if (el) {
        room.name = el.textContent.trim();
    }

    // ⭐ Etagenname speichern
    const floorEl = document.getElementById("editor-floor-name");
    if (floorEl) {
        const floor = project.floors?.[room.floorId];
        if (floor) {
            floor.name = floorEl.textContent.trim();
        }
    }

    // Punkte
    room.points = RoomDesigner.points.map(p => ({ x: p.x, y: p.y }));
    room.isClosed = RoomDesigner.isClosed;

    // Türen
    // 1. Alle Türen des aktuellen Raums aus project.doors entfernen
    for (const id of room.doors) {
        delete project.doors[id];
    }
    
    // 2. Neue Türen des aktuellen Raums eintragen
    room.doors = [];
    
    for (const d of this.doors) {
        if (!d.id) d.id = createId("door");
    
        project.doors[d.id] = { ...d };
        room.doors.push(d.id);
    }


    // Fenster
    // 1. Alte Fenster dieses Raums aus project.windows entfernen
    for (const id of room.windows) {
        delete project.windows[id];
    }
    
    // 2. Neue Fenster eintragen
    room.windows = [];
    
    for (const w of RoomDesigner.windows) {
        if (!w.id) w.id = createId("window");
    
        project.windows[w.id] = { ...w };
        room.windows.push(w.id);
    }


    project.meta.modified = Date.now();
},

    // --------------------------------------------------
    // Sync
    // --------------------------------------------------
    syncNow() {
        console.log("[RoomDesigner] syncNow() aufgerufen.");
        alert("Sync angestoßen (Stub).");
        this.debugLog.push({ type: "syncNow", time: Date.now() });
    },

    // --------------------------------------------------
    // Benutzerverwaltung
    // --------------------------------------------------
    addUser() {
        const store = this._getUserStore();
        const name = prompt("Name des neuen Benutzers:");
        if (!name) return;

        const id = "user-" + Date.now();
        store.push({ id, name });

        console.log("[RoomDesigner] Benutzer hinzugefügt:", id, name);
        this.debugLog.push({ type: "addUser", id, name, time: Date.now() });
    },

    editUser() {
        const store = this._getUserStore();
        if (!store.length) {
            alert("Keine Benutzer vorhanden.");
            return;
        }

        const id = prompt("ID des Benutzers zum Bearbeiten:", store[0].id);
        if (!id) return;

        const user = store.find(u => u.id === id);
        if (!user) {
            alert("Benutzer nicht gefunden.");
            return;
        }

        const name = prompt("Neuer Name:", user.name);
        if (!name) return;

        user.name = name;
        console.log("[RoomDesigner] Benutzer bearbeitet:", id, name);
        this.debugLog.push({ type: "editUser", id, name, time: Date.now() });
    },

    deleteUser() {
        const store = this._getUserStore();
        if (!store.length) {
            alert("Keine Benutzer vorhanden.");
            return;
        }

        const id = prompt("ID des Benutzers zum Löschen:", store[0].id);
        if (!id) return;

        const idx = store.findIndex(u => u.id === id);
        if (idx === -1) {
            alert("Benutzer nicht gefunden.");
            return;
        }

        if (!confirm("Benutzer wirklich löschen?")) return;

        const removed = store.splice(idx, 1)[0];
        console.log("[RoomDesigner] Benutzer gelöscht:", removed);
        this.debugLog.push({ type: "deleteUser", id, time: Date.now() });
    },

    setUserPin() {
        const store = this._getUserStore();
        if (!store.length) {
            alert("Keine Benutzer vorhanden.");
            return;
        }

        const id = prompt("ID des Benutzers:", store[0].id);
        if (!id) return;

        const user = store.find(u => u.id === id);
        if (!user) {
            alert("Benutzer nicht gefunden.");
            return;
        }

        const pin = prompt("Neue PIN / Passwort:");
        if (!pin) return;

        user.pin = pin;
        console.log("[RoomDesigner] PIN gesetzt für:", id);
        this.debugLog.push({ type: "setUserPin", id, time: Date.now() });
    },

    // --------------------------------------------------
    // Backup / Restore
    // --------------------------------------------------
    backup() {
        const data = {
            points: this.points,
            doors: this.doors,
            windows: this.windows,
            scenes: this._getSceneStore(),
            programs: this._getProgramStore()
        };
        this._exportToClipboard("Backup", data);
    },

    restore() {
        const json = prompt("Backup-JSON einfügen:");
        if (!json) return;

        try {
            const data = JSON.parse(json);
            if (data.points) this.points = data.points;
            if (data.doors) this.doors = data.doors;
            if (data.windows) this.windows = data.windows;

            const sceneStore = this._getSceneStore();
            if (Array.isArray(data.scenes)) {
                sceneStore.length = 0;
                data.scenes.forEach(s => sceneStore.push(s));
            }

            const programStore = this._getProgramStore();
            if (Array.isArray(data.programs)) {
                programStore.length = 0;
                data.programs.forEach(p => programStore.push(p));
            }

            this.updateWalls();
            this.render();
            alert("Backup wiederhergestellt.");
        } catch (e) {
            alert("Fehler beim Restore: " + e.message);
        }
    },

    // --------------------------------------------------
    // Debug / Tools
    // --------------------------------------------------
    showDebugLog() {
        console.log("[RoomDesigner] DebugLog:", this.debugLog);
        alert("Debug-Log in der Konsole angezeigt.");
    },

    clearDebugLog() {
        this.debugLog = [];
        alert("Debug-Log gelöscht.");
    },

    profilePerformance() {
        console.log("[RoomDesigner] Performance-Profiling (Stub).");
        alert("Performance-Profiling Stub – hier könnte später ein echtes Profiling laufen.");
    }
}; // Ende RoomDesigner

RoomDesigner.loadRoom = function(roomId) {
    const room = project.rooms?.[roomId];

    if (!room) {
        console.warn("[RoomDesigner.loadRoom] Raum nicht gefunden:", roomId);

        activeRoomId = null;

        RoomDesigner.points = [];
        RoomDesigner.doors = [];
        RoomDesigner.windows = [];
        RoomDesigner.isClosed = false;

        RoomDesigner.updateWalls();
        RoomDesigner.render();
        return;
    }

    RoomDesigner.points = Array.isArray(room.points)
        ? room.points.map(p => ({ x: p.x, y: p.y }))
        : [];

    RoomDesigner.doors = Array.isArray(room.doors)
        ? room.doors
            .map(id => project.doors?.[id])
            .filter(Boolean)
            .map(d => ({ ...d }))
        : [];

    RoomDesigner.windows = Array.isArray(room.windows)
        ? room.windows
            .map(id => project.windows?.[id])
            .filter(Boolean)
            .map(w => ({ ...w }))
        : [];

    RoomDesigner.isClosed = !!room.isClosed;

    RoomDesigner.updateWalls();
    RoomDesigner.render();
};

// --------------------------------------------------
// Editor öffnen
// --------------------------------------------------
function getActiveRoom() {
    if (!activeRoomId) return null;
    return project.rooms?.[activeRoomId] || null;
}


function setActiveRoom(roomId) {
    if (!roomId) return;
    if (!project.rooms[roomId]) return;

    // Wenn der Raum schon aktiv ist → nichts tun
    if (activeRoomId === roomId) return;

    activeRoomId = roomId;

    // Titel aktualisieren
    updateEditorTitle();

    // Canvas neu laden
    RoomDesigner.points = (project.rooms[roomId].points || []).map(p => ({ x: p.x, y: p.y }));
    RoomDesigner.isClosed = project.rooms[roomId].isClosed || false;

    RoomDesigner.updateWalls();
    RoomDesigner.render();
}



// Ganz oben in der Datei oder zumindest außerhalb des Click-Handlers:
function updateEditorTitle() {
    const proj = document.getElementById("editor-project-name");
    const floor = document.getElementById("editor-floor-name");
    const room = document.getElementById("editor-room-name");

    if (proj) proj.textContent = project.meta.name || "Projekt";

    const projSidebar = document.getElementById("editor-project-name-sidebar");
    if (projSidebar) projSidebar.textContent = project.meta.name || "Projekt";

    // Etage
    if (floor) {
        if (activeFloorId && project.floors[activeFloorId]) {
            floor.textContent = project.floors[activeFloorId].name;
        } else {
            floor.textContent = "Etage";
        }
    }

    // Raum
    const roomObj = activeRoomId ? project.rooms[activeRoomId] : null;
    if (room) {
        room.textContent = roomObj ? (roomObj.name || "Raum") : "";
    }
}




// ---------------------------------------------------------
// Neue Etage erstellen
// ---------------------------------------------------------
function editorCreateFloor() {
    const existingIds = Object.keys(project.floors || {})
        .map(id => Number(id))
        .filter(n => Number.isFinite(n) && n > 0);

    const max = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newFloorId = max + 1;

    project.floors[newFloorId] = {
        id: newFloorId,
        name: `${newFloorId}. Obergeschoss`,
        rooms: []
    };

    const newRoomId = `raum_${newFloorId}_1`;

    project.rooms[newRoomId] = {
        id: newRoomId,
        name: `Neuer Raum ${newFloorId}`,
        floorId: newFloorId,
        points: [
            { x: 100, y: 100 },
            { x: 300, y: 100 },
            { x: 300, y: 300 },
            { x: 100, y: 300 }
        ],
        doors: [],
        windows: [],
        isClosed: false
    };

    project.floors[newFloorId].rooms.push(newRoomId);
    activeRoomId = newRoomId;

    importToEditor();
    saveProject();

    // ⭐ FIX: SmartHomeData + Sidebar + Titelzeile sofort aktualisieren
    SmartHomeData = generateSmartHomeDataFromProject();
    renderEditorProjectSidebar();
    updateEditorTitle();
}





// ---------------------------------------------------------
// Etage löschen
// ---------------------------------------------------------
function editorDeleteFloor(floorId) {
    // Sicherheitsabfrage
    if (!confirm("Diese Etage und alle Räume darauf löschen?")) return;

    floorId = Number(floorId);

    const floor = project.floors[floorId];
    if (!floor) return;

    // 1) Alle Räume dieser Etage löschen
    (floor.rooms || []).forEach(roomId => {
        delete project.rooms[roomId];
    });

    // 2) Floor aus dem Projekt löschen
    delete project.floors[floorId];

    // 3) Editor-State korrigieren
    if (project.rooms[activeRoomId]?.floorId === floorId) {
        const remainingRooms = Object.values(project.rooms);
        activeRoomId = remainingRooms.length > 0 ? remainingRooms[0].id : null;
    }

    // 4) Editor-Daten + UI aktualisieren
    if (activeRoomId) {
        importToEditor();            // lädt neuen aktiven Raum
    } else {
        // Kein Raum mehr vorhanden
        const projectEl = document.getElementById("editor-project-name");
        const floorEl = document.getElementById("editor-floor-name");
        const roomEl = document.getElementById("editor-room-name");

        if (projectEl) projectEl.textContent = project.meta?.name || "Projekt";
        if (floorEl) floorEl.textContent = "Etage";
        if (roomEl) roomEl.textContent = "Raum";

        RoomDesigner.clearCanvas();
    }

    renderEditorProjectSidebar();
    saveProject();
}





function enableRoomNameEditing() {
    const el = document.getElementById("editor-room-name");
    if (!el) return;

    el.addEventListener("click", () => {
        // Bereits im Edit-Modus?
        if (el.contentEditable === "true") return;

        el.contentEditable = "true";
        el.classList.add("editing");
        el.focus();

        // Cursor ans Ende setzen
        document.execCommand("selectAll", false, null);
        document.getSelection().collapseToEnd();
    });

    el.addEventListener("blur", () => {
        finishRoomNameEdit(el);
    });

    el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            ev.preventDefault();
            el.blur();
        }
        if (ev.key === "Escape") {
            ev.preventDefault();
            el.textContent = project.rooms["room_main"].name || "Raum";
            el.blur();
        }
    });
}

function enableFloorNameEditing() {
    const el = document.getElementById("editor-floor-name");
    if (!el) return;

    el.addEventListener("click", () => {
        if (el.contentEditable === "true") return;

        el.contentEditable = "true";
        el.classList.add("editing");
        el.focus();

        document.execCommand("selectAll", false, null);
        document.getSelection().collapseToEnd();
    });

    el.addEventListener("blur", () => {
        finishFloorNameEdit(el);
    });

    el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            ev.preventDefault();
            el.blur();
        }
        if (ev.key === "Escape") {
            ev.preventDefault();

            const room = project.rooms[activeRoomId];
            const floor = project.floors[room.floorId];

            el.textContent = floor?.name || "Etage";
            el.blur();
        }
    });
}



function enableProjectNameEditing() {
    const el = document.getElementById("editor-project-name");
    if (!el) return;

    el.addEventListener("click", () => {
        if (el.contentEditable === "true") return;

        el.contentEditable = "true";
        el.classList.add("editing");
        el.focus();

        document.execCommand("selectAll", false, null);
        document.getSelection().collapseToEnd();
    });

    el.addEventListener("blur", () => {
        finishProjectNameEdit(el);
    });

    el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            ev.preventDefault();
            el.blur();
        }
        if (ev.key === "Escape") {
            ev.preventDefault();
            el.textContent = project.meta.name || "Projekt";
            el.blur();
        }
    });
}

function renderFloorList() {
    const container = document.getElementById("floor-list");
    if (!container) return;

    container.innerHTML = "";

    if (!SmartHomeData?.floors) return;

    SmartHomeData.floors.forEach(floor => {
        const div = document.createElement("div");
        div.textContent = floor.name;
        div.classList.add("floor-item");

        if (SmartHomeData.structure.activeFloor === floor.id) {
            div.classList.add("active");
        }

        div.addEventListener("click", () => {
            SmartHomeData.structure.activeFloor = floor.id;
            renderFloorList();
            renderRoomList();
            updateEditorTitle();
        });

        container.appendChild(div);
    });
}

function renderRoomList() {
    const container = document.getElementById("room-list");
    if (!container) return;

    container.innerHTML = "";

    const activeFloor = SmartHomeData.structure.activeFloor;
    if (!activeFloor) return;

    const rooms = SmartHomeData.rooms.filter(r => r.floor === activeFloor);

    rooms.forEach(room => {
        const div = document.createElement("div");
        div.textContent = room.name;
        div.classList.add("room-item");

        if (SmartHomeData.structure.activeRoom === room.id) {
            div.classList.add("active");
        }

        div.addEventListener("click", () => {
            SmartHomeData.structure.activeRoom = room.id;
            updateEditorTitle();
            renderRoomList();
        });

        container.appendChild(div);
    });
}




function finishProjectNameEdit(el) {
    el.contentEditable = "false";
    el.classList.remove("editing");

    if (!project.meta) {
        project.meta = {};
    }

    const newName = el.textContent.trim();

    // Leerer Name → alten Namen wiederherstellen
    if (!newName) {
        el.textContent = project.meta.name || "Projekt";
        return;
    }

    // 1) Projektnamen speichern
    project.meta.name = newName;

    // 2) Titelzeile aktualisieren
    updateEditorTitle();

    // 3) Sidebar aktualisieren (falls sie Projektnamen zeigt)
    renderEditorProjectSidebar();

    // 4) Projekt speichern
    saveProject();
}


function finishFloorNameEdit(el) {
    el.contentEditable = "false";
    el.classList.remove("editing");

    // Aktiven Raum bestimmen
    if (!activeRoomId || !project.rooms[activeRoomId]) {
        console.warn("finishFloorNameEdit(): Kein aktiver Raum");
        return;
    }

    const room = project.rooms[activeRoomId];
    const floorId = room.floorId;

    if (!project.floors[floorId]) {
        console.warn("finishFloorNameEdit(): Etage existiert nicht:", floorId);
        return;
    }

    const newName = el.textContent.trim();

    // Leerer Name → alten Namen wiederherstellen
    if (!newName) {
        el.textContent = project.floors[floorId].name || "Etage";
        return;
    }

    // 1) Etagenname im Projekt speichern
    project.floors[floorId].name = newName;

    // 2) Titelzeile aktualisieren
    updateEditorTitle();

    // 3) Sidebar aktualisieren
    renderEditorProjectSidebar();

    // 4) Projekt speichern
    saveProject();
}




function finishRoomNameEdit(el) {
    el.contentEditable = "false";
    el.classList.remove("editing");

    // Aktiven Raum bestimmen
    if (!activeRoomId || !project.rooms[activeRoomId]) {
        console.warn("Kein aktiver Raum für finishRoomNameEdit()");
        return;
    }

    const newName = el.textContent.trim();

    // Leerer Name → alten Namen wiederherstellen
    if (!newName) {
        el.textContent = project.rooms[activeRoomId].name || "Raum";
        return;
    }

    // 1) Namen im Projekt speichern
    project.rooms[activeRoomId].name = newName;

    // 2) Titelzeile aktualisieren
    updateEditorTitle();

    // 3) Sidebar aktualisieren
    renderEditorProjectSidebar();

    // 4) Projekt speichern
    saveProject();
}


function renderEditorProjectSidebar() {
    const container = document.getElementById("editor-location-list");
    if (!container) return;

    container.innerHTML = "";

    // ---------------------------------------------------------
    // ⭐ Projektname + Menü oben IMMER neu erzeugen
    // ---------------------------------------------------------
    const projectHeader = document.createElement("div");
    projectHeader.className = "project-header";

    const projectNameEl = document.createElement("span");
    projectNameEl.id = "editor-project-name-sidebar";
    projectNameEl.className = "project-name";
    projectNameEl.textContent = project.meta?.name || "Projekt";

    const projectMenuBtn = document.createElement("span");
    projectMenuBtn.className = "project-menu-btn";
    projectMenuBtn.textContent = "⋮";

    projectMenuBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openProjectMenu(ev.pageX, ev.pageY);
    });

    projectHeader.appendChild(projectNameEl);
    projectHeader.appendChild(projectMenuBtn);
    container.appendChild(projectHeader);

    // ---------------------------------------------------------
    // Floors / Rooms
    // ---------------------------------------------------------

    if (!project.ui) project.ui = {};
    if (!project.ui.floorOpen) project.ui.floorOpen = {};

    const activeFloor = activeFloorId;
    const activeRoom = activeRoomId;

    Object.values(project.floors).forEach(floor => {

        const group = document.createElement("div");
        group.className = "floor-group";

        if (project.ui.floorOpen[floor.id]) {
            group.classList.add("open");
        }

        // HEADER (Pfeil + Name links, Menü rechts)
        const floorHeader = document.createElement("div");
        floorHeader.className = "floor-header";

        const leftWrap = document.createElement("div");
        leftWrap.className = "floor-left";

        const arrowEl = document.createElement("span");
        arrowEl.className = "floor-arrow";

        const nameEl = document.createElement("span");
        nameEl.className = "floor-name";
        nameEl.textContent = floor.name;

        leftWrap.appendChild(arrowEl);
        leftWrap.appendChild(nameEl);

        const menuEl = document.createElement("span");
        menuEl.className = "floor-menu";
        menuEl.textContent = "⋮";

        menuEl.addEventListener("click", (ev) => {
            ev.stopPropagation();
            openFloorMenu(floor.id, ev);
        });

        floorHeader.appendChild(leftWrap);
        floorHeader.appendChild(menuEl);

        if (floor.id === activeFloor) {
            floorHeader.classList.add("active-floor");
        }

        // Klick-Logik
        leftWrap.addEventListener("click", (ev) => {
            ev.stopPropagation();

            const isActive = (floor.id === activeFloorId);
            const isOpen = !!project.ui.floorOpen[floor.id];

            if (isActive) {
                project.ui.floorOpen[floor.id] = !isOpen;
                renderEditorProjectSidebar();
                return;
            }

            if (!isActive && isOpen) {
                project.ui.floorOpen[floor.id] = false;
                renderEditorProjectSidebar();
                return;
            }

            project.ui.floorOpen[floor.id] = true;

            switchFloor(floor.id);
            importToEditor();

            renderEditorProjectSidebar();
        });

        // ROOM LIST
        const roomList = document.createElement("div");
        roomList.className = "room-list";

        floor.rooms.forEach(roomId => {
            const room = project.rooms[roomId];
            if (!room) return;

            const roomDiv = document.createElement("div");
            roomDiv.className = "room-entry";
            roomDiv.textContent = room.name;

            if (roomId === activeRoom) {
                roomDiv.classList.add("active-room");
            }

            roomDiv.addEventListener("click", (ev) => {
                ev.stopPropagation();
                activeRoomId = roomId;
                importToEditor();
                renderEditorProjectSidebar();
            });

            roomList.appendChild(roomDiv);
        });

        group.appendChild(floorHeader);
        group.appendChild(roomList);
        container.appendChild(group);
    });
}


function openFloorMenu(floorId, clickEvent) {
    const menu = document.getElementById("context-menu");
    if (!menu) return;

    // Menüinhalt erzeugen
    menu.innerHTML = `
        <div class="context-menu-item" data-action="rename">Etage umbenennen</div>
        <div class="context-menu-item" data-action="add-room">Raum hinzufügen</div>
        <div class="context-menu-item" data-action="duplicate">Etage duplizieren</div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="delete" style="color:#ff6666;">Etage löschen</div>
    `;

    // ⭐ Position SOFORT beim Klick setzen (kein Hüpfen mehr)
    menu.style.left = (clickEvent.pageX + 4) + "px";
    menu.style.top = (clickEvent.pageY + 4) + "px";

    // Menü anzeigen
    menu.classList.remove("hidden");
    menu.classList.add("visible");

    // Klick-Handler für Menüeinträge
    menu.querySelectorAll(".context-menu-item").forEach(item => {
        item.addEventListener("click", () => {
            const action = item.dataset.action;
            handleFloorMenuAction(floorId, action);
            closeContextMenu();
        });
    });
}


function closeContextMenu() {
    const menu = document.getElementById("context-menu");
    if (!menu) return;

    menu.classList.add("hidden");
    menu.classList.remove("visible");
}

document.addEventListener("click", (ev) => {
    const menu = document.getElementById("context-menu");
    if (!menu) return;

    if (!ev.target.closest("#context-menu")) {
        closeContextMenu();
    }
});


function handleFloorMenuAction(floorId, action) {
    switch (action) {
        case "rename":
            startFloorRename(floorId);
            break;

        case "add-room":
            console.log("Raum hinzufügen:", floorId);
            break;

        case "duplicate":
            console.log("Etage duplizieren:", floorId);
            break;

        case "delete":
            console.log("Etage löschen:", floorId);
            break;
    }
}

function startFloorRename(floorId) {
    const container = document.getElementById("editor-location-list");
    if (!container) return;

    const group = [...container.querySelectorAll(".floor-group")]
        .find(g => g.querySelector(".floor-name")?.textContent === project.floors[floorId].name);

    if (!group) return;

    const nameEl = group.querySelector(".floor-name");
    if (!nameEl) return;

    const oldName = project.floors[floorId].name;

    const input = document.createElement("input");
    input.type = "text";
    input.value = oldName;
    input.className = "floor-rename-input";

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
            ev.preventDefault();
            finishFloorRename(floorId, input.value.trim());
        }
        if (ev.key === "Escape") {
            ev.preventDefault();
            finishFloorRename(floorId, oldName);
        }
    });

    input.addEventListener("blur", () => {
        finishFloorRename(floorId, input.value.trim());
    });
}

function finishFloorRename(floorId, newName) {
    if (!newName) {
        renderEditorProjectSidebar();
        return;
    }

    project.floors[floorId].name = newName;

    // Titelbar aktualisieren
    updateEditorTitle();

    // Sidebar neu rendern
    renderEditorProjectSidebar();

    // Projekt speichern
    if (typeof saveProject === "function") {
        saveProject();
    }
}


function renderLeftSidebar() {
    const sidebar = document.getElementById("left-sidebar");
    if (!sidebar) return;

    sidebar.innerHTML = "";

    const floors = Object.values(project.floors);

    floors.forEach(floor => {
        const floorDiv = document.createElement("div");
        floorDiv.className = "sidebar-floor";
        floorDiv.textContent = floor.name;
        sidebar.appendChild(floorDiv);

        floor.rooms.forEach(roomId => {
            const room = project.rooms[roomId];
            if (!room) return;

            const roomDiv = document.createElement("div");
            roomDiv.className = "sidebar-room";
            roomDiv.textContent = room.name;

            roomDiv.addEventListener("click", () => {
                activeRoomId = roomId;
                importToEditor();
            });

            sidebar.appendChild(roomDiv);
        });
    });
}




window.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("btnOpenEditor");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {

        document.body.classList.add("editor-mode");

        const root = document.getElementById("smarthome-root");
        const header = document.getElementById("sh-group-header");
        const minimap = document.getElementById("smarthome-minimap");
        const floorList = document.getElementById("sh-floor-list");

        if (root) root.style.display = "none";
        if (header) header.style.display = "none";
        if (minimap) minimap.style.display = "none";
        if (floorList) floorList.style.display = "none";

        const layout = document.getElementById("editor-layout");
        if (layout) layout.style.display = "block";

        const canvas = document.getElementById("roomdesigner");
        if (canvas) canvas.style.display = "block";

        const titlebar = document.getElementById("editor-titlebar");
        if (titlebar) titlebar.style.display = "flex";

        const sidebar = document.getElementById("editor-sidebar");
        if (sidebar) sidebar.style.display = "flex";

        // ⭐ Editor initialisieren (lädt NICHT das Projekt!)
        RoomDesigner.init();

        // ⭐ Projekt-Daten in den Editor importieren
        importToEditor();

        // ⭐ Titel aktualisieren
        updateEditorTitle();

        // ⭐ Sidebar aufbauen
        renderEditorProjectSidebar();

        // ⭐ Editor-Funktionen aktivieren
        enableRoomNameEditing();
        enableFloorNameEditing();
        enableProjectNameEditing();
        attachFloorCrumbMenu();
    });
});





// ===============================
// Editor schließen
// ===============================
document.getElementById("editor-close-btn")?.addEventListener("click", () => {

    // Editor-Modus deaktivieren (WICHTIG!)
    document.body.classList.remove("editor-mode");

    // Editor-Layout komplett ausblenden
    const layout = document.getElementById("editor-layout");
    if (layout) layout.style.display = "none";

    // Titelbar ausblenden
    const titlebar = document.getElementById("editor-titlebar");
    if (titlebar) titlebar.style.display = "none";

    // Rechte Sidebar ausblenden
    const sidebar = document.getElementById("editor-sidebar");
    if (sidebar) sidebar.style.display = "none";

    // Editor-Canvas ausblenden
    const canvas = document.getElementById("roomdesigner");
    if (canvas) canvas.style.display = "none";

    // Editor-spezifische Buttons ausblenden
    const doorBtn = document.getElementById("btnDoorMode");
    const winBtn = document.getElementById("btnWindowMode");
    if (doorBtn) doorBtn.style.display = "none";
    if (winBtn) winBtn.style.display = "none";

    // SmartHome-UI wieder einblenden
    const root = document.getElementById("smarthome-root");
    const header = document.getElementById("sh-group-header");
    const minimap = document.getElementById("smarthome-minimap");
    const floorList = document.getElementById("sh-floor-list");

    if (root) root.style.display = "block";
    if (header) header.style.display = "flex";
    if (minimap) minimap.style.display = "block";
    if (floorList) floorList.style.display = "block";
});


    
    // ===============================
    // Sidebar Tabs umschalten
    // ===============================
    document.querySelectorAll("#editor-sidebar-tabs button").forEach(btn => {
        btn.addEventListener("click", () => {
    
            // Aktiven Tab markieren
            document.querySelectorAll("#editor-sidebar-tabs button")
                .forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
    
            const target = btn.getAttribute("data-tab");
    
            // Panels umschalten
            document.querySelectorAll(".sidebar-panel").forEach(panel => {
                if (panel.getAttribute("data-panel") === target) {
                    panel.style.display = "block";
                } else {
                    panel.style.display = "none";
                }
            });
        });
    });

// ------------------------------------------------------------
// ⭐ Dachluke separat behandeln (NICHT als Tür!)
// ------------------------------------------------------------
document.querySelectorAll(".item[data-type='dachluke']").forEach(item => {
    item.addEventListener("click", () => {

        // aktive Markierung setzen
        document.querySelectorAll(".item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");

        // Dachluke aktivieren
        RoomDesigner.setTool("dachluke");
    });
});




    // ===============================
    // Tools aus der Sidebar aktivieren
    // ===============================
    document.querySelectorAll(".tool-button").forEach(btn => {
        btn.addEventListener("click", () => {
    
            // Aktiven Button markieren
            document.querySelectorAll(".tool-button")
                .forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
    
            const tool = btn.getAttribute("data-tool");
    
            // Tool an RoomDesigner übergeben
            if (RoomDesigner && typeof RoomDesigner.setTool === "function") {
                RoomDesigner.setTool(tool);
            }
        });
    });
