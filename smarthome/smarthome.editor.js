// ======================================================
// Raumdesigner – vollständige, fehlerfreie Version
// ======================================================

const RoomDesigner = {
    canvas: null,
    ctx: null,

    points: [],
    walls: [],
    doors: [],
    windows: [],

    hover: { x: 0, y: 0 },

    selectedPoint: null,
    selectedDoorIndex: null,
    selectedWindowIndex: null,

    isDragging: false,
    _initialized: false,

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
    // Initialisierung
    // --------------------------------------------------
    init() {
        if (this._initialized) return;
        this._initialized = true;

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
        this.setupDoorButton();
        this.setupWindowButton();
        this.createContextMenu();
        this.setupSnapButton();
        this.setupGridSlider();
        this.setupResetButton();



        this.resize();
        this.render();
    },

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

if (type === "point") {
    this.addContextButton("🗑", () => {

        // 1. Betroffene Wände bestimmen
        const prevWall = index - 1;
        const nextWall = index;

        // 2. Türen/Fenster merken, die auf diesen Wänden liegen
        const affectedDoors = this.doors.filter(d => d.wallIndex === prevWall || d.wallIndex === nextWall);
        const affectedWindows = this.windows.filter(w => w.wallIndex === prevWall || w.wallIndex === nextWall);

        // 3. Punkt löschen
        const p = this.points[index];
        this.points = this.points.filter(pt => pt !== p);
        if (this.points.length < 3) this.isClosed = false;

        // 4. Wände neu berechnen
        this.updateWalls();

        // 5. Neue Wand ist jetzt prevWall
        const newWallIndex = prevWall;

        // 6. Türen neu projizieren
        for (const d of affectedDoors) {
            const w = this.walls[newWallIndex];
            if (!w) continue;

            const proj = this.projectOnWall(d.x, d.y, w);

            d.wallIndex = newWallIndex;
            d.t = proj.t;
            d.x = proj.x;
            d.y = proj.y;
        }

        // 7. Fenster neu projizieren
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
    }, true);
}



if (type === "door" || type === "window") {
    const arr = type === "door" ? this.doors : this.windows;

    // PLUS → Menü bleibt offen
    this.addContextButton("＋", () => {
        arr[index].width += 10;
        this.updateWalls();
        this.render();
    }, false);

    // MINUS → Menü bleibt offen
    this.addContextButton("－", () => {
        arr[index].width = Math.max(20, arr[index].width - 10);
        this.updateWalls();
        this.render();
    }, false);

    // DELETE → Menü schließt sich
    this.addContextButton("🗑", () => {
        arr.splice(index, 1);
        this.updateWalls();
        this.render();
    }, true);
}


menu.style.display = "flex";

const rect = menu.getBoundingClientRect();
const offset = 20;

// Standard: rechts unten neben dem Objekt
let left = x + offset;
let top = y + offset;

// Falls rechts kein Platz → links
if (left + rect.width > window.innerWidth) {
    left = x - rect.width - offset;
}

// Falls unten kein Platz → oben
if (top + rect.height > window.innerHeight) {
    top = y - rect.height - offset;
}

// Falls links immer noch außerhalb → rechts erzwingen
if (left < 0) {
    left = x + offset;
}

// Falls oben immer noch außerhalb → unten erzwingen
if (top < 0) {
    top = y + offset;
}

menu.style.left = left + "px";
menu.style.top = top + "px";

    },

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
            return;
        }

        // DELETE → Menü schließen
        this._closingByButton = true;
        fn && fn();
        this.hideContextMenu();
        this._closingByButton = false;
    });

    this.contextMenuEl.appendChild(btn);
},

    // --------------------------------------------------
    // Eingaben
    // --------------------------------------------------
onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX / this.zoom) - this.offsetX;
    const worldY = (mouseY / this.zoom) - this.offsetY;

    let hx = mouseX;
    let hy = mouseY;

    // Snap auf ersten Punkt (nur wenn offen)
    if (!this.isClosed && this.points.length > 0) {
        const first = this.points[0];
        if (Math.hypot(worldX - first.x, worldY - first.y) < 20) {
            hx = (first.x + this.offsetX) * this.zoom;
            hy = (first.y + this.offsetY) * this.zoom;
        }
    }

    this.hover.x = hx;
    this.hover.y = hy;

    // PAN MOVE
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

    // DRAG: Tür
    if (this.draggingDoorIndex !== null) {
        const d = this.doors[this.draggingDoorIndex];
        const w = this.walls[d.wallIndex];
        if (w) {
            const proj = this.projectOnWall(worldX, worldY, w);
            d.t = proj.t;
            d.x = proj.x;
            d.y = proj.y;
        }
        this.isDragging = true;
        this.render();
        return;
    }

    // DRAG: Fenster
    if (this.draggingWindowIndex !== null) {
        const wObj = this.windows[this.draggingWindowIndex];
        const w = this.walls[wObj.wallIndex];
        if (w) {
            const proj = this.projectOnWall(worldX, worldY, w);
            wObj.t = proj.t;
            wObj.x = proj.x;
            wObj.y = proj.y;
        }
        this.isDragging = true;
        this.render();
        return;
    }

    // DRAG: Punkt
    if (this.selectedPoint) {

        const dx = worldX - this.selectedPoint.x;
        const dy = worldY - this.selectedPoint.y;

        if (Math.hypot(dx, dy) > 2) {

            if (!this.isClosed) {
                const first = this.points[0];
                if (this.selectedPoint !== first &&
                    Math.hypot(worldX - first.x, worldY - first.y) < 20) {

                    this.points[this.points.length - 1] = first;
                    this.isClosed = true;
                    this.updateWalls();
                    this.isDragging = true;
                    this.render();
                    return;
                }
            }

            if (this.snapEnabled) {
                this.selectedPoint.x = this.snap(worldX);
                this.selectedPoint.y = this.snap(worldY);
            } else {
                this.selectedPoint.x = worldX;
                this.selectedPoint.y = worldY;
            }

            this.updateWalls();
            this.isDragging = true;
        }

        this.render();
        return;
    }

    // Klick-Kandidat → Drag?
    if (this._pendingContext) {
        const dx = worldX - this._pendingContext.x;
        const dy = worldY - this._pendingContext.y;

        if (Math.hypot(dx, dy) > 2) {

            if (this._pendingContext.type === "point") {
                this.selectedPoint = this.points[this._pendingContext.index];
            }

            if (this._pendingContext.type === "door") {
                this.draggingDoorIndex = this._pendingContext.index;
            }

            if (this._pendingContext.type === "window") {
                this.draggingWindowIndex = this._pendingContext.index;
            }

            this._pendingContext = null;
            this.isDragging = true;
        }
    }

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

onDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX / this.zoom) - this.offsetX;
    const worldY = (mouseY / this.zoom) - this.offsetY;

    // Rechtsklick → Menü schließen, Klick ignorieren
    if (e.button === 2) {
        this.hideContextMenu();
        return;
    }

    // Hit-Test mit Screen-Koordinaten (hitTest rechnet selbst in Welt um)
    const hit = this.hitTest(mouseX, mouseY);
    const clickingObject =
        hit.type === "point" ||
        hit.type === "door" ||
        hit.type === "window" ||
        hit.type === "wall";

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

    // Raum schließen durch Klick auf ersten Punkt
    if (!this.isClosed && this.points.length >= 2) {
        const first = this.points[0];
        if (Math.hypot(worldX - first.x, worldY - first.y) < 20) {
            this.points.push(first);
            this.isClosed = true;
            this.updateWalls();
            this.render();
            return;
        }
    }

    // Fenster-Modus
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
        }

        this.mode = "points";
        return;
    }

    // Tür-Modus
    if (this.mode === "doors") {

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
                    side: 1
                });
                this._placingDoor = true;
                this.render();
                return;
            }
        }

        if (this._placingDoor) {
            const lastDoor = this.doors[this.doors.length - 1];
            const w = this.walls[lastDoor.wallIndex];
            this.setDoorHingeFromTap(lastDoor, worldX, worldY, w);

            this._placingDoor = false;
            this.mode = "points";
            this.render();
            return;
        }
    }

    // Punkt-Modus

    if (hit.type === "door") {
        this._pendingContext = { x: worldX, y: worldY, type: "door", index: hit.index };
        return;
    }

    if (hit.type === "window") {
        this._pendingContext = { x: worldX, y: worldY, type: "window", index: hit.index };
        return;
    }

    if (hit.type === "point") {
        this._pendingContext = { x: worldX, y: worldY, type: "point", index: hit.index };
        return;
    }

    // Punkt auf Wand einfügen
    if (hit.type === "wall") {
        const w = hit.data;
        const insertPoint = { x: w.x, y: w.y };

        this.points.splice(w.index + 1, 0, insertPoint);

        this.updateWalls();
        this.render();
        return;
    }

    // Neuen Punkt setzen
    if (!this.isClosed) {
        let px = worldX;
        let py = worldY;

        if (this.snapEnabled) {
            px = this.snap(px);
            py = this.snap(py);
        }

        this.points.push({ x: px, y: py });
        this.updateWalls();
        this.render();
        return;
    }

    // PAN = STANDARD
    if (
        hit.type === "empty" ||
        hit.type === "wall" ||
        hit.type === "none"
    ) {
        this.isPanning = true;
        this.lastPanX = mouseX;
        this.lastPanY = mouseY;
    }
},



onUp() {

    // PAN END
    if (this.isPanning) {
        this.isPanning = false;
        return;
    }

    // DRAG END
    if (this.isDragging) {
        this.isDragging = false;
        this.selectedPoint = null;
        this.draggingDoorIndex = null;
        this.draggingWindowIndex = null;
        this._pendingContext = null;
        return;
    }

    // Kontextmenü öffnen
    if (this._pendingContext) {
        const c = this._pendingContext;
        this._pendingContext = null;

        // Welt → Screen für Menüposition
        const screenX = (c.x + this.offsetX) * this.zoom;
        const screenY = (c.y + this.offsetY) * this.zoom;

        this.showContextMenu(screenX, screenY, c.type, c.index);
        return;
    }

    this.selectedPoint = null;
    this.draggingDoorIndex = null;
    this.draggingWindowIndex = null;
    this._pendingContext = null;
},



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

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX / this.zoom) - this.offsetX;
    const worldY = (mouseY / this.zoom) - this.offsetY;

    const oldZoom = this.zoom;

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



// --------------------------------------------------
// TOUCH END
// --------------------------------------------------
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
},
  
    // --------------------------------------------------
    // Canvas-Transform (für zukünftigen Zoom/Pan vorbereitet)
    // --------------------------------------------------
applyTransform() {
    const ctx = this.ctx;
    if (!ctx) return;

    // Offset in Weltkoordinaten → in Screen: offset * zoom
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

    // Grid im Screen-Space, aber mit Zoom/Pan berücksichtigt
    this.drawGrid();

    ctx.save();
    this.applyTransform();   // Welt → Screen

    this.drawFloor();
    this.drawPolygon();
    this.drawWalls();
    this.drawWallLengths();

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

    this.drawWindows();
    this.drawDoors();

    ctx.restore();

    this.drawHoverCross();
},



    // --------------------------------------------------
    // Grid (zoomfähig, konfigurierbar, snap-aware)
    // --------------------------------------------------
drawGrid() {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.save();

    ctx.strokeStyle = this.gridColor;
    ctx.globalAlpha = this.snapEnabled ? this.gridAlphaSnap : this.gridAlpha;
    ctx.lineWidth = 1;

    const sizeWorld = this.gridSize;          // Raster im Welt-Raum
    const sizeScreen = sizeWorld * this.zoom; // Raster im Screen

    if (sizeScreen < 4) {
        ctx.restore();
        return;
    }

    const offXScreen = this.offsetX * this.zoom;
    const offYScreen = this.offsetY * this.zoom;

    const startX = -((offXScreen % sizeScreen + sizeScreen) % sizeScreen);
    const startY = -((offYScreen % sizeScreen + sizeScreen) % sizeScreen);

    for (let x = startX; x < width; x += sizeScreen) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = startY; y < height; y += sizeScreen) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
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
        ctx.fillStyle = "rgba(255,255,255,0.03)";
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
        const ctx = this.ctx;

        for (const d of this.doors) {
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

            // Türblatt
            ctx.strokeStyle = "#00ffc8";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            if (!d.hinge) continue;

            // Scharnierpunkt + anderes Ende
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

            // Anschlag-Strich
            ctx.strokeStyle = "rgba(0,255,200,0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(sx, sy);
            ctx.stroke();

            // Viertelkreis
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
        }
    },

    // --------------------------------------------------
    // Fenster zeichnen
    // --------------------------------------------------
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
    }
}; // Ende RoomDesigner


// --------------------------------------------------
// Editor öffnen
// --------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("btnOpenEditor");
    if (!openBtn) return;

    openBtn.addEventListener("click", () => {
        const root = document.getElementById("smarthome-root");
        const header = document.getElementById("sh-group-header");
        const minimap = document.getElementById("smarthome-minimap");

        if (root) root.style.display = "none";
        if (header) header.style.display = "none";
        if (minimap) minimap.style.display = "none";

        const canvas = document.getElementById("roomdesigner");
        const doorBtn = document.getElementById("btnDoorMode");
        const winBtn = document.getElementById("btnWindowMode");

        if (canvas) canvas.style.display = "block";
        if (doorBtn) doorBtn.style.display = "block";
        if (winBtn) winBtn.style.display = "block";

        RoomDesigner.init();
    });
});
