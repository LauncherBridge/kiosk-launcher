// ======================================================
// Raumdesigner – kompletter Editor
// Canvas-Init, Raster, Punkte setzen, verschieben,
// löschen (mit Bestätigung), Raum schließen (snappen),
// Wände, Türen (Viertelkreis-Bogen am Scharnier),
// Fenster, Wandlängen in Metern, Punkt-Einfügen,
// Bodenfläche (RE-Style)
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
    isDragging: false,
    _initialized: false,

    mode: "points",   // "points" | "doors" | "windows"
    isClosed: false,  // Raum geschlossen?

    windowMode: false,

    _toastEl: null,
    _toastConfirmFn: null,

    draggingDoorIndex: null,
    draggingWindowIndex: null,
    selectedDoorIndex: null,

    PIXELS_PER_METER: 40, // 1 Raster = 1m

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

        this.resize();
        this.render();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    },

    // --------------------------------------------------
    // Eingaben
    // --------------------------------------------------
    onMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        let hx = e.clientX - rect.left;
        let hy = e.clientY - rect.top;

        // Magnetisches Einrasten auf ersten Punkt
        if (this.points.length > 0) {
            const first = this.points[0];
            const dx = hx - first.x;
            const dy = hy - first.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (!this.isClosed && dist < 20) {
                hx = first.x;
                hy = first.y;
            }
        }

        this.hover.x = hx;
        this.hover.y = hy;

        // Tür entlang der Wand verschieben
        if (this.draggingDoorIndex !== null) {
            const d = this.doors[this.draggingDoorIndex];
            const w = this.walls[d.wallIndex];
            if (w) {
                const proj = this.projectOnWall(hx, hy, w);
                d.t = proj.t;
                d.x = proj.x;
                d.y = proj.y;
            }
            this.render();
            return;
        }

        // Fenster entlang der Wand verschieben
        if (this.draggingWindowIndex !== null) {
            const wObj = this.windows[this.draggingWindowIndex];
            const w = this.walls[wObj.wallIndex];
            if (w) {
                const proj = this.projectOnWall(hx, hy, w);
                wObj.t = proj.t;
                wObj.x = proj.x;
                wObj.y = proj.y;
            }
            this.render();
            return;
        }

        if (this.isDragging && this.selectedPoint) {
            this.selectedPoint.x = this.hover.x;
            this.selectedPoint.y = this.hover.y;
            this.updateWalls();
        }

        this.render();
    },

    onDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Rechtsklick separat
        if (e.button === 2) return;

        // Fenster-Modus
        if (this.mode === "windows") {
            const winIndex = this.getWindowIndexAt(x, y);
            if (winIndex !== null) {
                this.draggingWindowIndex = winIndex;
                return;
            }

            const hit = this.getWallAt(x, y);
            if (hit) {
                this.windows.push({
                    wallIndex: hit.index,
                    t: hit.t,
                    x: hit.x,
                    y: hit.y,
                    width: 80
                });
                this.render();
            }
            return;
        }

        // Tür-Modus
        if (this.mode === "doors") {
            // Zuerst: existiert eine Tür ohne Scharnier? → Tap setzt Scharnier
            const pendingIndex = this.doors.findIndex(d => !d.hinge);
            if (pendingIndex !== -1) {
                const d = this.doors[pendingIndex];
                const w = this.walls[d.wallIndex];
                if (w) {
                    this.setDoorHingeFromTap(d, x, y, w);
                    this.selectedDoorIndex = pendingIndex;
                    this.render();
                }
                return;
            }

            // Tür getroffen? → verschieben
            const doorIndex = this.getDoorIndexAt(x, y);
            if (doorIndex !== null) {
                const d = this.doors[doorIndex];
                const w = this.walls[d.wallIndex];
                if (w) {
                    this.draggingDoorIndex = doorIndex;
                }
                return;
            }

            // Neue Tür auf Wand platzieren
            const hit = this.getWallAt(x, y);
            if (hit) {
                this.doors.push({
                    wallIndex: hit.index,
                    t: hit.t,
                    x: hit.x,
                    y: hit.y,
                    width: 36,      // ca. 0,9m
                    swing: 90,      // max 90°
                    direction: 1,
                    flip: 1,
                    hinge: null
                });
                this.render();
            }
            return;
        }

        // Punkt-Modus

        // Raum schließen?
        if (!this.isClosed && this.points.length > 2) {
            const first = this.points[0];
            const dx = x - first.x;
            const dy = y - first.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

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
            this.selectedPoint = hitPoint;
            this.isDragging = true;
            return;
        }

        // Punkt in Wand einfügen
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

        // Neuen Punkt setzen (nur wenn noch nicht geschlossen)
        if (!this.isClosed) {
            this.points.push({ x, y });
            this.updateWalls();
            this.render();
        }
    },

    onUp() {
        this.isDragging = false;
        this.selectedPoint = null;
        this.draggingDoorIndex = null;
        this.draggingWindowIndex = null;
    },

    onRightClick(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Tür getroffen?
        const doorHit = this.getDoorAt(x, y);
        if (doorHit) {
            this.showDeleteToast("Tür löschen?", () => {
                this.doors = this.doors.filter(d => d !== doorHit);
                this.render();
            });
            return;
        }

        // Fenster getroffen?
        const windowHit = this.getWindowAt(x, y);
        if (windowHit) {
            this.showDeleteToast("Fenster löschen?", () => {
                this.windows = this.windows.filter(w => w !== windowHit);
                this.render();
            });
            return;
        }

        // Punkt getroffen?
        const hit = this.getPointAt(x, y);
        if (hit) {
            this.showDeleteToast("Punkt löschen?", () => {
                this.points = this.points.filter(p => p !== hit);
                if (this.points.length < 3) {
                    this.isClosed = false;
                }
                this.updateWalls();
                this.render();
            });
        }
    },

    // --------------------------------------------------
    // Hilfsfunktionen
    // --------------------------------------------------
    getPointAt(x, y) {
        return this.points.find(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 10;
        });
    },

    getDoorAt(x, y) {
        return this.doors.find(d => {
            const dx = d.x - x;
            const dy = d.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 15;
        });
    },

    getDoorIndexAt(x, y) {
        for (let i = 0; i < this.doors.length; i++) {
            const d = this.doors[i];
            const dx = d.x - x;
            const dy = d.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < 15) return i;
        }
        return null;
    },

    getWindowAt(x, y) {
        return this.windows.find(w => {
            const dx = w.x - x;
            const dy = w.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 15;
        });
    },

    getWindowIndexAt(x, y) {
        for (let i = 0; i < this.windows.length; i++) {
            const w = this.windows[i];
            const dx = w.x - x;
            const dy = w.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < 15) return i;
        }
        return null;
    },

    getWallAt(x, y) {
        for (let i = 0; i < this.walls.length; i++) {
            const w = this.walls[i];

            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };

            const ABx = B.x - A.x;
            const ABy = B.y - A.y;
            const APx = x - A.x;
            const APy = y - A.y;

            const abLen = Math.sqrt(ABx * ABx + ABy * ABy);
            if (abLen === 0) continue;

            const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / (abLen * abLen)));

            const closestX = A.x + t * ABx;
            const closestY = A.y + t * ABy;

            const dx = x - closestX;
            const dy = y - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
                return { index: i, t, x: closestX, y: closestY };
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
        if (abLen2 === 0) {
            return { t: 0, x: A.x, y: A.y };
        }

        let t = (APx * ABx + APy * ABy) / abLen2;
        t = Math.max(0, Math.min(1, t));

        const px = A.x + t * ABx;
        const py = A.y + t * ABy;

        return { t, x: px, y: py };
    },

    setDoorHingeFromTap(door, tapX, tapY, wall) {
        // Wandvektor
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;

        const tx = dx / len;
        const ty = dy / len;

        // Türendpunkte entlang der Wand
        const half = door.width / 2;
        const cx = door.x;
        const cy = door.y;

        const x1 = cx - tx * half;
        const y1 = cy - ty * half;

        const x2 = cx + tx * half;
        const y2 = cy + ty * half;

        // Nächstgelegener Endpunkt = Scharnier
        const d1 = Math.hypot(tapX - x1, tapY - y1);
        const d2 = Math.hypot(tapX - x2, tapY - y2);

        let hx, hy, ox, oy;
        if (d1 <= d2) {
            door.hinge = "start";
            hx = x1;
            hy = y1;
            ox = x2;
            oy = y2;
        } else {
            door.hinge = "end";
            hx = x2;
            hy = y2;
            ox = x1;
            oy = y1;
        }

        // Normale der Wand (für Seite)
        const nx = -ty;
        const ny = tx;

        const vx = tapX - hx;
        const vy = tapY - hy;

        const sideDot = vx * nx + vy * ny;
        door.flip = sideDot >= 0 ? 1 : -1;

        // Richtung immer vom Scharnier zum anderen Ende
        const ex = ox - hx;
        const ey = oy - hy;
        const baseAngle = Math.atan2(ey, ex);

        door._baseAngle = baseAngle;
        door.direction = 1;
    },

    updateWalls() {
        this.walls = [];

        if (this.points.length < 2) return;

        for (let i = 0; i < this.points.length - 1; i++) {
            const a = this.points[i];
            const b = this.points[i + 1];

            this.walls.push({
                x1: a.x, y1: a.y,
                x2: b.x, y2: b.y
            });
        }

        if (this.isClosed && this.points.length > 2) {
            const last = this.points[this.points.length - 1];
            const first = this.points[0];
            this.walls.push({
                x1: last.x, y1: last.y,
                x2: first.x, y2: first.y
            });
        }

        // Türen/Fenster mit Wänden mitwandern lassen
        for (const d of this.doors) {
            const w = this.walls[d.wallIndex];
            if (!w) continue;
            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };
            d.x = A.x + (B.x - A.x) * d.t;
            d.y = A.y + (B.y - A.y) * d.t;
        }

        for (const win of this.windows) {
            const w = this.walls[win.wallIndex];
            if (!w) continue;
            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };
            win.x = A.x + (B.x - A.x) * win.t;
            win.y = A.y + (B.y - A.y) * win.t;
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

        // Türsegment
        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Kein Scharnier → kein Bogen
        if (!d.hinge) continue;

        // Scharnierpunkt + anderes Ende
        let hx, hy, ox, oy;
        if (d.hinge === "start") {
            hx = x1;
            hy = y1;
            ox = x2;
            oy = y2;
        } else {
            hx = x2;
            hy = y2;
            ox = x1;
            oy = y1;
        }

        // Basiswinkel: vom Scharnier zum anderen Ende (geschlossene Tür)
        const ex = ox - hx;
        const ey = oy - hy;
        const baseAngle = Math.atan2(ey, ex);

        // Radius etwas kleiner als Türbreite
        const radius = d.width * 0.8;

        // Immer exakt Viertelkreis
        const swing = Math.PI / 2; // 90°

        // Seite: +1 oder -1 → links/rechts vom Türblatt
        const side = d.flip >= 0 ? 1 : -1;

        const startAngle = baseAngle;
        const endAngle = baseAngle + swing * side;

        // Wichtig: immer anticlockwise = false → wir definieren Start/Ende selbst
        ctx.strokeStyle = "rgba(0,255,200,0.25)";
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        ctx.arc(
            hx,
            hy,
            radius,
            startAngle,
            endAngle,
            false
        );
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
            this.windowMode = false;
            btn.style.background = (this.mode === "doors") ? "#e29a4a" : "#4a90e2";

            const winBtn = document.getElementById("btnWindowMode");
            if (winBtn) winBtn.style.background = "#3498db";
        });
    },

    setupWindowButton() {
        const btn = document.getElementById("btnWindowMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.windowMode = !this.windowMode;
            this.mode = this.windowMode ? "windows" : "points";
            btn.style.background = this.windowMode ? "#5dade2" : "#3498db";

            const doorBtn = document.getElementById("btnDoorMode");
            if (doorBtn) doorBtn.style.background = "#4a90e2";
        });
    },

    // --------------------------------------------------
    // Tablet-gerechte Lösch-Bestätigung (Toast)
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

    hideToast() {
        if (this._toastEl) {
            this._toastEl.style.display = "none";
        }
        this._toastConfirmFn = null;
    }
};

// --------------------------------------------------
// Debug: Editor öffnen
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
