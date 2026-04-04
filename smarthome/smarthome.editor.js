// ======================================================
// Raumdesigner – kompletter Editor (überarbeitet)
// Selektionssystem, Objekt-Hit-Tests, Vorbereitung Overlay
// ======================================================


const RoomDesigner = {
    canvas: null,
    ctx: null,

    points: [],
    walls: [],
    doors: [],
    windows: [],

    hover: { x: 0, y: 0 },

    // Neues Selektionssystem
    selectedPointIndex: null,
    selectedDoorIndex: null,
    selectedWindowIndex: null,

    // Dragging
    isDragging: false,
    draggingDoorIndex: null,
    draggingWindowIndex: null,

    _initialized: false,

    mode: "points",   // "points" | "doors" | "windows"
    isClosed: false,

    PIXELS_PER_METER: 40,

    // Overlay-Element für +/–
    _sizeControlsEl: null,
    _activeResizeObject: null,

    // --------------------------------------------------
    // Initialisierung
    // --------------------------------------------------
    init() {
        if (this._initialized) return;
        this._initialized = true;

        this.canvas = document.getElementById("roomdesigner");
        if (!this.canvas) {
            console.warn("RoomDesigner: Canvas #roomdesigner nicht gefunden.");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        window.addEventListener("resize", () => this.resize());
        this.canvas.addEventListener("mousemove", (e) => this.onMove(e));
        this.canvas.addEventListener("mousedown", (e) => this.onDown(e));
        this.canvas.addEventListener("mouseup", () => this.onUp());
        this.canvas.addEventListener("contextmenu", (e) => this.onRightClick(e));

        this.setupDoorButton();
        this.setupWindowButton();

        // Neues Overlay erzeugen
        this.createSizeControlsOverlay();

        this.resize();
        this.render();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    },

    // --------------------------------------------------
    // Selektionssystem
    // --------------------------------------------------
    deselectAll() {
        this.selectedPointIndex = null;
        this.selectedDoorIndex = null;
        this.selectedWindowIndex = null;

        this._activeResizeObject = null;

        if (this._sizeControlsEl) {
            this._sizeControlsEl.style.display = "none";
        }
    },

    selectObject(type, index) {
        this.deselectAll();

        if (type === "point") {
            this.selectedPointIndex = index;
        } else if (type === "door") {
            this.selectedDoorIndex = index;
            this._activeResizeObject = this.doors[index];
        } else if (type === "window") {
            this.selectedWindowIndex = index;
            this._activeResizeObject = this.windows[index];
        }

        if (this._activeResizeObject) {
            this._sizeControlsEl.style.display = "flex";
            this.updateSizeControlsPosition();
        }

        this.render();
    },

    // --------------------------------------------------
    // Hit-Tests (neue Reihenfolge)
    // --------------------------------------------------
    hitTestAll(x, y) {
        // 1. Fenster
        const wIndex = this.getWindowIndexAt(x, y);
        if (wIndex !== null) return { type: "window", index: wIndex };

        // 2. Türen
        const dIndex = this.getDoorIndexAt(x, y);
        if (dIndex !== null) return { type: "door", index: dIndex };

        // 3. Punkte
        const pIndex = this.points.findIndex(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            return Math.sqrt(dx*dx + dy*dy) < 10;
        });
        if (pIndex !== -1) return { type: "point", index: pIndex };

        return null;
    },

    // --------------------------------------------------
    // Overlay für Größenänderung
    // --------------------------------------------------
    createSizeControlsOverlay() {
        const el = document.createElement("div");
        el.id = "rd-size-controls";
        el.style.position = "fixed";
        el.style.display = "none";
        el.style.flexDirection = "row";
        el.style.gap = "8px";
        el.style.zIndex = "99999";

        const btnPlus = document.createElement("button");
        btnPlus.textContent = "+";
        btnPlus.style.padding = "6px 10px";
        btnPlus.style.fontSize = "18px";

        const btnMinus = document.createElement("button");
        btnMinus.textContent = "–";
        btnMinus.style.padding = "6px 10px";
        btnMinus.style.fontSize = "18px";

        btnPlus.addEventListener("click", () => {
            if (!this._activeResizeObject) return;
            this._activeResizeObject.width += 10;
            this.clampObjectWidth(this._activeResizeObject);
            this.updateWalls();
            this.render();
            this.updateSizeControlsPosition();
        });

        btnMinus.addEventListener("click", () => {
            if (!this._activeResizeObject) return;
            this._activeResizeObject.width -= 10;
            this.clampObjectWidth(this._activeResizeObject);
            this.updateWalls();
            this.render();
            this.updateSizeControlsPosition();
        });

        el.appendChild(btnPlus);
        el.appendChild(btnMinus);

        document.body.appendChild(el);
        this._sizeControlsEl = el;
    },

    updateSizeControlsPosition() {
        if (!this._activeResizeObject || !this._sizeControlsEl) return;

        const obj = this._activeResizeObject;
        const rect = this.canvas.getBoundingClientRect();

        const screenX = rect.left + obj.x;
        const screenY = rect.top + obj.y - 40;

        this._sizeControlsEl.style.left = screenX + "px";
        this._sizeControlsEl.style.top = screenY + "px";
    },

    clampObjectWidth(obj) {
        const wall = this.walls[obj.wallIndex];
        if (!wall) return;

        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const len = Math.sqrt(dx*dx + dy*dy);

        const maxWidth = Math.max(20, len - 20);

        obj.width = Math.max(20, Math.min(maxWidth, obj.width));
    },
    // --------------------------------------------------
    // Eingaben – Fortsetzung
    // --------------------------------------------------
onDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Rechtsklick → löschen
    if (e.button === 2) return;

    // --------------------------------------------------
    // 1. Prüfen, ob ein existierendes Objekt getroffen wurde
    // --------------------------------------------------
    const hit = this.hitTestAll(x, y);

    if (hit) {
        this.selectObject(hit.type, hit.index);

        // Dragging aktivieren
        if (hit.type === "point") {
            this.isDragging = true;
        }

        if (hit.type === "door") {
            this.draggingDoorIndex = hit.index;
        }

        if (hit.type === "window") {
            this.draggingWindowIndex = hit.index;
        }

        return;
    }

    // --------------------------------------------------
    // 2. Klick ins Leere → alles deselektieren
    // --------------------------------------------------
    this.deselectAll();

    // --------------------------------------------------
    // 3. Modusabhängige Neuerstellung
    // --------------------------------------------------

    // -------------------------
    // Fenster setzen
    // -------------------------
    if (this.mode === "windows") {
        const wallHit = this.getWallAt(x, y);
        if (wallHit) {
            const newWin = {
                wallIndex: wallHit.index,
                t: wallHit.t,
                x: wallHit.x,
                y: wallHit.y,
                width: 80
            };
            this.windows.push(newWin);
            this.selectObject("window", this.windows.length - 1);
            return;
        }
    }

    // -------------------------
    // Türen setzen
    // -------------------------
    if (this.mode === "doors") {
        const wallHit = this.getWallAt(x, y);
        if (wallHit) {
            this.doors.push({
                wallIndex: wallHit.index,
                t: wallHit.t,
                x: wallHit.x,
                y: wallHit.y,
                width: 36,
                swing: 90,
                hinge: null,
                side: 1
            });
            this.selectObject("door", this.doors.length - 1);
            return;
        }
    }

    // -------------------------
    // Punktmodus
    // -------------------------
    if (this.mode === "points") {

        // Raum schließen?
        if (!this.isClosed && this.points.length > 2) {
            const first = this.points[0];
            const dist = Math.hypot(x - first.x, y - first.y);

            if (dist < 20) {
                this.isClosed = true;
                this.updateWalls();
                this.render();
                return;
            }
        }

        // Punkt getroffen?
        const hitPoint = this.getPointAt(x, y);
        if (hitPoint) {
            const idx = this.points.indexOf(hitPoint);
            this.selectObject("point", idx);
            this.isDragging = true;
            return;
        }

        // Punkt in Wand einfügen (nur wenn Wand existiert)
        if (this.isClosed || this.points.length > 1) {
            const wallHit = this.getWallAt(x, y);
            if (wallHit) {
                const idx = wallHit.index;
                const insertPoint = { x: wallHit.x, y: wallHit.y };

                if (idx < this.points.length - 1) {
                    this.points.splice(idx + 1, 0, insertPoint);
                } else {
                    this.points.push(insertPoint);
                }

                this.updateWalls();
                this.render();
                return;
            }
        }

        // Neuen Punkt setzen (immer möglich, wenn keine Wand getroffen)
        this.points.push({ x, y });
        this.updateWalls();
        this.render();
        return;
    }
},

    onUp() {
        this.isDragging = false;
        this.draggingDoorIndex = null;
        this.draggingWindowIndex = null;
    },

    onRightClick(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Tür löschen
        const doorHit = this.getDoorAt(x, y);
        if (doorHit) {
            this.doors = this.doors.filter(d => d !== doorHit);
            this.render();
            return;
        }

        // Fenster löschen
        const windowHit = this.getWindowAt(x, y);
        if (windowHit) {
            this.windows = this.windows.filter(w => w !== windowHit);
            this.render();
            return;
        }

        // Punkt löschen
        const hit = this.getPointAt(x, y);
        if (hit) {
            this.points = this.points.filter(p => p !== hit);
            if (this.points.length < 3) {
                this.isClosed = false;
            }
            this.updateWalls();
            this.render();
        }
    },
    // --------------------------------------------------
    // Rendering
    // --------------------------------------------------
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawFloor();
        this.drawPolygon();
        this.drawWalls();
        this.drawWallLengths();

        // Winkelanzeige für alle betroffenen Punkte
        if (this.isDragging && this.selectedPointIndex !== null) {
            const idx = this.selectedPointIndex;

            const affected = new Set();
            affected.add(idx);

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
        this.drawHoverCross();
    },

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;

        const grid = 40;

        for (let x = 0; x < this.canvas.width; x += grid) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += grid) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    },

    drawFloor() {
        const ctx = this.ctx;
        const pts = this.points;
        if (pts.length < 3) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();

        ctx.fillStyle = "#1b2420";
        ctx.globalAlpha = 0.9;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.restore();
    },

    drawPolygon() {
        const ctx = this.ctx;
        const pts = this.points;

        if (pts.length === 0) return;

        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }

        if (this.isClosed && pts.length > 2) {
            ctx.lineTo(pts[0].x, pts[0].y);
        }

        ctx.stroke();

        for (const p of pts) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawWalls() {
        const ctx = this.ctx;

        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 3;

        for (const w of this.walls) {
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.stroke();
        }
    },

    drawWallLengths() {
        if (!this.isDragging || this.selectedPointIndex === null) return;

        const ctx = this.ctx;
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 3;

        const sel = this.points[this.selectedPointIndex];

        for (const w of this.walls) {
            const isEnd =
                (w.x1 === sel.x && w.y1 === sel.y) ||
                (w.x2 === sel.x && w.y2 === sel.y);

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

            ctx.strokeStyle = "#00ffcc";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            if (!d.hinge) continue;

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

            const ux = ex / elen;
            const uy = ey / elen;

            const px = -uy;
            const py = ux;

            const side = d.side || 1;

            const hingeLen = elen;

            const sx = hx + px * hingeLen * side;
            const sy = hy + py * hingeLen * side;

            ctx.strokeStyle = "rgba(0,255,200,0.4)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(sx, sy);
            ctx.stroke();

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

    drawWindows() {
        const ctx = this.ctx;

        ctx.strokeStyle = "#5dade2";
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
    // Buttons
    // --------------------------------------------------
    setupDoorButton() {
        const btn = document.getElementById("btnDoorMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.mode = (this.mode === "doors") ? "points" : "doors";

            const winBtn = document.getElementById("btnWindowMode");
            if (winBtn) winBtn.style.background = "#3498db";

            btn.style.background = (this.mode === "doors") ? "#e29a4a" : "#4a90e2";
        });
    },

    setupWindowButton() {
        const btn = document.getElementById("btnWindowMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.mode = (this.mode === "windows") ? "points" : "windows";

            const doorBtn = document.getElementById("btnDoorMode");
            if (doorBtn) doorBtn.style.background = "#4a90e2";

            btn.style.background = (this.mode === "windows") ? "#5dade2" : "#3498db";
        });
    },
};

// --------------------------------------------------
// Editor öffnen
// --------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("btnOpenEditor");
    if (openBtn) {
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
    }
});
