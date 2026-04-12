function drawDoorIcon(ctx, x, y, size = 24) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";

    // Türrahmen
    ctx.strokeRect(4, 2, 16, 20);

    // Türknauf
    ctx.beginPath();
    ctx.arc(16, 12, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

    
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
        //this.setupDoorButton();
        //this.setupWindowButton();
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
                const w = this.walls[d.wallIndex];
                const proj = this.projectOnWall(worldX, worldY, w);
                d.t = proj.t;
                d.x = proj.x;
                d.y = proj.y;
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

    // Raum schließen durch Klick auf ersten Punkt
    if (!this.isClosed && this.points.length >= 2) {
        const first = this.points[0];
        if (Math.hypot(worldX - first.x, worldY - first.y) < 20) {

            // this.points.push(first);
            this.isClosed = true;

            // NEU: Winkelanzeige aktivieren
            this.selectedPoint = first;
            this.isDragging = true;

            this.updateWalls();
            this.render();

            // Reset
            this.isDragging = false;
            this.selectedPoint = null;

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

    // ------------------------------------------------------------
    // ⭐ TÜR-MODUS (JETZT MIT TÜR-TYPEN)
    // ------------------------------------------------------------

if (this.mode === "doors") {

    const type = this.currentDoorType || "default";

    // ------------------------------------------------------------
    // ⭐ 1) Dachluke → frei platzieren
    // ------------------------------------------------------------
    if (type === "dachluke") {
        this.doors.push({
            wallIndex: null,
            t: null,
            x: worldX,
            y: worldY,
            width: 36,
            hinge: null,
            side: 1,
            type: type
        });

        this.render();
        this.mode = "points";
        return;
    }

    // ------------------------------------------------------------
    // ⭐ 2) Alle anderen Türtypen → Wandgebunden
    // ------------------------------------------------------------
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
            return;
        }
    }

    // ------------------------------------------------------------
    // ⭐ 3) Hinge setzen (normale Türen)
    // ------------------------------------------------------------
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

    // Punkt-Kandidat im leeren Raum
    if (!this.isClosed && hit.type === "empty") {
        let px = worldX;
        let py = worldY;

        if (this.snapEnabled) {
            px = this.snap(px);
            py = this.snap(py);
        }

        this._pendingNewPoint = { x: px, y: py };
    }

    // PAN-Kandidat merken (aber noch NICHT starten)
    if (hit.type === "empty" || hit.type === "wall") {
        this.isPanCandidate = true;
        this.panStartX = mouseX;
        this.panStartY = mouseY;
    }
},

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

        // DRAG END
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
                return;
            }

            // Normaler Drag-Ende
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

            const screenX = (c.x + this.offsetX) * this.zoom;
            const screenY = (c.y + this.offsetY) * this.zoom;

            this.showContextMenu(screenX, screenY, c.type, c.index);
            return;
        }

        // Wenn bereits ein Timer läuft → das hier ist der zweite Klick → Doppelklick
        if (this._clickTimer) {
            clearTimeout(this._clickTimer);
            this._clickTimer = null;
            this._pendingNewPoint = null; // keinen Punkt setzen
            return; // Doppelklick → Zoom übernimmt
        }

        // Erster Klick → Timer starten
        this._clickTimer = setTimeout(() => {

            // Timer abgelaufen → es war ein einfacher Klick
            this._clickTimer = null;

            if (!this.isClosed && this._pendingNewPoint) {

                let px = this._pendingNewPoint.x;
                let py = this._pendingNewPoint.y;

                // NEU: Snap auf ersten Punkt beim Setzen
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
            }

            this._pendingNewPoint = null;

        }, 220); // 220ms = Standard-Doppelklick-Fenster
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
            
            // Wenn kein Scharnier → fertig (z.B. Dachluke, Schiebetür)
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

    d.isOpen = true; // nur zum Testen

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

    if (d.isOpen) {
        // 90° drehen
        const angle = Math.PI / 2 * (d.side || 1);

        const rx = nx * Math.cos(angle) - ny * Math.sin(angle);
        const ry = nx * Math.sin(angle) + ny * Math.cos(angle);

        ctx.strokeStyle = "#00ffc8";
        ctx.lineWidth = 5;

        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + rx * len, hy + ry * len);
        ctx.stroke();

    } else {
        // geschlossene Tür
        ctx.strokeStyle = "#00ffc8";
        ctx.lineWidth = 5;

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

    d.isOpen = true; // nur zum Testen

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
    if (!len) return;

    const nx = dx / len;   // entlang der Tür
    const ny = dy / len;

    const px = -ny;        // senkrecht zur Tür
    const py = nx;

    const side = d.side || 1;

    // Geometrie der Schwelle
    const wallThickness = 12;
    const extra = 8;
    const half = (wallThickness + extra) / 2;

    // ------------------------------------------------------------
    // 1. Türschwelle bei offener Tür (am Scharnier, so lang wie Türblatt)
    // ------------------------------------------------------------
    if (d.isOpen) {

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
    // 2. Türblatt (offen/geschlossen)
    // ------------------------------------------------------------
    if (d.isOpen) {
        const angle = Math.PI / 2 * side;

        const rx = nx * Math.cos(angle) - ny * Math.sin(angle);
        const ry = nx * Math.sin(angle) + ny * Math.cos(angle);

        ctx.strokeStyle = "#00d4a8";
        ctx.lineWidth = 7;

        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + rx * len, hy + ry * len);
        ctx.stroke();

    } else {
        ctx.strokeStyle = "#00d4a8";
        ctx.lineWidth = 7;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

// ------------------------------------------------------------
// 3. Haussymbol: mittig zur Schwelle, konstanter Abstand,
//    auf der korrekten Seite (px * -side)
// ------------------------------------------------------------

// Mittelpunkt der Schwelle (entlang der Tür)
const mx = (hx + ox) / 2;
const my = (hy + oy) / 2;

// Abstand: Schwellenbreite + kleiner Abstand
const iconGap = 6;
const iconOffset = half + iconGap;

// Seite war bereits korrekt → -side NICHT ändern!
const ix = mx + px * (-side) * iconOffset;
const iy = my + py * (-side) * iconOffset;

ctx.save();
ctx.translate(ix, iy);
ctx.rotate(Math.atan2(ny, nx));
drawDoorIcon(ctx, 0, 0, 24);
ctx.restore();


    return;
}



        // ------------------------------------------------------------
        // ⭐ Dachluke → rund, frei platzierbar
        // ------------------------------------------------------------
        case "dachluke":
            ctx.strokeStyle = "#00b7ff";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.width / 2, 0, Math.PI * 2);
            ctx.stroke();
        
            ctx.fillStyle = "rgba(0,183,255,0.15)";
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.width / 2.5, 0, Math.PI * 2);
            ctx.fill();
            return;



// ------------------------------------------------------------
// ⭐ Schiebetür → kein Viertelkreis
// ------------------------------------------------------------
case "schiebetuer": {

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

    const floorColor = "rgba(255,255,255,0.03)";

    ctx.save();

    // Bodenfarbe
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
// Schiebetür-Linie: Mittelpunkt am Scharnier, volle Länge,
// auf gewählter Seite (innen/außen)
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

// 3. Seite (innen/außen)
const side = d.side || 1;
const offset = 4; // Abstand von der Schwelle

// Mittelpunkt der Linie = Scharnierpunkt, seitlich versetzt
const mx = hx + px2 * offset * side;
const my = hy + py2 * offset * side;

// Linie so lang wie die Türschwelle
const halfLen = len2 / 2;

// Start- und Endpunkt um den Mittelpunkt herum
const sx = mx - nx2 * halfLen;
const sy = my - ny2 * halfLen;

const ex2 = mx + nx2 * halfLen;
const ey2 = my + ny2 * halfLen;

// 4. Linie zeichnen
ctx.save();
ctx.strokeStyle = "#ffffff";
ctx.lineWidth = 2;

ctx.beginPath();
ctx.moveTo(sx, sy);
ctx.lineTo(ex2, ey2);
ctx.stroke();

ctx.restore();





    return;
}






        // ------------------------------------------------------------
        // ⭐ Falttür → segmentiert
        // ------------------------------------------------------------
case "falttuer": {

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

    // Türblatt-Ecken
    const t1x = x1 + px * half;
    const t1y = y1 + py * half;

    const t2x = x2 + px * half;
    const t2y = y2 + py * half;

    const t3x = x2 - px * half;
    const t3y = y2 - py * half;

    const t4x = x1 - px * half;
    const t4y = y1 - py * half;

    // ⭐ Bodenfarbe (fix, stabil, ohne Abhängigkeit)
    const floorColor = "rgba(255,255,255,0.03)";

    // ------------------------------------------------------------
    // Türblatt füllen
    // ------------------------------------------------------------
    ctx.save();

    // Bodenfarbe
    ctx.beginPath();
    ctx.moveTo(t1x, t1y);
    ctx.lineTo(t2x, t2y);
    ctx.lineTo(t3x, t3y);
    ctx.lineTo(t4x, t4y);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();

    // Grauschleier
  //  ctx.beginPath();
    //ctx.moveTo(t1x, t1y);
   // ctx.lineTo(t2x, t2y);
   // ctx.lineTo(t3x, t3y);
   // ctx.lineTo(t4x, t4y);
   // ctx.closePath();
    // ctx.fillStyle = "rgba(180,180,180,0.25)";
   // ctx.fill();

    // feiner Umriss
//    ctx.beginPath();
  //  ctx.moveTo(t1x, t1y);
   // ctx.lineTo(t2x, t2y);
   // ctx.lineTo(t3x, t3y);
   // ctx.lineTo(t4x, t4y);
    // ctx.closePath();
   // ctx.strokeStyle = "#00d4a8";
   // ctx.lineWidth = 1.2;
   // ctx.stroke();

    ctx.restore();

    // ⭐ Zacken kommen später (Schritt 2)
// ------------------------------------------------------------
// ⭐ Falttür-Zacken am Scharnierende
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

// Richtungsvektoren
const dx2 = ox - hx;
const dy2 = oy - hy;
const len2 = Math.hypot(dx2, dy2);
if (!len2) return;

const nx2 = dx2 / len2;
const ny2 = dy2 / len2;

// Senkrecht
const px2 = -ny2;
const py2 = nx2;

// Zacken-Parameter
const step = 2;     // enger
const height = 4;   // Zackenhöhe
const count = 8;    // ein Zacken mehr

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
        case "terrassentuer":
            // Rahmen
            ctx.strokeStyle = "#00ffc8";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        
            // Glasfüllung
            ctx.strokeStyle = "rgba(0, 180, 255, 0.7)";
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            return;



        // ------------------------------------------------------------
        // ⭐ Garagentor → dicke Linie
        // ------------------------------------------------------------
        case "garagentor":
            ctx.strokeStyle = "#00ffc8";
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        
            // Struktur
            ctx.strokeStyle = "rgba(0,255,200,0.3)";
            ctx.lineWidth = 2;
        
            const steps = 3;
            for (let i = 1; i <= steps; i++) {
                const t = i / (steps + 1);
                ctx.beginPath();
                ctx.moveTo(
                    x1 + (x2 - x1) * t,
                    y1 + (y2 - y1) * t
                );
                ctx.lineTo(
                    x1 + (x2 - x1) * t + (y1 - y2) * 0.15,
                    y1 + (y2 - y1) * t + (x2 - x1) * 0.15
                );
                ctx.stroke();
            }
            return;

        // ------------------------------------------------------------
        // ⭐ Gartentörchen → schmal
        // ------------------------------------------------------------
          case "gartentor":
            ctx.strokeStyle = "#00ffc8";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            return;
    

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

        // NEU: Titelbar anzeigen
        const titlebar = document.getElementById("editor-titlebar");
        if (titlebar) titlebar.style.display = "flex";

        // Sidebar anzeigen
        const sidebar = document.getElementById("editor-sidebar");
        if (sidebar) sidebar.style.display = "flex";


        RoomDesigner.init();
    });
});

// ===============================
// Editor schließen
// ===============================
document.getElementById("editor-close-btn")?.addEventListener("click", () => {

    // Titelbar ausblenden
    const titlebar = document.getElementById("editor-titlebar");
    if (titlebar) titlebar.style.display = "none";

    // Sidebar ausblenden
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

    if (root) root.style.display = "block";
    if (header) header.style.display = "block";
    if (minimap) minimap.style.display = "block";
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
